from collections import defaultdict
from datetime import datetime, timedelta
from fastapi import APIRouter
from database import db

router = APIRouter()


def to_float(value, default=0.0):
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def to_datetime(value):
    if isinstance(value, datetime):
        return value
    if not value:
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m-%d %H:%M:%S"):
            try:
                return datetime.strptime(text, fmt)
            except ValueError:
                pass
    return None


def normalize_status(value):
    return str(value or "").strip().lower().replace(" ", "_")


def branch_matches(order, branch_id):
    if str(branch_id).lower() == "all":
        return True
    values = [order.get("branch_id"), order.get("branchId"), order.get("StoreNumber")]
    return any(v is not None and str(v) == str(branch_id) for v in values)


def item_name(item, menu_lookup):
    name = item.get("menu_name") or item.get("name") or item.get("MenuItemName")
    if name:
        return str(name).strip()
    menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("MenuItemId")
    meta = menu_lookup.get(str(menu_id))
    return meta.get("name", "Unknown") if meta else "Unknown"


@router.get("/api/branch/sales-report/{branch_id}")
def sales_report(branch_id: str):
    # menu_items is the canonical menu collection imported from dataset/menu_items.csv.
    menu_lookup = {}
    for menu in db["menu_items"].find({}, {"_id": 0}):
        menu_id = menu.get("menu_id") or menu.get("MenuItemId")
        if menu_id is not None:
            menu_lookup[str(menu_id)] = {
                "name": str(menu.get("menu_name") or menu.get("MenuItemName") or "Unknown").strip(),
                "category": str(menu.get("category") or "Other").strip() or "Other",
                "price": to_float(menu.get("price") or menu.get("Price")),
            }

    # Dataset orders and newly-created application orders live in the same collection.
    # Accept both schemas and all completed/paid/confirmed variants.
    orders = []
    for order in db["orders"].find({}, {"_id": 0}):
        if not branch_matches(order, branch_id):
            continue
        status = normalize_status(order.get("status"))
        if status not in {"completed", "complete", "paid", "confirmed"}:
            continue
        order["_source"] = "orders"
        orders.append(order)

    # Some older databases used order_details instead of orders. Keep compatibility.
    for order in db["order_details"].find({}, {"_id": 0}):
        if not branch_matches(order, branch_id):
            continue
        status = normalize_status(order.get("status") or "completed")
        if status not in {"completed", "complete", "paid", "confirmed"}:
            continue
        order["_source"] = "order_details"
        orders.append(order)

    order_ids = []
    for order in orders:
        oid = order.get("order_id") or order.get("orderId") or order.get("_id")
        if oid is not None:
            order_ids.append(str(oid))

    order_id_set = set(order_ids)
    order_items_by_order = defaultdict(list)
    for item in db["order_items"].find({}, {"_id": 0}):
        oid = item.get("order_id") or item.get("orderId")
        if oid is not None and str(oid) in order_id_set:
            order_items_by_order[str(oid)].append(item)

    # Also support orders that already contain embedded items (new application orders).
    total_sales = 0.0
    total_orders = 0
    items_sold = 0
    today_sales = 0.0
    top_menu = defaultdict(int)
    by_category = defaultdict(float)
    by_mode = defaultdict(float)
    by_payment = defaultdict(float)
    weekly = defaultdict(float)

    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=6)

    for order in orders:
        total_orders += 1
        oid = str(order.get("order_id") or order.get("orderId") or order.get("_id") or "")
        order_date = to_datetime(order.get("order_date") or order.get("orderDate") or order.get("createdAt") or order.get("created_at"))

        raw_items = order_id_set and order_items_by_order.get(oid, [])
        if not raw_items:
            raw_items = order.get("items") or []

        order_total = to_float(order.get("total_amount") or order.get("totalAmount") or order.get("total"), 0.0)
        calculated_total = 0.0

        for item in raw_items:
            qty = to_float(item.get("quantity") or item.get("qty"), 0.0)
            subtotal = to_float(item.get("subtotal"), qty * to_float(item.get("unit_price") or item.get("price"), 0.0))
            calculated_total += subtotal
            items_sold += int(qty)

            name = item_name(item, menu_lookup)
            top_menu[name] += int(qty)
            menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("MenuItemId")
            meta = menu_lookup.get(str(menu_id), {})
            category = meta.get("category", "Other")
            by_category[category] += subtotal

        # Dataset orders already have total_amount; live orders may have total.
        if order_total <= 0 and calculated_total > 0:
            order_total = calculated_total

        total_sales += order_total

        if order.get("mode"):
            by_mode[str(order["mode"])] += order_total
        if order.get("paymentMethod"):
            by_payment[str(order["paymentMethod"])] += order_total

        if order_date:
            if order_date >= today_start:
                today_sales += order_total
            if order_date >= week_start:
                weekly[order_date.strftime("%a")] += order_total

    weekly_sales = [
        {"day": day, "sales": round(weekly[day], 2)}
        for day in ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    ]

    top_menus = [
        {"name": name, "quantity": qty}
        for name, qty in sorted(top_menu.items(), key=lambda pair: pair[1], reverse=True)[:10]
    ]

    average_order = total_sales / total_orders if total_orders else 0.0
    average_menu_price = (
        sum(meta["price"] for meta in menu_lookup.values() if meta["price"] > 0) /
        sum(1 for meta in menu_lookup.values() if meta["price"] > 0)
        if any(meta["price"] > 0 for meta in menu_lookup.values())
        else 0.0
    )

    return {
        "branchId": branch_id,
        "averageMenuPrice": round(average_menu_price, 2),
        "todaySales": round(today_sales, 2),
        "totalSales": round(total_sales, 2),
        "totalOrders": total_orders,
        "itemsSold": items_sold,
        "averageOrderValue": round(average_order, 2),
        "weeklySales": weekly_sales,
        "topMenus": top_menus,
        "byCategory": [{"name": k, "value": round(v, 2)} for k, v in sorted(by_category.items(), key=lambda x: x[1], reverse=True)],
        "byMode": [{"name": k, "value": round(v, 2)} for k, v in sorted(by_mode.items(), key=lambda x: x[1], reverse=True)],
        "byPayment": [{"name": k, "value": round(v, 2)} for k, v in sorted(by_payment.items(), key=lambda x: x[1], reverse=True)],
    }
