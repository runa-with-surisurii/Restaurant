from database import db
from order_detail_store import save_order_details


def main():
    migrated = 0
    skipped = 0

    for order in db["orders"].find({}):
        order_id = str(order.get("order_id") or order.get("orderId") or order.get("_id"))
        branch_id = order.get("branchId") or order.get("branch_id")

        if db["order_details"].find_one({"order_id": order_id}):
            skipped += 1
            continue

        items = list(db["order_items"].find({"order_id": order_id}, {"_id": 0}))
        if not items:
            items = order.get("items") or []

        before = db["order_details"].count_documents({"order_id": order_id})
        save_order_details(order_id, branch_id, items)
        after = db["order_details"].count_documents({"order_id": order_id})

        if after > before:
            migrated += 1
        else:
            skipped += 1

    print(f"Migration complete: {migrated} orders migrated, {skipped} skipped.")


if __name__ == "__main__":
    main()
