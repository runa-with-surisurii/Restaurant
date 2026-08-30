from fastapi import APIRouter
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter()


def branch_query(branch_id):
    values = [branch_id, str(branch_id)]
    if str(branch_id).isdigit():
        values.append(int(str(branch_id)))
    return {"$or": [{"branchId": v} for v in values] + [{"branch_id": v} for v in values]}


def to_float(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def order_amount(order):
    return to_float(order.get("total", order.get("total_amount", 0)))


def order_date(order):
    value = order.get("confirmedAt") or order.get("order_date") or order.get("createdAt") or order.get("created_at")
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(str(value), fmt)
            except ValueError:
                pass
    return None


def calculate_growth(branch_id):
    today = datetime.now().date()
    current_start = today - timedelta(days=7)
    previous_start = today - timedelta(days=14)
    current_sales = previous_sales = 0.0
    for order in db["orders"].find(branch_query(branch_id)):
        if str(order.get("status", "")).lower() not in {"confirmed", "completed", "complete", "paid"}:
            continue
        dt = order_date(order)
        if not dt:
            continue
        if current_start <= dt.date() <= today:
            current_sales += order_amount(order)
        elif previous_start <= dt.date() < current_start:
            previous_sales += order_amount(order)
    if previous_sales == 0:
        return 100 if current_sales > 0 else 0
    return round(((current_sales - previous_sales) / previous_sales) * 100, 2)


def normalize_usage(log):
    ingredient_id = log.get("IngredientId") or log.get("ingredient_id")
    name = log.get("IngredientName") or log.get("ingredient_name") or log.get("ingredient")
    if not name or str(name).lower() == "unknown":
        conditions = []
        if ingredient_id is not None:
            conditions = [
                {"ingredient_id": ingredient_id}, {"ingredient_id": str(ingredient_id)},
                {"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}
            ]
        ingredient = db["ingredients"].find_one({"$or": conditions}, {"_id": 0}) if conditions else None
        if ingredient:
            name = ingredient.get("ingredient_name") or ingredient.get("IngredientName") or ingredient.get("name")
    used = log.get("used")
    if used is None:
        used = log.get("quantityUsed", log.get("quantity_used", log.get("quantity", 0)))
    remaining = log.get("remaining")
    if remaining is None:
        remaining = log.get("afterStock", log.get("stock_after", 0))
    return {
        "ingredient": str(name or ingredient_id or "Unknown"),
        "ingredientId": ingredient_id,
        "used": to_float(used),
        "unit": str(log.get("unit") or log.get("Unit") or "unit"),
        "beforeStock": to_float(log.get("beforeStock", log.get("before_stock", 0))),
        "remaining": to_float(remaining),
        "orderId": str(log.get("orderId") or log.get("order_id") or ""),
        "date": str(log.get("createdAt") or log.get("created_at") or "")
    }


def get_inventory_usage(branch_id, limit=10):
    logs = list(db["inventory_transactions"].find(branch_query(branch_id)).sort("createdAt", -1).limit(limit))
    return [normalize_usage(log) for log in logs]


@router.get("/api/branch/dashboard/{branch_id}")
def branch_dashboard(branch_id: str):
    all_orders = list(db["orders"].find({"$and": [branch_query(branch_id), {"status": {"$in": ["confirmed", "completed", "Confirmed", "Completed"]}}]}))
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = [o for o in all_orders if (order_date(o) and order_date(o) >= today_start)]
    total_revenue = sum(order_amount(o) for o in all_orders)
    today_revenue = sum(order_amount(o) for o in today_orders)
    items_sold = sum(int(item.get("quantity", item.get("qty", 1)) or 1) for order in all_orders for item in order.get("items", []))
    sales_map = defaultdict(float)
    week_start = today_start - timedelta(days=6)
    for order in all_orders:
        dt = order_date(order)
        if dt and dt >= week_start:
            sales_map[dt.strftime("%a")] += order_amount(order)
    days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    weekly_sales = [{"day": day, "sales": round(sales_map[day], 2)} for day in days]
    inventory_usage = get_inventory_usage(branch_id, 10)
    return {
        "orders": len(today_orders), "totalOrders": len(all_orders),
        "revenue": round(today_revenue, 2), "totalRevenue": round(total_revenue, 2),
        "customers": len(today_orders), "itemsSold": items_sold,
        "growth": calculate_growth(branch_id), "weekly_sales": weekly_sales,
        "inventory_usage": inventory_usage, "inventoryUsage": inventory_usage
    }


@router.get("/api/dashboard/inventory-usage/{branch_id}")
def inventory_usage(branch_id: str):
    return {"success": True, "data": get_inventory_usage(branch_id, 20)}
