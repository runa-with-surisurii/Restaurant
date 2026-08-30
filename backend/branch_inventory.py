from fastapi import APIRouter
from database import db
from datetime import datetime

router = APIRouter()


def convert_unit(stock, unit):
    if stock is None: stock = 0
    if unit is None: unit = ""
    unit = str(unit).lower()
    if unit == "mg" and stock >= 1000: return round(stock / 1000, 2), "g"
    if unit == "g" and stock >= 1000: return round(stock / 1000, 2), "kg"
    if unit == "ml" and stock >= 1000: return round(stock / 1000, 2), "L"
    return stock, unit


@router.post("/api/branch-inventory/init")
def initialize_branch_inventory():
    branches = list(db["store_restaurant"].find({}))
    ingredients = list(db["ingredients"].find({}))
    created = 0
    for branch in branches:
        branch_id = branch.get("STORE_NUMBER")
        if branch_id: branch_id = int(branch_id)
        for ingredient in ingredients:
            ingredient_id = ingredient.get("IngredientId") or ingredient.get("ingredient_id")
            exists = db["branch_inventory"].find_one({"$or": [{"branchId": branch_id, "IngredientId": ingredient_id}, {"branch_id": branch_id, "ingredient_id": ingredient_id}]})
            if exists: continue
            db["branch_inventory"].insert_one({"branchId": branch_id, "IngredientId": ingredient_id, "IngredientName": ingredient.get("IngredientName") or ingredient.get("ingredient_name"), "Stock": 1000, "Unit": ingredient.get("Unit") or ingredient.get("unit") or "unit", "createdAt": datetime.now()})
            created += 1
    return {"success": True, "message": "Branch inventory initialized", "created": created}


@router.get("/api/branch-inventory/{branch_id}")
def get_branch_inventory(branch_id: str):
    legacy_id = int(branch_id) if branch_id.isdigit() else -1
    inventory = list(db["branch_inventory"].find({"$or": [{"branch_id": branch_id}, {"branchId": branch_id}, {"branchId": legacy_id}]}, {"_id": 0}))
    if not inventory:
        inventory = [{"branch_id": branch_id, "ingredient_id": x.get("ingredient_id") or x.get("IngredientId"), "ingredient_name": x.get("ingredient_name") or x.get("IngredientName"), "stock_quantity": 0, "unit": x.get("unit") or x.get("Unit") or ""} for x in db["ingredients"].find({}, {"_id": 0})]
    result = []
    for item in inventory:
        stock, unit = convert_unit(item.get("Stock", item.get("stock_quantity", 0)), item.get("Unit", item.get("unit", "")))
        result.append({"IngredientId": item.get("IngredientId", item.get("ingredient_id")), "IngredientName": item.get("IngredientName", item.get("ingredient_name", "Unknown")), "Stock": stock, "Unit": unit, "branchId": item.get("branchId", item.get("branch_id", branch_id))})
    return result


@router.get("/api/branch-inventory/{branch_id}/stock-usage")
def get_stock_usage(branch_id: str):
    if branch_id.lower() == "all":
        query = {}
    else:
        legacy_id = int(branch_id) if branch_id.isdigit() else -1
        query = {"$or": [{"branchId": branch_id}, {"branchId": legacy_id}, {"branch_id": branch_id}]}
    rows = list(db["inventory_transactions"].find(query, {"_id": 0}).sort("createdAt", -1).limit(100))
    return [{
        "orderId": str(row.get("orderId", "")),
        "branchId": row.get("branchId", ""),
        "IngredientId": row.get("IngredientId"),
        "IngredientName": row.get("IngredientName", "Unknown"),
        "used": float(row.get("used", row.get("Used", 0)) or 0),
        "unit": row.get("unit", row.get("Unit", "")),
        "beforeStock": float(row.get("beforeStock", 0) or 0),
        "remaining": float(row.get("remaining", row.get("Remaining", 0)) or 0),
        "createdAt": row.get("createdAt"),
    } for row in rows]
