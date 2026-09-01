from database import db


def save_order_details(order_id, branch_id, items=None):
    """Keep order_details synchronized with the order's actual line items.

    The order API can receive items in either the checkout format or the
    order_items format.  If the caller does not provide items, fall back to
    order_items so confirmation of an existing order is also persisted.
    """
    order_id = str(order_id)

    source_items = list(items or [])
    if not source_items:
        source_items = list(
            db["order_items"].find(
                {"order_id": order_id},
                {"_id": 0}
            )
        )

    if not source_items:
        return {"saved": 0, "order_id": order_id}

    docs = []
    for index, item in enumerate(source_items):
        item = dict(item or {})

        qty = int(
            item.get("quantity", item.get("qty", item.get("Quantity", 1))) or 1
        )
        price = float(
            item.get(
                "unit_price",
                item.get("price", item.get("Price", 0))
            ) or 0
        )

        menu_id = (
            item.get("menu_id")
            or item.get("menuItemId")
            or item.get("MenuItemId")
            or item.get("dishId")
        )
        name = (
            item.get("menu_name")
            or item.get("name")
            or item.get("Description")
            or "Unknown menu item"
        )
        subtotal = float(
            item.get("subtotal", item.get("Total", qty * price)) or 0
        )
        cost_price = float(
            item.get("cost_price", item.get("costPrice", 0)) or 0
        )

        docs.append({
            "order_id": order_id,
            "orderId": order_id,
            "branch_id": branch_id,
            "branchId": branch_id,
            "menu_id": menu_id,
            "menuItemId": menu_id,
            "menu_name": str(name),
            "name": str(name),
            "quantity": qty,
            "unit_price": price,
            "price": price,
            "subtotal": subtotal,
            "cost_price": cost_price,
            "line_no": index + 1,
        })

    if not docs:
        return {"saved": 0, "order_id": order_id}

    # Replace this order's detail lines atomically at the application level.
    # This fixes partially-created records and prevents duplicate detail rows
    # when the order is confirmed more than once.
    db["order_details"].delete_many({"order_id": order_id})
    db["order_details"].insert_many(docs)

    return {"saved": len(docs), "order_id": order_id}
