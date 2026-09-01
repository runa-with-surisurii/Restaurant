from database import db


def save_order_details(order_id, branch_id, items):
    """Persist one order line per item in order_details without creating duplicates."""
    order_id = str(order_id)
    existing = db["order_details"].find_one({"order_id": order_id})
    if existing:
        return

    docs = []
    for item in items or []:
        qty = int(item.get("quantity", item.get("qty", 1)) or 1)
        price = float(item.get("price", item.get("unit_price", 0)) or 0)
        menu_id = item.get("menu_id") or item.get("menuItemId") or item.get("dishId")
        name = item.get("name") or item.get("menu_name") or "Unknown menu item"
        docs.append({
            "order_id": order_id,
            "orderId": order_id,
            "branch_id": branch_id,
            "branchId": branch_id,
            "menu_id": menu_id,
            "menuItemId": menu_id,
            "menu_name": name,
            "name": name,
            "quantity": qty,
            "unit_price": price,
            "price": price,
            "subtotal": qty * price,
            "cost_price": float(item.get("costPrice", item.get("cost_price", 0)) or 0),
        })

    if docs:
        db["order_details"].insert_many(docs)
