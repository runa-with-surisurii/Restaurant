from fastapi import APIRouter
from database import db
from datetime import datetime
from bson import ObjectId

router = APIRouter()


def convert_unit(value, from_unit, to_unit):
    if not from_unit or not to_unit:
        return value
    a, b = str(from_unit).lower().strip(), str(to_unit).lower().strip()
    if a == b:
        return value
    conversions = {("kg", "g"): 1000, ("g", "kg"): 0.001, ("l", "ml"): 1000, ("liter", "ml"): 1000, ("ml", "l"): 0.001, ("ml", "liter"): 0.001, ("mg", "g"): 0.001, ("g", "mg"): 1000, ("oz", "g"): 28.3495, ("g", "oz"): 0.035274}
    return value * conversions.get((a, b), 1)


def menu_image(menu):
    if not menu:
        return ""
    return str(menu.get("Image") or menu.get("image") or menu.get("imageUrl") or menu.get("ImageURL") or "")


def find_menu(menu_id=None, name=None):
    conditions = []
    if menu_id is not None:
        text = str(menu_id)
        conditions += [{"menu_id": menu_id}, {"menu_id": text}]
        if text.isdigit(): conditions.append({"MenuItemId": int(text)})
    if name:
        conditions += [{"menu_name": name}, {"MenuItemName": name}, {"Description": name}]
    return db["menu_items"].find_one({"$or": conditions}) if conditions else None


def enrich_orders(orders):
    menus = {}
    for menu in db["menu_items"].find({}, {"_id": 0}):
        mid = menu.get("menu_id") or menu.get("MenuItemId")
        if mid is not None: menus[str(mid)] = menu
    order_ids = [str(o.get("order_id") or o.get("orderId") or o.get("_id")) for o in orders]
    item_map = {}
    if order_ids:
        for item in db["order_items"].find({"order_id": {"$in": order_ids}}, {"_id": 0}): item_map.setdefault(str(item.get("order_id")), []).append(item)
    for order in orders:
        oid = str(order.get("order_id") or order.get("orderId") or order.get("_id") or "")
        raw_items = item_map.get(oid) or order.get("items") or []
        normalized = []
        for item in raw_items:
            mid = item.get("menu_id") or item.get("menuItemId") or item.get("MenuItemId")
            menu = menus.get(str(mid)) if mid is not None else find_menu(name=item.get("name") or item.get("menu_name"))
            name = item.get("menu_name") or item.get("name") or item.get("Description")
            if not name and menu: name = menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description")
            qty = int(item.get("quantity") or item.get("Quantity") or 1)
            price = float(item.get("unit_price") or item.get("price") or item.get("Price") or 0)
            image = item.get("image") or item.get("Image") or menu_image(menu) or (f"/menu/{mid}.jpg" if mid else "")
            normalized.append({"menu_id": mid, "name": str(name or "Unknown menu item"), "quantity": qty, "unit_price": price, "subtotal": float(item.get("subtotal") or item.get("Total") or qty * price), "image": image})
        order["items"] = normalized
        order["_id"] = str(order.get("_id")) if order.get("_id") is not None else oid
        if "branchId" not in order and order.get("branch_id") is not None: order["branchId"] = order["branch_id"]
        if "total" not in order and order.get("total_amount") is not None: order["total"] = float(order["total_amount"])
        if order.get("status"): order["status"] = str(order["status"]).lower()
    return orders


@router.post("/api/orders")
def create_order(order: dict):
    items, order_items = [], []
    branch_id = order.get("branchId") or order.get("branch_id")
    total_amount = 0.0
    for raw in order.get("items", []):
        item = dict(raw)
        menu = find_menu(item.get("dishId") or item.get("menu_id") or item.get("menuItemId"), item.get("name"))
        if menu:
            item["recipeId"] = menu.get("RecipeId") or menu.get("recipe_id")
            item["menuItemId"] = menu.get("MenuItemId") or menu.get("menu_id")
            item["menu_id"] = menu.get("menu_id") or menu.get("MenuItemId")
            item["image"] = menu_image(menu) or f"/menu/{item['menu_id']}.jpg"
            if not item.get("name"): item["name"] = menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description")
        items.append(item)
        qty = int(item.get("quantity", 1) or 1); price = float(item.get("price", item.get("unit_price", 0)) or 0)
        total_amount += qty * price
        order_items.append({"menu_id": item.get("menu_id") or item.get("dishId") or item.get("menuItemId"), "menu_name": item.get("name"), "image": item.get("image", ""), "quantity": qty, "unit_price": price, "subtotal": qty * price, "cost_price": item.get("costPrice", 0)})
    result = db["orders"].insert_one({"branchId": branch_id, "branch_id": branch_id, "createdBy": order.get("createdBy", "customer"), "items": items, "total": total_amount, "status": "pending", "createdAt": datetime.now()})
    order_id = str(result.inserted_id)
    db["orders"].update_one({"_id": result.inserted_id}, {"$set": {"order_id": order_id}})
    for oi in order_items: db["order_items"].insert_one({"order_id": order_id, "orderItemId": "OI" + order_id[-6:], **oi, "branch_id": branch_id})
    return {"success": True, "orderId": order_id, "order_id": order_id}


@router.get("/api/orders/all")
def get_all_orders(): return enrich_orders(list(db["orders"].find({}).sort("createdAt", -1)))


@router.get("/api/orders/{branch_id}")
def get_orders(branch_id: str): return enrich_orders(list(db["orders"].find({"$or": [{"branchId": branch_id}, {"branch_id": branch_id}, {"branchId": int(branch_id) if branch_id.isdigit() else -1}, {"branch_id": int(branch_id) if branch_id.isdigit() else -1}]}).sort("createdAt", -1)))


@router.put("/api/orders/{order_id}/confirm")
def confirm_order(order_id: str):
    try: order = db["orders"].find_one({"_id": ObjectId(order_id)})
    except Exception: return {"success": False, "message": "Invalid order id"}
    if not order: return {"success": False, "message": "Order not found"}
    if str(order.get("status", "")).lower() in {"confirmed", "completed"}: return {"success": False, "message": "Already confirmed"}

    branch_id = order.get("branchId") or order.get("branch_id")
    order_id_value = str(order.get("order_id") or order["_id"])
    db["orders"].update_one({"_id": order["_id"]}, {"$set": {"order_id": order_id_value}})

    existing = list(db["order_items"].find({"order_id": order_id_value}, {"_id": 0}))
    if not existing:
        for item in order.get("items", []):
            menu = find_menu(item.get("dishId") or item.get("menu_id") or item.get("menuItemId"), item.get("name"))
            if menu:
                mid = menu.get("menu_id") or menu.get("MenuItemId"); qty = int(item.get("quantity", 1) or 1); price = float(item.get("price", item.get("unit_price", 0)) or 0)
                db["order_items"].insert_one({"order_id": order_id_value, "orderItemId": "OI" + order_id_value[-6:], "menu_id": mid, "menu_name": item.get("name") or menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description"), "image": menu_image(menu) or f"/menu/{mid}.jpg", "quantity": qty, "unit_price": price, "subtotal": qty * price, "cost_price": menu.get("cost_price", 0), "branch_id": branch_id})
        existing = list(db["order_items"].find({"order_id": order_id_value}, {"_id": 0}))

    stock_updates = []
    for item in existing:
        menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("MenuItemId")
        menu = find_menu(menu_id, item.get("menu_name") or item.get("name"))
        if menu: menu_id = menu.get("menu_id") or menu.get("MenuItemId")
        if not menu_id: continue
        qty_ordered = int(item.get("quantity") or item.get("qty") or 1)
        recipes = list(db["menu_ingredients"].find({"$or": [{"menu_id": menu_id}, {"menu_id": str(menu_id)}]}, {"_id": 0}))
        for recipe in recipes:
            ingredient_id = recipe.get("ingredient_id") or recipe.get("IngredientId")
            required = float(recipe.get("quantity_required", recipe.get("Quantity", 0)) or 0) * qty_ordered
            if ingredient_id is None or required <= 0: continue
            inv_candidates = list(db["branch_inventory"].find({"$or": [
                {"branch_id": branch_id}, {"branch_id": str(branch_id)}, {"branchId": branch_id}, {"branchId": str(branch_id)}, {"branchId": int(str(branch_id)) if str(branch_id).isdigit() else -999999}
            ]))
            inv = None
            for candidate in inv_candidates:
                cid = candidate.get("ingredient_id") if candidate.get("ingredient_id") is not None else candidate.get("IngredientId")
                if str(cid) == str(ingredient_id): inv = candidate; break
            ingredient = db["ingredients"].find_one({"$or": [{"ingredient_id": ingredient_id}, {"ingredient_id": str(ingredient_id)}, {"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}]}, {"_id": 0})
            if not inv:
                # Create a branch inventory row when the branch has the ingredient in the master list.
                if not ingredient: continue
                inv = {"branch_id": branch_id, "ingredient_id": ingredient_id, "ingredient_name": ingredient.get("ingredient_name") or ingredient.get("IngredientName"), "stock_quantity": 1000, "unit": ingredient.get("unit") or ingredient.get("Unit") or "unit"}
                inserted = db["branch_inventory"].insert_one(dict(inv)); inv["_id"] = inserted.inserted_id
            stock = float(inv.get("stock_quantity", inv.get("Stock", 0)) or 0)
            stock_unit = inv.get("unit") or inv.get("Unit") or (ingredient or {}).get("unit") or "unit"
            recipe_unit = recipe.get("unit") or recipe.get("Unit") or (ingredient or {}).get("unit") or stock_unit
            used = convert_unit(required, recipe_unit, stock_unit)
            if used <= 0: continue
            remaining = max(0, stock - used)
            update_fields = {"stock_quantity": remaining, "Stock": remaining, "ingredient_name": (ingredient or {}).get("ingredient_name") or inv.get("ingredient_name"), "IngredientName": (ingredient or {}).get("ingredient_name") or inv.get("ingredient_name"), "unit": stock_unit, "Unit": stock_unit}
            db["branch_inventory"].update_one({"_id": inv["_id"]}, {"$set": update_fields})
            ingredient_name = (ingredient or {}).get("ingredient_name") or (ingredient or {}).get("IngredientName") or inv.get("ingredient_name") or inv.get("IngredientName") or str(ingredient_id)
            # Prevent duplicate usage records for the same order/ingredient.
            if not db["inventory_transactions"].find_one({"orderId": order_id_value, "IngredientId": ingredient_id}):
                db["inventory_transactions"].insert_one({"orderId": order_id_value, "branchId": branch_id, "IngredientId": ingredient_id, "IngredientName": ingredient_name, "ingredient_name": ingredient_name, "beforeStock": stock, "used": used, "unit": stock_unit, "remaining": remaining, "createdAt": datetime.now()})
            stock_updates.append({"IngredientName": ingredient_name, "Used": used, "Unit": stock_unit, "Remaining": remaining})

    db["orders"].update_one({"_id": ObjectId(order_id)}, {"$set": {"status": "confirmed", "confirmedAt": datetime.now()}})
    return {"success": True, "message": "Order confirmed successfully", "stockUpdated": stock_updates}
