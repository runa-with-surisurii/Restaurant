from fastapi import APIRouter
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter()

def branch_query(branch_id):
    return {"$or": [{"branchId": branch_id}, {"branch_id": branch_id}, {"branchId": str(branch_id)}, {"branch_id": str(branch_id)}]}

def order_date(order):
    value = order.get("confirmedAt") or order.get("createdAt") or order.get("order_date") or order.get("date")
    if isinstance(value, datetime): return value.replace(tzinfo=None) if value.tzinfo else value
    if hasattr(value, "date"): return value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None)
        except Exception: return None
    return None

def menu_cost(menu_id):
    total = 0.0
    for row in db["menu_ingredients"].find({"$or": [{"menu_id": menu_id}, {"menu_id": str(menu_id)}]}):
        ingredient_id = row.get("ingredient_id") or row.get("IngredientId")
        qty = float(row.get("quantity_required", row.get("Quantity", 0)) or 0)
        ingredient = db["ingredients"].find_one({"$or": [{"ingredient_id": ingredient_id}, {"ingredient_id": str(ingredient_id)}, {"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}]})
        if ingredient:
            cost = float(ingredient.get("cost_per_unit", ingredient.get("CostPerUnit", 0)) or 0)
            total += qty * cost
    return total

def order_financials(order):
    sales = 0.0; cost = 0.0
    for item in order.get("items", []):
        qty = float(item.get("quantity", item.get("qty", 1)) or 1)
        price = float(item.get("price", item.get("unit_price", 0)) or 0)
        menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("dishId")
        sales += qty * price
        if menu_id is not None: cost += qty * menu_cost(menu_id)
    if not order.get("items"): sales = float(order.get("total", order.get("total_amount", 0)) or 0)
    return sales, cost, max(0.0, sales - cost)

def get_inventory_usage(branch_id, limit=10):
    rows = list(db["inventory_transactions"].find(branch_query(branch_id)).sort("createdAt", -1).limit(limit))
    return [{"ingredient": row.get("IngredientName") or row.get("ingredient_name") or "Unknown", "used": row.get("used", row.get("Used", 0)), "unit": row.get("unit", row.get("Unit", "")), "remaining": row.get("remaining", row.get("Remaining", 0)), "orderId": row.get("orderId", row.get("order_id", "")), "date": str(row.get("createdAt", row.get("date", "")))} for row in rows]

def recent_menus_sold(orders, limit=2):
    sorted_orders = sorted(orders, key=lambda o: order_date(o) or datetime.min, reverse=True)
    result = []; seen = set()
    for order in sorted_orders:
        for item in order.get("items", []):
            menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("dishId")
            key = str(menu_id or item.get("name") or "unknown")
            if key in seen: continue
            seen.add(key)
            result.append({"menuId": menu_id, "name": item.get("name", "Unknown"), "quantity": int(item.get("quantity", item.get("qty", 1)) or 1), "image": item.get("image") or "/menu/default.png"})
            if len(result) >= limit: return result
    return result

def linear_regression_predict(values, horizon):
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
    forecast = [{"date": str(today + timedelta(days=i)), "predictedSales": predictions[i - 1]} for i in range(1, horizon + 1)]
    return {"algorithm": "Linear Regression", "historyDays": history_days, "forecastDays": horizon, "historicalSales": history, "forecast": forecast, "nextDay": predictions[0] if predictions else 0.0}

def calculate_growth(branch_id):
    """Compare today's confirmed gross sales with yesterday's confirmed gross sales."""
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    current_sales = 0.0
    yesterday_sales = 0.0
    valid_statuses = {"confirmed", "completed", "complete", "paid"}

    for order in db["orders"].find(branch_query(branch_id)):
        if str(order.get("status", "")).strip().lower() not in valid_statuses:
            continue
        dt = order_date(order)
        if not dt:
            continue
        sales = order_financials(order)[0]
        if dt >= today_start:
            current_sales += sales
        elif yesterday_start <= dt < today_start:
            yesterday_sales += sales

    if yesterday_sales <= 0:
        return 0.0
    return round(((current_sales - yesterday_sales) / yesterday_sales) * 100, 2)

@router.get("/api/branch/dashboard/{branch_id}")
def branch_dashboard(branch_id: str):
    statuses = ["confirmed", "completed", "Confirmed", "Completed", "paid", "Paid"]
    all_orders = list(db["orders"].find({"$and": [branch_query(branch_id), {"status": {"$in": statuses}}]}))
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = [o for o in all_orders if order_date(o) and order_date(o) >= today_start]
    total_revenue = sum(order_financials(o)[2] for o in all_orders)
    today_revenue = sum(order_financials(o)[2] for o in today_orders)
    today_sales = sum(order_financials(o)[0] for o in today_orders)
    items_sold = sum(int(item.get("quantity", item.get("qty", 1)) or 1) for order in all_orders for item in order.get("items", []))
    sales_map = defaultdict(float); week_start = today_start - timedelta(days=6)
    for order in all_orders:
        dt = order_date(order)
        if dt and dt >= week_start: sales_map[dt.strftime("%a")] += order_financials(order)[2]
    weekly_sales = [{"day": d, "sales": round(sales_map[d], 2)} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]
    usage = get_inventory_usage(branch_id, 10); prediction = sales_prediction(branch_id); recent_menus = recent_menus_sold(all_orders, 2)
    return {"orders": len(today_orders), "totalOrders": len(all_orders), "revenue": round(today_revenue, 2), "todaySales": round(today_sales, 2), "totalRevenue": round(total_revenue, 2), "customers": len(today_orders), "itemsSold": items_sold, "growth": calculate_growth(branch_id), "weekly_sales": weekly_sales, "inventory_usage": usage, "inventoryUsage": usage, "recent_menus": recent_menus, "recentMenus": recent_menus, "current_menu_sold": recent_menus[0] if recent_menus else None, "currentMenuSold": recent_menus[0] if recent_menus else None, "sales_prediction": prediction, "salesPrediction": prediction}

@router.get("/api/branch/dashboard/{branch_id}/sales-prediction")
def branch_sales_prediction(branch_id: str): return sales_prediction(branch_id)

@router.get("/api/dashboard/inventory-usage/{branch_id}")
def inventory_usage(branch_id: str): return {"success": True, "data": get_inventory_usage(branch_id, 20)}

@router.get("/api/admin/dashboard")
def admin_dashboard():
    """Return weekly admin KPIs and branch ranking from the same MongoDB orders collection used by branch dashboards.

    The weekly window is anchored to the newest order in the database. This is important for the seeded
    dataset, whose dates are historical; using datetime.now() would otherwise make the dashboard show zero.
    """
    valid_statuses = {"confirmed", "completed", "complete", "paid"}
    orders = []
    for order in db["orders"].find({}):
        if str(order.get("status", "")).strip().lower() not in valid_statuses:
            continue
        dt = order_date(order)
        if dt:
            orders.append((order, dt))

    branches = list(db["branches"].find({}, {"_id": 0}))
    branch_names = {}
    for branch in branches:
        bid = str(branch.get("branch_id") or branch.get("branchId") or branch.get("storeNumber") or "")
        branch_names[bid] = branch.get("branch_name") or branch.get("branchName") or branch.get("city") or bid

    if not orders:
        return {"total_orders": 0, "branch_orders": [], "week_start": None, "week_end": None}

    latest_date = max(dt for _, dt in orders)
    week_start = (latest_date - timedelta(days=latest_date.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)

    weekly = [(order, dt) for order, dt in orders if week_start <= dt < week_end]
    counts = defaultdict(int)
    for order, _ in weekly:
        bid = str(order.get("branch_id") or order.get("branchId") or "Unknown")
        counts[bid] += 1

    ranking = [
        {"storeNumber": bid, "orders": count, "branchName": branch_names.get(bid, bid)}
        for bid, count in counts.items()
    ]
    ranking.sort(key=lambda row: (-row["orders"], str(row["storeNumber"])))

    return {
        "total_orders": len(weekly),
        "branch_orders": ranking,
        "week_start": week_start.date().isoformat(),
        "week_end": (week_end - timedelta(days=1)).date().isoformat(),
    }
