from fastapi import APIRouter
from database import db
from datetime import datetime

router = APIRouter()


def ingredient_lookup():
    lookup = {}
    for x in db["ingredients"].find({}, {"_id": 0}):
        iid = x.get("ingredient_id") or x.get("IngredientId")
        if iid is not None:
            lookup[str(iid)] = {
                "name": x.get("ingredient_name") or x.get("IngredientName") or "Unknown",
                "unit": x.get("unit") or x.get("Unit") or ""
            }
    return lookup


def convert_unit(stock, unit):
    if stock is None: stock = 0
    unit = str(unit or "").lower()
    if unit == "mg" and stock >= 1000: return round(stock / 1000, 2), "g"
    if unit == "g" and stock >= 1000: return round(stock / 1000, 2), "kg"
    if unit == "ml" and stock >= 1000: return round(stock / 1000, 2), "L"
    return stock, unit


def normalized_inventory(item, lookup):
    iid = item.get("IngredientId") or item.get("ingredient_id")
    meta = lookup.get(str(iid), {})
    name = item.get("IngredientName") or item.get("ingredient_name")
    if not name or str(name).strip().lower() == "unknown":
        name = meta.get("name", "Unknown")
    unit = item.get("Unit") or item.get("unit") or meta.get("unit", "")
    stock = item.get("Stock") if item.get("Stock") is not None else item.get("stock_quantity", 0)
    return iid, name, stock, unit


@router.post("/api/branch-inventory/init")
def initialize_branch_inventory():
    branches = list(db["store_restaurant"].find({}))
    ingredients = list(db["ingredients"].find({}))
    created = 0
    for branch in branches:
        branch_id = branch.get("STORE_NUMBER")
        if branch_id is not None:
            branch_id = str(branch_id)
        for ingredient in ingredients:
            ingredient_id = ingredient.get("IngredientId") or ingredient.get("ingredient_id")
            exists = db["branch_inventory"].find_one({"$or": [
                {"branchId": branch_id, "IngredientId": ingredient_id},
                {"branch_id": branch_id, "ingredient_id": ingredient_id},
                {"branchId": int(branch_id) if str(branch_id).isdigit() else -1, "IngredientId": ingredient_id}
            ]})
            if exists:
                continue
            db["branch_inventory"].insert_one({
                "branchId": branch_id,
                "IngredientId": ingredient_id,
                "IngredientName": ingredient.get("IngredientName") or ingredient.get("ingredient_name"),
                "Stock": 1000,
                "Unit": ingredient.get("Unit") or ingredient.get("unit") or "unit",
                "createdAt": datetime.now()
            })
            created += 1
    return {"success": True, "message": "Branch inventory initialized", "created": created}


@router.get("/api/branch-inventory/{branch_id}")
def get_branch_inventory(branch_id: str):
    legacy_id = int(branch_id) if branch_id.isdigit() else -1
    lookup = ingredient_lookup()
    inventory = list(db["branch_inventory"].find({"$or": [
        {"branch_id": branch_id}, {"branchId": branch_id},
        {"branchId": legacy_id}, {"branch_id": legacy_id}
    ]}, {"_id": 0}))

    if not inventory:
        inventory = [{
            "branch_id": branch_id,
            "ingredient_id": x.get("ingredient_id") or x.get("IngredientId"),
            "ingredient_name": x.get("ingredient_name") or x.get("IngredientName"),
            "stock_quantity": 0,
            "unit": x.get("unit") or x.get("Unit") or ""
        } for x in db["ingredients"].find({}, {"_id": 0})]

    result = []
    for item in inventory:
        iid, name, stock, unit = normalized_inventory(item, lookup)
        stock, unit = convert_unit(stock, unit)
        result.append({"IngredientId": iid, "IngredientName": name, "Stock": stock, "Unit": unit, "branchId": item.get("branchId", item.get("branch_id", branch_id))})
    return result


@router.get("/api/branch-inventory/{branch_id}/stock-usage")
def get_stock_usage(branch_id: str):
    if branch_id.lower() == "all":
        query = {}
    else:
        legacy_id = int(branch_id) if branch_id.isdigit() else -1
        query = {"$or": [
            {"branchId": branch_id}, {"branchId": legacy_id},
            {"branch_id": branch_id}, {"branch_id": legacy_id}
        ]}
    lookup = ingredient_lookup()
    rows = list(db["inventory_transactions"].find(query, {"_id": 0}).sort("createdAt", -1).limit(100))
    result = []
    for row in rows:
        iid = row.get("IngredientId") or row.get("ingredient_id")
        meta = lookup.get(str(iid), {})
        name = row.get("IngredientName") or row.get("ingredient_name")
        if not name or str(name).strip().lower() == "unknown":
            name = meta.get("name", "Unknown")
        unit = row.get("unit") or row.get("Unit") or meta.get("unit", "")
        result.append({
            "orderId": str(row.get("orderId") or row.get("order_id") or ""),
            "branchId": row.get("branchId", row.get("branch_id", "")),
            "IngredientId": iid,
            "IngredientName": name,
            "ingredient": name,
            "used": float(row.get("used", row.get("Used", 0)) or 0),
            "unit": unit,
            "beforeStock": float(row.get("beforeStock", 0) or 0),
            "remaining": float(row.get("remaining", row.get("Remaining", 0)) or 0),
            "date": str(row.get("createdAt") or row.get("date") or "")
        })
    return result
