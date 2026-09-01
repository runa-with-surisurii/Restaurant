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


def get_all_branch_ids():
    ids = []
    for branch in db["branches"].find({}, {"_id": 0}):
        branch_id = branch.get("branch_id") or branch.get("branchId")
        if branch_id is not None and str(branch_id).strip():
            ids.append(str(branch_id).strip())
    if not ids:
        for branch in db["store_restaurant"].find({}, {"_id": 0}):
            branch_id = branch.get("STORE_NUMBER") or branch.get("branch_id") or branch.get("branchId")
            if branch_id is not None and str(branch_id).strip():
                ids.append(str(branch_id).strip())
    return list(dict.fromkeys(ids))


def ingredient_id(item):
    return item.get("IngredientId") if item.get("IngredientId") is not None else item.get("ingredient_id")


def convert_unit(stock, unit):
    if stock is None:
        stock = 0
    unit = str(unit or "").lower()
    if unit == "mg" and stock >= 1000:
        return round(stock / 1000, 2), "g"
    if unit == "g" and stock >= 1000:
        return round(stock / 1000, 2), "kg"
    if unit == "ml" and stock >= 1000:
        return round(stock / 1000, 2), "L"
    return stock, unit


def normalized_inventory(item, lookup):
    iid = ingredient_id(item)
    meta = lookup.get(str(iid), {})
    name = item.get("IngredientName") or item.get("ingredient_name") or meta.get("name", "Unknown")
    unit = item.get("Unit") or item.get("unit") or meta.get("unit", "")
    stock = item.get("Stock") if item.get("Stock") is not None else item.get("stock_quantity", 0)
    try:
        stock = float(stock or 0)
    except (TypeError, ValueError):
        stock = 0.0
    return iid, name, stock, unit


def branch_inventory_query(branch_id):
    legacy_id = int(branch_id) if str(branch_id).isdigit() else -1
    return {"$or": [
        {"branch_id": str(branch_id)},
        {"branchId": str(branch_id)},
        {"branchId": legacy_id},
        {"branch_id": legacy_id}
    ]}


@router.post("/api/branch-inventory/init")
def initialize_branch_inventory():
    # Do not manufacture stock values. Inventory is read from MongoDB.
    branches = get_all_branch_ids()
    existing = db["branch_inventory"].count_documents({})
    return {
        "success": True,
        "message": "Branch inventory uses existing MongoDB stock; no stock was generated.",
        "branches": branches,
        "existingRows": existing
    }


@router.get("/api/branch-inventory/{branch_id}")
def get_branch_inventory(branch_id: str):
    lookup = ingredient_lookup()
    if branch_id.lower() == "all":
        inventory = list(db["branch_inventory"].find({}, {"_id": 0}))
    else:
        inventory = list(db["branch_inventory"].find(branch_inventory_query(branch_id), {"_id": 0}))

    result = []
    for item in inventory:
        iid, name, stock, unit = normalized_inventory(item, lookup)
        stock, unit = convert_unit(stock, unit)
        result.append({
            "IngredientId": iid,
            "IngredientName": name,
            "Stock": stock,
            "Unit": unit,
            "branchId": item.get("branchId", item.get("branch_id", branch_id)),
            "reorderLevel": item.get("reorderLevel", item.get("reorder_level")),
            "lastRestock": item.get("lastRestock", item.get("last_restock"))
        })
    return result


@router.get("/api/branch-inventory/{branch_id}/stock-usage")
def get_stock_usage(branch_id: str):
    query = {} if branch_id.lower() == "all" else branch_inventory_query(branch_id)
    lookup = ingredient_lookup()
    rows = list(db["inventory_transactions"].find(query, {"_id": 0}).sort("createdAt", -1).limit(100))
    result = []
    for row in rows:
        iid = row.get("IngredientId") or row.get("ingredient_id")
        meta = lookup.get(str(iid), {})
        name = row.get("IngredientName") or row.get("ingredient_name") or meta.get("name", "Unknown")
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
