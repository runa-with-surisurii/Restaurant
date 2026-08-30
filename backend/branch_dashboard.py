from fastapi import APIRouter
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter()

def branch_query(branch_id):
    values = [branch_id, str(branch_id)]
    if str(branch_id).isdigit(): values.append(int(str(branch_id)))
    return {"$or": [{"branchId": v} for v in values] + [{"branch_id": v} for v in values]}

def to_float(value, default=0.0):
    try: return float(value) if value is not None else default
    except (TypeError, ValueError): return default

def order_date(order):
    value = order.get("confirmedAt") or order.get("order_date") or order.get("createdAt") or order.get("created_at")
    if isinstance(value, datetime): return value
    if not value: return None
    try: return datetime.fromisoformat(str(value).replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"):
            try: return datetime.strptime(str(value), fmt)
            except ValueError: pass
    return None

def id_variants(value):
    if value is None: return []
    result = [value, str(value)]
    if str(value).isdigit(): result.append(int(str(value)))
    return result

def ingredient_cost_for_menu(menu_id, quantity):
    if menu_id is None: return 0.0
    total = 0.0
    values = id_variants(menu_id)
    recipes = list(db["menu_ingredients"].find({"menu_id": {"$in": values}}, {"_id": 0}))
    if not recipes: recipes = list(db["menu_ingredients"].find({"MenuItemId": {"$in": values}}, {"_id": 0}))
    for recipe in recipes:
        ingredient_id = recipe.get("ingredient_id") or recipe.get("IngredientId")
        required = to_float(recipe.get("quantity_required", recipe.get("Quantity", recipe.get("quantity", 0))))
        if ingredient_id is None or required <= 0: continue
        ingredient = db["ingredients"].find_one({"$or": [{"ingredient_id": ingredient_id}, {"ingredient_id": str(ingredient_id)}, {"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}]}, {"_id": 0})
        if ingredient:
            unit_cost = to_float(ingredient.get("cost_per_unit", ingredient.get("CostPerUnit", ingredient.get("cost", 0))))
            total += required * unit_cost * quantity
    return total

def menu_id_from_item(item):
    return item.get("menu_id") or item.get("menuItemId") or item.get("MenuItemId") or item.get("dishId")

def order_financials(order):
    selling_total = to_float(order.get("total", order.get("total_amount", 0)))
    ingredient_cost = 0.0
    items = order.get("items") or []
    if items:
        for item in items:
            ingredient_cost += ingredient_cost_for_menu(menu_id_from_item(item), int(item.get("quantity", item.get("qty", 1)) or 1))
    else:
        oid = order.get("order_id") or order.get("orderId") or order.get("_id")
        if oid is not None:
            for row in db["order_items"].find({"order_id": {"$in": id_variants(oid)}}, {"_id": 0}):
                ingredient_cost += ingredient_cost_for_menu(menu_id_from_item(row), int(row.get("quantity", row.get("qty", 1)) or 1))
    return selling_total, ingredient_cost, max(0.0, selling_total - ingredient_cost)

def calculate_growth(branch_id):
    today = datetime.now().date(); current_start = today - timedelta(days=7); previous_start = today - timedelta(days=14)
    current = previous = 0.0
    for order in db["orders"].find(branch_query(branch_id)):
        if str(order.get("status", "")).lower() not in {"confirmed", "completed", "complete", "paid"}: continue
        dt = order_date(order)
        if not dt: continue
        net = order_financials(order)[2]
        if current_start <= dt.date() <= today: current += net
        elif previous_start <= dt.date() < current_start: previous += net
    if previous == 0: return 100 if current > 0 else 0
    return round((current - previous) / previous * 100, 2)

def normalize_usage(log):
    ingredient_id = log.get("IngredientId") or log.get("ingredient_id")
    name = log.get("IngredientName") or log.get("ingredient_name") or log.get("ingredient")
    if not name or str(name).lower() == "unknown":
        conditions = []
        if ingredient_id is not None:
            conditions = [{"ingredient_id": ingredient_id}, {"ingredient_id": str(ingredient_id)}, {"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}]
        ingredient = db["ingredients"].find_one({"$or": conditions}, {"_id": 0}) if conditions else None
        if ingredient: name = ingredient.get("ingredient_name") or ingredient.get("IngredientName") or ingredient.get("name")
    used = log.get("used", log.get("quantityUsed", log.get("quantity_used", log.get("quantity", 0))))
    remaining = log.get("remaining", log.get("afterStock", log.get("stock_after", 0)))
    return {"ingredient": str(name or ingredient_id or "Unknown"), "ingredientId": ingredient_id, "used": to_float(used), "unit": str(log.get("unit") or log.get("Unit") or "unit"), "beforeStock": to_float(log.get("beforeStock", log.get("before_stock", 0))), "remaining": to_float(remaining), "orderId": str(log.get("orderId") or log.get("order_id") or ""), "date": str(log.get("createdAt") or log.get("created_at") or "")}

def get_inventory_usage(branch_id, limit=10):
    return [normalize_usage(x) for x in db["inventory_transactions"].find(branch_query(branch_id)).sort("createdAt", -1).limit(limit)]

def latest_menu_sold(all_orders):
    candidates = []
    for order in all_orders:
        if str(order.get("status", "")).lower() not in {"confirmed", "completed", "complete", "paid"}: continue
        dt = order_date(order) or datetime.min; items = order.get("items") or []
        if not items:
            oid = order.get("order_id") or order.get("orderId") or order.get("_id")
            if oid is not None: items = list(db["order_items"].find({"order_id": {"$in": id_variants(oid)}}, {"_id": 0}))
        for item in items:
            menu_id = menu_id_from_item(item)
            if menu_id is not None: candidates.append((dt, item, menu_id))
    if not candidates: return None
    _, item, menu_id = max(candidates, key=lambda x: x[0])
    menu = db["menu_items"].find_one({"$or": [{"menu_id": menu_id}, {"menu_id": str(menu_id)}, {"MenuItemId": menu_id}, {"MenuItemId": str(menu_id)}]}, {"_id": 0})
    name = item.get("name") or item.get("menu_name")
    if menu: name = name or menu.get("menu_name") or menu.get("MenuItemName") or menu.get("Description")
    return {"menuId": menu_id, "name": str(name or "Unknown menu"), "quantity": int(item.get("quantity", item.get("qty", 1)) or 1), "image": f"/menu/{menu_id}.jpg"}

def linear_regression_predict(values, horizon=7):
    n = len(values)
    if n == 0: return [0.0] * horizon
    if n == 1: return [round(max(0.0, values[0]), 2)] * horizon
    x = list(range(1, n + 1)); xm = sum(x) / n; ym = sum(values) / n
    den = sum((v - xm) ** 2 for v in x)
    slope = sum((xi - xm) * (yi - ym) for xi, yi in zip(x, values)) / den if den else 0.0
    intercept = ym - slope * xm
    return [round(max(0.0, intercept + slope * (n + i)), 2) for i in range(1, horizon + 1)]

def sales_prediction(branch_id, history_days=30, horizon=7):
    today = datetime.now().date(); start = today - timedelta(days=history_days - 1); daily = defaultdict(float)
    for order in db["orders"].find(branch_query(branch_id)):
        if str(order.get("status", "")).lower() not in {"confirmed", "completed", "complete", "paid"}: continue
        dt = order_date(order)
        if dt and start <= dt.date() <= today: daily[dt.date()] += order_financials(order)[2]
    history = [round(daily[start + timedelta(days=i)], 2) for i in range(history_days)]
    predictions = linear_regression_predict(history, horizon)
    forecast = [{"date": str(today + timedelta(days=i)), "predictedSales": predictions[i]} for i in range(1, horizon + 1)]
    return {"algorithm": "Linear Regression", "historyDays": history_days, "forecastDays": horizon, "historicalSales": history, "forecast": forecast, "nextDay": predictions[0] if predictions else 0.0}

@router.get("/api/branch/dashboard/{branch_id}")
def branch_dashboard(branch_id: str):
    statuses = ["confirmed", "completed", "Confirmed", "Completed", "paid", "Paid"]
    all_orders = list(db["orders"].find({"$and": [branch_query(branch_id), {"status": {"$in": statuses}}]}))
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = [o for o in all_orders if order_date(o) and order_date(o) >= today_start]
    total_revenue = sum(order_financials(o)[2] for o in all_orders); today_revenue = sum(order_financials(o)[2] for o in today_orders)
    items_sold = sum(int(item.get("quantity", item.get("qty", 1)) or 1) for order in all_orders for item in order.get("items", []))
    sales_map = defaultdict(float); week_start = today_start - timedelta(days=6)
    for order in all_orders:
        dt = order_date(order)
        if dt and dt >= week_start: sales_map[dt.strftime("%a")] += order_financials(order)[2]
    weekly_sales = [{"day": d, "sales": round(sales_map[d], 2)} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]
    usage = get_inventory_usage(branch_id, 10); prediction = sales_prediction(branch_id)
    return {"orders": len(today_orders), "totalOrders": len(all_orders), "revenue": round(today_revenue, 2), "totalRevenue": round(total_revenue, 2), "customers": len(today_orders), "itemsSold": items_sold, "growth": calculate_growth(branch_id), "weekly_sales": weekly_sales, "inventory_usage": usage, "inventoryUsage": usage, "current_menu_sold": latest_menu_sold(all_orders), "currentMenuSold": latest_menu_sold(all_orders), "sales_prediction": prediction, "salesPrediction": prediction}

@router.get("/api/branch/dashboard/{branch_id}/sales-prediction")
def branch_sales_prediction(branch_id: str): return sales_prediction(branch_id)

@router.get("/api/dashboard/inventory-usage/{branch_id}")
def inventory_usage(branch_id: str): return {"success": True, "data": get_inventory_usage(branch_id, 20)}
