"""Backfill and repair order_details from existing orders/order_items data.

Run once from the backend directory:
    python migrate_order_details.py
"""

from database import db
from order_detail_store import save_order_details


def main():
    migrated = 0
    skipped = 0
    lines = 0

    for order in db["orders"].find({}):
        order_id = str(
            order.get("order_id")
            or order.get("orderId")
            or order.get("_id")
            or ""
        )
        if not order_id:
            skipped += 1
            continue

        branch_id = order.get("branchId") or order.get("branch_id")

        items = list(
            db["order_items"].find(
                {"order_id": order_id},
                {"_id": 0}
            )
        )
        if not items:
            items = order.get("items") or []

        result = save_order_details(order_id, branch_id, items)
        saved = int(result.get("saved", 0) or 0)

        if saved > 0:
            migrated += 1
            lines += saved
        else:
            skipped += 1

    print(
        f"Migration complete: {migrated} orders repaired, "
        f"{lines} detail lines written, {skipped} skipped."
    )


if __name__ == "__main__":
    main()
