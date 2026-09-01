from fastapi import APIRouter
from database import db
from datetime import datetime, timedelta
from collections import defaultdict

router = APIRouter()


def branch_query(branch_id):
    return {"$or": [{"branchId": branch_id}, {"branch_id": branch_id}, {"branchId": str(branch_id)}, {"branch_id": str(branch_id)}]}


def order_date(order):
    value = order.get("confirmedAt") or order.get("createdAt") or order.get("order_date") or order.get("date")
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if hasattr(value, "date"):
        return value
    if isinstance(value, str):
        try:
            parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
            return parsed.replace(tzinfo=None)
        except Exception:
            return None
    return None


def get_order_items(order):
    """Load items from embedded items, order_items, or orders_details."""
    items = order.get("items") or []
    if items:
        return items

    oid = order.get("order_id") or order.get("orderId") or order.get("_id")
    oid_str = str(oid) if oid is not None else None
    if oid_str:
        items = list(db["order_items"].find({"$or": [{"order_id": oid_str}, {"orderId": oid_str}]}, {"_id": 0}))
        if items:
            return items

        details = list(db["orders_details"].find({"$or": [
            {"OrderId": oid_str},
            {"order_id": oid_str},
            {"OrderId": oid},
        ]}, {"_id": 0}))
        if details:
            return [detail_to_item(row) for row in details]
    return []


def detail_to_item(row):
    return {
        "menu_id": row.get("MenuId") or row.get("menu_id") or row.get("MenuItemId"),
        "name": row.get("Description") or row.get("description") or row.get("menu_name") or "Unknown",
        "quantity": row.get("Quantity", row.get("quantity", row.get("qty", 1))),
        "price": row.get("Price", row.get("price", row.get("unit_price", 0))),
        "total": row.get("Total", row.get("total", row.get("subtotal", 0))),
        "image": row.get("image"),
    }


def all_order_reference_keys():
    keys = set()
    for order in db["orders"].find({}, {"_id": 1, "order_id": 1, "orderId": 1}):
        for value in (order.get("_id"), order.get("order_id"), order.get("orderId")):
            if value is not None:
                keys.add(str(value))
    return keys


def get_orphan_order_details(branch_id):
    """Return detail rows that belong to a branch but are not represented by an orders record.

    This handles the project's normalized orders_details dataset, where a detail row may contain
    StoreNumber + OrderId + date while the parent order is missing from the orders collection.
    """
    known = all_order_reference_keys()
    rows = list(db["orders_details"].find({"$or": [
        {"StoreNumber": str(branch_id)},
        {"storeNumber": str(branch_id)},
        {"branch_id": str(branch_id)},
        {"branchId": str(branch_id)},
    ]))
    return [row for row in rows if str(row.get("OrderId") or row.get("order_id") or "") not in known]


def detail_date(row):
    value = row.get("date") or row.get("createdAt") or row.get("order_date")
    if isinstance(value, datetime):
        return value.replace(tzinfo=None) if value.tzinfo else value
    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except Exception:
            return None
    return None


def detail_sales(row):
    total = row.get("Total", row.get("total", row.get("subtotal")))
    if total not in (None, ""):
        return float(total or 0)
    qty = float(row.get("Quantity", row.get("quantity", row.get("qty", 1))) or 1)
    price = float(row.get("Price", row.get("price", row.get("unit_price", 0))) or 0)
    return qty * price


def menu_cost(menu_id):
    total = 0.0
    for row in db["menu_ingredients"].find({"$or": [{"menu_id": menu_id}, {"menu_id": str(menu_id)}]}):
        ingredient_id = row.get("ingredient_id") or row.get("IngredientId")
        qty = float(row.get("quantity_required", row.get("Quantity", 0)) or 0)
        ingredient = db["ingredients"].find_one({"$or": [
            {"ingredient_id": ingredient_id}, {"ingredient_id": str(ingredient_id)},
            {"IngredientId": ingredient_id}, {"IngredientId": str(ingredient_id)}
        ]})
        if ingredient:
            cost = float(ingredient.get("cost_per_unit", ingredient.get("CostPerUnit", 0)) or 0)
            total += qty * cost
    return total


def order_financials(order):
    sales = 0.0
    cost = 0.0
    items = get_order_items(order)
    for item in items:
        qty = float(item.get("quantity", item.get("qty", 1)) or 1)
        price = float(item.get("price", item.get("unit_price", 0)) or 0)
        total = float(item.get("total", item.get("subtotal", 0)) or 0)
        sales += total if total > 0 else qty * price
        menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("dishId")
        if menu_id is not None:
            cost += qty * menu_cost(menu_id)
    if not items:
        sales = float(order.get("total", order.get("total_amount", 0)) or 0)
    return sales, cost, max(0.0, sales - cost)


def get_inventory_usage(branch_id, limit=10):
    rows = list(db["inventory_transactions"].find(branch_query(branch_id)).sort("createdAt", -1).limit(limit))
    return [{"ingredient": row.get("IngredientName") or row.get("ingredient_name") or "Unknown", "used": row.get("used", row.get("Used", 0)), "unit": row.get("unit", row.get("Unit", "")), "remaining": row.get("remaining", row.get("Remaining", 0)), "orderId": row.get("orderId", row.get("order_id", "")), "date": str(row.get("createdAt", row.get("date", "")))} for row in rows]


def recent_menus_sold(orders, limit=2, branch_id=None):
    sorted_orders = sorted(orders, key=lambda o: order_date(o) or datetime.min, reverse=True)
    result = []
    seen = set()
    for order in sorted_orders:
        for item in get_order_items(order):
            menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("dishId")
            key = str(menu_id or item.get("name") or "unknown")
            if key in seen:
                continue
            seen.add(key)
            result.append({"menuId": menu_id, "name": item.get("name") or item.get("menu_name") or "Unknown", "quantity": int(item.get("quantity", item.get("qty", 1)) or 1), "image": item.get("image") or "/menu/default.png"})
            if len(result) >= limit:
                return result

    if branch_id:
        rows = sorted(get_orphan_order_details(branch_id), key=lambda r: detail_date(r) or datetime.min, reverse=True)
        for row in rows:
            menu_id = row.get("MenuId") or row.get("menu_id") or row.get("MenuItemId")
            key = str(menu_id or row.get("Description") or "unknown")
            if key in seen:
                continue
            seen.add(key)
            result.append({"menuId": menu_id, "name": row.get("Description") or row.get("description") or "Unknown", "quantity": int(row.get("Quantity", row.get("quantity", 1)) or 1), "image": row.get("image") or "/menu/default.png"})
            if len(result) >= limit:
                return result
    return result


def linear_regression_predict(values, horizon):
    n = len(values)
    if n == 0:
        return [0.0] * horizon
    if n == 1:
        return [round(max(0.0, values[0]), 2)] * horizon
    x = list(range(1, n + 1))
    xm = sum(x) / n
    ym = sum(values) / n
    den = sum((v - xm) ** 2 for v in x)
    slope = sum((xi - xm) * (yi - ym) for xi, yi in zip(x, values)) / den if den else 0.0
    intercept = ym - slope * xm
    return [round(max(0.0, intercept + slope * (n + i)), 2) for i in range(1, horizon + 1)]


def sales_prediction(branch_id, history_days=30, horizon=7):
    valid_statuses = {"confirmed", "completed", "complete", "paid"}
    branch_orders = []
    for order in db["orders"].find(branch_query(branch_id)):
        if str(order.get("status", "")).strip().lower() not in valid_statuses:
            continue
        dt = order_date(order)
        if dt:
            branch_orders.append((order, dt))

    anchor_date = max((dt for _, dt in branch_orders), default=datetime.now()).date()
    start = anchor_date - timedelta(days=history_days - 1)
    daily = defaultdict(float)
    for order, dt in branch_orders:
        if start <= dt.date() <= anchor_date:
            daily[dt.date()] += order_financials(order)[2]

    history = [round(daily[start + timedelta(days=i)], 2) for i in range(history_days)]
    predictions = linear_regression_predict(history, horizon)
    forecast = [{"date": str(anchor_date + timedelta(days=i)), "predictedSales": predictions[i - 1]} for i in range(1, horizon + 1)]
    return {"algorithm": "Linear Regression", "historyDays": history_days, "forecastDays": horizon, "anchorDate": str(anchor_date), "historicalSales": history, "forecast": forecast, "nextDay": predictions[0] if predictions else 0.0}


def calculate_growth(branch_id):
    """Compare today's sales with yesterday's sales using orders first and orphan order details when needed."""
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    valid_statuses = {"confirmed", "completed", "complete", "paid"}
    today_sales = 0.0
    yesterday_sales = 0.0

    for order in db["orders"].find(branch_query(branch_id)):
        if str(order.get("status", "")).strip().lower() not in valid_statuses:
            continue
        dt = order_date(order)
        if not dt:
            continue
        sales = order_financials(order)[0]
        if dt >= today_start:
            today_sales += sales
        elif yesterday_start <= dt < today_start:
            yesterday_sales += sales

    orphan_rows = get_orphan_order_details(branch_id)
    order_today_ids = {str(o.get("_id") or o.get("order_id") or o.get("orderId")) for o in db["orders"].find(branch_query(branch_id))}
    for row in orphan_rows:
        rid = str(row.get("OrderId") or row.get("order_id") or "")
        if rid in order_today_ids:
            continue
        dt = detail_date(row)
        if not dt:
            continue
        if dt >= today_start:
            today_sales += detail_sales(row)
        elif yesterday_start <= dt < today_start:
            yesterday_sales += detail_sales(row)

    if yesterday_sales <= 0:
        return 0.0
    return round(((today_sales - yesterday_sales) / yesterday_sales) * 100, 2)


@router.get("/api/branch/dashboard/{branch_id}")
def branch_dashboard(branch_id: str):
    valid_statuses = {"confirmed", "completed", "complete", "paid"}
    all_orders = [o for o in db["orders"].find(branch_query(branch_id)) if str(o.get("status", "")).strip().lower() in valid_statuses]
    today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = [o for o in all_orders if order_date(o) and order_date(o) >= today_start]

    total_revenue = sum(order_financials(o)[2] for o in all_orders)
    today_revenue = sum(order_financials(o)[2] for o in today_orders)
    today_sales = sum(order_financials(o)[0] for o in today_orders)

    orphan_rows = get_orphan_order_details(branch_id)
    today_detail_rows = [r for r in orphan_rows if detail_date(r) and detail_date(r) >= today_start]
    yesterday_start = today_start - timedelta(days=1)
    yesterday_detail_rows = [r for r in orphan_rows if detail_date(r) and yesterday_start <= detail_date(r) < today_start]
    today_sales += sum(detail_sales(r) for r in today_detail_rows)
    today_revenue += sum(detail_sales(r) for r in today_detail_rows)
    total_revenue += sum(detail_sales(r) for r in orphan_rows)

    items_sold = sum(int(item.get("quantity", item.get("qty", 1)) or 1) for order in all_orders for item in get_order_items(order))
    items_sold += sum(int(r.get("Quantity", r.get("quantity", 1)) or 1) for r in orphan_rows)

    sales_map = defaultdict(float)
    week_start = today_start - timedelta(days=6)
    for order in all_orders:
        dt = order_date(order)
        if dt and dt >= week_start:
            sales_map[dt.strftime("%a")] += order_financials(order)[2]
    for row in orphan_rows:
        dt = detail_date(row)
        if dt and dt >= week_start:
            sales_map[dt.strftime("%a")] += detail_sales(row)
    weekly_sales = [{"day": d, "sales": round(sales_map[d], 2)} for d in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]]

    usage = get_inventory_usage(branch_id, 10)
    prediction = sales_prediction(branch_id)
    recent_menus = recent_menus_sold(all_orders, 2, branch_id)
    growth = calculate_growth(branch_id)

    return {
        "orders": len(today_orders) + len({str(r.get('OrderId') or r.get('order_id')) for r in today_detail_rows if r.get('OrderId') or r.get('order_id')}),
        "totalOrders": len(all_orders),
        "revenue": round(today_revenue, 2),
        "todaySales": round(today_sales, 2),
        "totalRevenue": round(total_revenue, 2),
        "customers": len(today_orders),
        "itemsSold": items_sold,
        "growth": growth,
        "weekly_sales": weekly_sales,
        "inventory_usage": usage,
        "inventoryUsage": usage,
        "recent_menus": recent_menus,
        "recentMenus": recent_menus,
        "current_menu_sold": recent_menus[0] if recent_menus else None,
        "currentMenuSold": recent_menus[0] if recent_menus else None,
        "sales_prediction": prediction,
        "salesPrediction": prediction,
    }


@router.get("/api/branch/dashboard/{branch_id}/sales-prediction")
def branch_sales_prediction(branch_id: str):
    return sales_prediction(branch_id)


@router.get("/api/dashboard/inventory-usage/{branch_id}")
def inventory_usage(branch_id: str):
    return {"success": True, "data": get_inventory_usage(branch_id, 20)}


@router.get("/api/admin/dashboard")
def admin_dashboard():
    """Return weekly admin KPIs and branch ranking from the same MongoDB orders collection."""
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

    ranking = [{"storeNumber": bid, "orders": count, "branchName": branch_names.get(bid, bid)} for bid, count in counts.items()]
    ranking.sort(key=lambda row: (-row["orders"], str(row["storeNumber"])))
    return {"total_orders": len(weekly), "branch_orders": ranking, "week_start": week_start.date().isoformat(), "week_end": (week_end - timedelta(days=1)).date().isoformat()}
