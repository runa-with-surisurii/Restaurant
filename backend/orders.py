from fastapi import APIRouter
from database import db
from datetime import datetime
from bson import ObjectId

router = APIRouter()


def convert_unit(value, from_unit, to_unit):
    if not from_unit or not to_unit:
        return value
    from_unit = str(from_unit).lower().strip()
    to_unit = str(to_unit).lower().strip()
    if from_unit == to_unit:
        return value
    conversions = {
        ("kg", "g"): 1000, ("g", "kg"): 0.001,
        ("l", "ml"): 1000, ("liter", "ml"): 1000,
        ("ml", "l"): 0.001, ("ml", "liter"): 0.001,
        ("mg", "g"): 0.001, ("g", "mg"): 1000,
        ("oz", "g"): 28.3495, ("g", "oz"): 0.035274,
        ("ounce", "gram"): 28.3495, ("gram", "ounce"): 0.035274,
    }
    return value * conversions.get((from_unit, to_unit), 1)


def enrich_orders(orders):
    """Make both imported dataset orders and new MongoDB orders display menu names."""
    menu_by_id = {}
    for menu in db["menu_items"].find({}, {"_id": 0}):
        mid = menu.get("menu_id") or menu.get("MenuItemId")
        if mid is not None:
            menu_by_id[str(mid)] = menu

    order_ids = []
    for order in orders:
        oid = order.get("order_id") or order.get("orderId") or order.get("_id")
        if oid is not None:
            order_ids.append(str(oid))

    item_map = {}
    if order_ids:
        for item in db["order_items"].find({"order_id": {"$in": order_ids}}, {"_id": 0}):
            item_map.setdefault(str(item.get("order_id")), []).append(item)

    for order in orders:
        oid = str(order.get("order_id") or order.get("orderId") or order.get("_id") or "")
        items = item_map.get(oid) or order.get("items") or []

        # Imported dataset orders may have order_items but no embedded items.
        # Resolve every menu_id to menu_items so the UI gets a real dish name.
        normalized = []
        for item in items:
            mid = item.get("menu_id") or item.get("menuItemId") or item.get("MenuItemId")
            menu = menu_by_id.get(str(mid)) if mid is not None else None
            name = item.get("menu_name") or item.get("name") or item.get("Description")
            if not name and menu:
                name = menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description")
            qty = item.get("quantity") or item.get("Quantity") or 1
            price = item.get("unit_price") or item.get("price") or item.get("Price") or 0
            normalized.append({
                "menu_id": mid,
                "name": str(name or "Unknown menu item"),
                "quantity": int(qty),
                "unit_price": float(price or 0),
                "subtotal": float(item.get("subtotal") or item.get("Total") or (int(qty) * float(price or 0))),
            })
        order["items"] = normalized
        order["_id"] = str(order.get("_id")) if order.get("_id") is not None else oid

        # Normalize dataset field names for the frontend.
        if "branchId" not in order and order.get("branch_id") is not None:
            order["branchId"] = order["branch_id"]
        if "total" not in order and order.get("total_amount") is not None:
            order["total"] = float(order["total_amount"])
        if order.get("status"):
            order["status"] = str(order["status"]).lower()
    return orders


@router.post("/api/orders")
def create_order(order: dict):
    items = []
    order_items = []
    branch_id = order.get("branchId") or order.get("branch_id")
    total_amount = 0.0

    for item in order.get("items", []):
        item = dict(item)
        menu = None
        dish_id = item.get("dishId") or item.get("menu_id") or item.get("menuItemId")
        if dish_id:
            try:
                menu = db["menu_items"].find_one({"$or": [
                    {"menu_id": dish_id},
                    {"MenuItemId": int(dish_id) if str(dish_id).isdigit() else -1},
                    {"Description": str(dish_id)},
                ]})
            except Exception:
                pass
        if not menu:
            name = item.get("name")
            if name:
                menu = db["menu_items"].find_one({"$or": [
                    {"menu_name": name}, {"MenuItemName": name}, {"Description": name}
                ]})
        if menu:
            item["recipeId"] = menu.get("RecipeId") or menu.get("recipe_id")
            item["menuItemId"] = menu.get("MenuItemId") or menu.get("menu_id")
            item["image"] = menu.get("Image") or menu.get("image") or "/menu/default.png"
            item["menu_id"] = menu.get("menu_id") or menu.get("MenuItemId")
            if not item.get("name"):
                item["name"] = menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description")
        items.append(item)
        quantity = int(item.get("quantity", 1) or 1)
        unit_price = float(item.get("price", item.get("unit_price", 0)) or 0)
        subtotal = quantity * unit_price
        total_amount += subtotal
        order_items.append({
            "menu_id": item.get("menu_id") or item.get("dishId") or item.get("menuItemId"),
            "menu_name": item.get("name"), "quantity": quantity,
            "unit_price": unit_price, "subtotal": subtotal,
            "cost_price": item.get("costPrice", 0),
        })

    order_data = {
        "branchId": branch_id, "branch_id": branch_id,
        "createdBy": order.get("createdBy", "customer"),
        "items": items, "total": total_amount,
        "status": "pending", "createdAt": datetime.now(),
    }
    result = db["orders"].insert_one(order_data)
    order_id = str(result.inserted_id)
    db["orders"].update_one({"_id": result.inserted_id}, {"$set": {"order_id": order_id}})

    for oi in order_items:
        db["order_items"].insert_one({
            "order_id": order_id, "orderItemId": "OI" + order_id[-6:],
            "menu_id": oi["menu_id"], "menu_name": oi["menu_name"],
            "quantity": oi["quantity"], "unit_price": oi["unit_price"],
            "subtotal": oi["subtotal"], "cost_price": oi["cost_price"],
            "branch_id": branch_id,
        })
    return {"success": True, "orderId": order_id, "order_id": order_id}


@router.get("/api/orders/all")
def get_all_orders():
    return enrich_orders(list(db["orders"].find({}).sort("createdAt", -1)))


@router.get("/api/orders/{branch_id}")
def get_orders(branch_id: str):
    orders = list(db["orders"].find({"$or": [{"branchId": branch_id}, {"branch_id": branch_id}]}).sort("createdAt", -1))
    return enrich_orders(orders)


@router.put("/api/orders/{order_id}/confirm")
def confirm_order(order_id: str):
    try:
        order = db["orders"].find_one({"_id": ObjectId(order_id)})
    except Exception:
        return {"success": False, "message": "Invalid order id"}
    if not order:
        return {"success": False, "message": "Order not found"}
    if str(order.get("status", "")).lower() == "confirmed":
        return {"success": False, "message": "Already confirmed"}

    branch_id = order.get("branchId") or order.get("branch_id")
    if not order.get("order_id"):
        order["order_id"] = str(order["_id"])
        db["orders"].update_one({"_id": order["_id"]}, {"$set": {"order_id": order["order_id"]}})
    order_id_value = str(order["order_id"])

    existing_order_items = list(db["order_items"].find({"order_id": order_id_value}, {"_id": 0}))
    if not existing_order_items:
        for item in order.get("items", []):
            menu = None
            dish_id = item.get("dishId") or item.get("menu_id") or item.get("menuItemId")
            if dish_id:
                try:
                    menu = db["menu_items"].find_one({"$or": [
                        {"menu_id": dish_id},
                        {"MenuItemId": int(dish_id) if str(dish_id).isdigit() else -1},
                        {"Description": str(dish_id)},
                    ]})
                except Exception:
                    pass
            if not menu:
                name = item.get("name")
                if name:
                    menu = db["menu_items"].find_one({"$or": [
                        {"menu_name": name}, {"MenuItemName": name}, {"Description": name}
                    ]})
            if menu:
                menu_id = menu.get("menu_id") or menu.get("MenuItemId")
                qty = int(item.get("quantity", 1) or 1)
                price = float(item.get("price", item.get("unit_price", 0)) or 0)
                db["order_items"].insert_one({
                    "order_id": order_id_value, "orderItemId": "OI" + order_id_value[-6:],
                    "menu_id": menu_id,
                    "menu_name": item.get("name") or menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description"),
                    "quantity": qty, "unit_price": price, "subtotal": qty * price,
                    "cost_price": menu.get("cost_price", 0), "branch_id": branch_id,
                })

    stock_updates = []
    # Deduct ingredients exactly once, at confirmation, from this branch only.
    for item in order.get("items", []):
        recipe_id = item.get("recipeId")
        if not recipe_id:
            dish_id = item.get("dishId") or item.get("menu_id") or item.get("menuItemId")
            menu = None
            if dish_id:
                try:
                    menu = db["menu_items"].find_one({"$or": [
                        {"menu_id": dish_id},
                        {"MenuItemId": int(dish_id) if str(dish_id).isdigit() else -1},
                    ]})
                except Exception:
                    pass
            if not menu and item.get("name"):
                menu = db["menu_items"].find_one({"$or": [
                    {"menu_name": item["name"]}, {"MenuItemName": item["name"]}, {"Description": item["name"]}
                ]})
            if menu:
                recipe_id = menu.get("RecipeId") or menu.get("recipe_id")
        if not recipe_id:
            continue

        recipes = list(db["recipe_ingredient_assignments"].find({"$or": [
            {"RecipeId": recipe_id}, {"RecipeId": str(recipe_id)},
            {"RecipeId": int(recipe_id) if str(recipe_id).isdigit() else -999999}
        ]}))
        quantity_ordered = int(item.get("quantity", 1) or 1)

        for recipe in recipes:
            ingredient_id = recipe.get("IngredientId") or recipe.get("ingredient_id")
            recipe_qty = float(recipe.get("Quantity", recipe.get("quantity", 0)) or 0)
            recipe_unit = recipe.get("Unit", recipe.get("unit", ""))
            inventory = db["branch_inventory"].find_one({"$and": [
                {"$or": [{"branchId": branch_id}, {"branchId": str(branch_id)}, {"branch_id": branch_id}]},
                {"$or": [{"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}, {"ingredient_id": ingredient_id}]}
            ]})
            if not inventory:
                continue
            stock_unit = inventory.get("Unit", inventory.get("unit", ""))
            used = convert_unit(recipe_qty, recipe_unit, stock_unit) * quantity_ordered
            before = float(inventory.get("Stock", inventory.get("stock", 0)) or 0)
            if used <= 0 or before < used:
                continue
            remaining = before - used
            db["branch_inventory"].update_one({"_id": inventory["_id"]}, {"$set": {"Stock": remaining}})
            db["inventory_transactions"].insert_one({
                "orderId": order_id_value, "branchId": branch_id,
                "IngredientId": ingredient_id,
                "IngredientName": inventory.get("IngredientName", inventory.get("ingredient_name", "Unknown")),
                "beforeStock": before, "used": used, "unit": stock_unit,
                "remaining": remaining, "createdAt": datetime.now()
            })
            stock_updates.append({
                "IngredientName": inventory.get("IngredientName", inventory.get("ingredient_name", "Unknown")),
                "Used": used, "Unit": stock_unit, "Remaining": remaining
            })

    # Save item-level sales details for new orders.
    for item in order.get("items", []):
        qty = int(item.get("quantity", 1) or 1)
        price = float(item.get("price", item.get("unit_price", 0)) or 0)
        db["order_details"].insert_one({
            "StoreNumber": branch_id, "OrderId": order_id_value,
            "Description": item.get("name", "Unknown"), "Quantity": qty,
            "Price": price, "Total": qty * price,
            "date": datetime.now().strftime("%Y-%m-%d")
        })

    db["orders"].update_one({"_id": ObjectId(order_id)}, {"$set": {"status": "confirmed", "confirmedAt": datetime.now()}})
    return {"success": True, "message": "Order confirmed successfully", "stockUpdated": stock_updates}
