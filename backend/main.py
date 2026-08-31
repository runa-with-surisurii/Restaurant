from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from collections import defaultdict
from datetime import datetime, timedelta
import math
import pandas as pd
from mlxtend.frequent_patterns import association_rules as mlxtend_association_rules, fpgrowth
from orders import router as order_router
from branch_dashboard import router as branch_dashboard_router
from branch_inventory import router as branch_inventory_router
from database import client, db
from sales_report import router as sales_report_router

app = FastAPI(
    title="Ember & Oak Restaurant API",
    version="1.0.0"
)

# ============================================================
# CORS
# ============================================================

app.add_middleware(
    CORSMiddleware,

    allow_origins=[

        "http://localhost:8080",
        "http://localhost:8081",
        "http://localhost:8082",
        "http://localhost:5173",
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",
        "http://127.0.0.1:8082",
        "http://127.0.0.1:5173",

    ],

    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# ROUTES
# ============================================================

app.include_router(
    branch_dashboard_router
)

app.include_router(
    order_router
)

app.include_router(
    branch_inventory_router
)

app.include_router(
    sales_report_router
)
# ============================================================
# ROOT
# ============================================================

@app.get("/")
def root():

    return {

        "message":
        "Ember & Oak API is running"

    }

# ============================================================
# HEALTH
# ============================================================

@app.get("/api/health")
def health():

    try:

        client.admin.command("ping")

        return {
            "status":"ok",
            "mongodb":"connected",
            "database":"restaurant_db"
        }

    except Exception as e:
        return {
            "status":"error",
            "error":str(e)
        }

# ============================================================
# MENU
# ============================================================

@app.get("/api/menu")
def get_menu(branch_id: str | None = None):

    menu_collection = db["menu_items"]
    price_collection = db["menuitem"]

    # ========================================================
    # PRICE MAP
    # ========================================================

    price_map = {}

    for p in price_collection.find(
        {},
        {
            "_id":0,
            "PLU":1,
            "Price":1
        }
    ):

        if p.get("PLU"):
            price_map[p["PLU"]] = p.get(
                "Price",
                0
            )

    # ========================================================
    # MENU DATA
    # ========================================================

    items = list(
        menu_collection.find(
            {"branch_id": branch_id} if branch_id else {},
            {
                "_id":0
            }
        )
    )
    result = []

    for item in items:
        name = str(item.get("menu_name") or item.get("MenuItemName") or "").strip()

        description = str(item.get("description") or item.get("MenuItemDescription") or "").strip()

        text = (
            f"{name} {description}"
        ).lower()

        # ====================================================
        # IMPROVED CATEGORY
        # ====================================================

        category = str(item.get("category") or "Other").strip()

        # Sandwiches
        if not item.get("category") and any(
            word in text
            for word in [

                "ham",
                "turkey",
                "bmt",
                "b.m.t",
                "blt",
                "club",
                "sub",
                "ftl",
                "ftlong",
                "6 inch",
                "flatbd",
                "flatbread",
                "sandwich",
                "chicken teriyaki",
                "chxtry",
                "bbq rib",
                "bqrib",
                "philly",
                "steak"
            ]
        ):
            category = "Sandwiches"

        # Burgers

        elif not item.get("category") and any(
            word in text
            for word in [
                "burger",
                "hamburger",
                "cheeseburger",
                "cheese burger"
            ]
        ):
            category = "Burgers"

        # Pizza

        elif not item.get("category") and any(
            word in text
            for word in [
                "pizza",
                "pepperoni"
            ]
        ):
            category = "Pizza"

        # Salads

        elif not item.get("category") and any(
            word in text
            for word in [
                "salad",
                "veggie bowl"
            ]
        ):
            category = "Salads"

        # Desserts
        elif not item.get("category") and any(
            word in text
            for word in [

                "cookie",
                "cake",
                "brownie",
                "dessert",
                "ice cream",
                "icecream"
            ]
        ):
            category = "Desserts"

        # ====================================================
        # PRICE
        # ====================================================

        plu = item.get("PLU")
        price = item.get("price", price_map.get(plu, 0))
        try:
            price = float(price)
        except:
            price = 0

        # ====================================================
        # RESPONSE
        # ====================================================

        result.append({

            "id": item.get("menu_id") or item.get("MenuItemId"),
            "name": name,
            "description": description,
            "plu": plu,
            "recipeId": item.get(
                "RecipeId"
            ),
            "category": category,
            "price": price,
            "costPrice": float(item.get("cost_price") or 0),
            "availableStatus": item.get("available_status") or "Available",
            "image": item.get("image") or f"/menu/{item.get('menu_id') or item.get('MenuItemId')}.jpg"
        })
    return result

# ============================================================
# CATEGORY API
# ============================================================

@app.get("/api/menu/categories")
def get_menu_categories():
    values = db["menu_items"].distinct("category")
    return [{"id": "all", "name": "All", "emoji": "🍽️"}] + [
        {"id": str(value).lower(), "name": str(value), "emoji": "🍴"}
        for value in values if value
    ]

@app.get("/api/menu/{branch_id}")
def get_menu_by_branch(branch_id: str):
    return get_menu(branch_id)

# ============================================================
# OTHER DATA
# ============================================================

@app.get("/api/branches")
def get_branches():

    branches = list(
        db["branches"].find(
            {},
            {"_id":0}
        )
    )

    result=[]

    for b in branches:
        result.append({

            "branchId": b.get("branch_id"),
            "branchName": b.get("branch_name", "").strip(),

            "city": b.get(
                "city",
                ""
            ).strip(),

            "state": b.get("state", "").strip(),

        })

    return result

@app.get("/api/ingredients")
def get_ingredients():

    ingredients = list(
        db["ingredients"].find({})
    )

    result = []

    for item in ingredients:
        result.append({

            "IngredientId": item.get("ingredient_id") or item.get("IngredientId"),

            "IngredientName": item.get(
                "ingredient_name",
                item.get("IngredientName", "")
            ).strip(),

            "Stock": item.get(
                "unit_cost",
                item.get("Stock", 0)
            ),

            "Unit": item.get(
                "Unit",
                ""
            )

        })
    return result

@app.get("/api/recipes")
def get_recipes():

    return list(
        db["recipes"].find(
            {},
            {"_id":0}
        )
    )

@app.get("/api/orders")
def get_live_orders():
    orders = list(
        db["orders"].find({})
    )
    for order in orders:
        order["_id"] = str(order["_id"])
    return orders

# ============================================================
# STARTUP
# ============================================================


@app.on_event("startup")
def startup_event():

    try:

        client.admin.command("ping")

        print("==============================")
        print("Ember & Oak API Started")
        print("MongoDB Connected")
        print("Database: restaurant_db")
        print("==============================")

    except Exception as e:

        print("MongoDB connection failed")
        print(e)

# ============================================================
# ANALYTICS - SALES OVERVIEW
# ============================================================

@app.get("/api/menu-insights")
def menu_insights(
    branch_id: str = "all",
    min_support: float = 0.0005,
    min_confidence: float = 0.04,
    min_lift: float = 1.0,
    max_rules: int = 10,
):
    branches = list(db["branches"].find({}, {"_id": 0}))
    menu_items = list(db["menu_items"].find({}, {"_id": 0}))
    orders = list(db["orders"].find({}, {"_id": 0}))
    order_items = list(db["order_items"].find({}, {"_id": 0}))

    def to_float(value, default=0.0):
        try:
            return float(value) if value is not None else default
        except (TypeError, ValueError):
            return default

    def normalize_status(value):
        return str(value or "").strip().lower()

    selected_orders = {}
    for order in orders:
        order_status = normalize_status(order.get("status"))
        if order_status not in {"completed", "complete", "paid", "confirmed"}:
            continue

        order_branch = order.get("branch_id")
        if order_branch is None:
            order_branch = order.get("branchId")

        if branch_id != "all" and str(order_branch) != str(branch_id):
            continue

        order_key = str(order.get("order_id") or order.get("_id") or "")
        if order_key:
            selected_orders[order_key] = order

    menu_lookup = {}
    for item in menu_items:
        menu_id = str(item.get("menu_id"))
        if branch_id == "all" or str(item.get("branch_id")) == branch_id:
            menu_lookup[menu_id] = {
                "menuId": menu_id,
                "menu": str(item.get("menu_name") or "Unknown menu").strip(),
                "category": str(item.get("category") or "Other").strip() or "Other",
                "cost_price": to_float(item.get("cost_price"), 0.0),
                "branch_id": str(item.get("branch_id")),
                "image": str(item.get("image") or f"/menu/{menu_id}.jpg"),
            }

    menu_stats = {
        menu_id: {
            "menuId": meta["menuId"],
            "menu": meta["menu"],
            "category": meta["category"],
            "image": meta["image"],
            "sold": 0.0,
            "revenue": 0.0,
            "estimated_cost": 0.0,
            "orders": set(),
            "recent": 0.0,
            "previous": 0.0,
            "growth": None,
            "group": "Steady Performers",
            "trend": "No trend data",
            "action": "Monitor",
            "score": 0.0,
            "profit": 0.0,
            "profitMargin": 0.0,
        }
        for menu_id, meta in menu_lookup.items()
    }

    basket_by_order = defaultdict(set)
    order_dates = []
    for order_id, order in selected_orders.items():
        order_date = order.get("order_date")
        if order_date:
            try:
                order_dates.append(datetime.fromisoformat(str(order_date)))
            except ValueError:
                pass

    latest = max(order_dates) if order_dates else datetime.now()
    split = latest - timedelta(days=30)
    previous_split = latest - timedelta(days=60)

    for order_item in order_items:
        order_id = str(order_item.get("order_id"))
        order = selected_orders.get(order_id)
        if not order:
            continue

        menu_id = str(order_item.get("menu_id"))
        menu_meta = menu_lookup.get(menu_id)
        if not menu_meta:
            continue

        quantity = to_float(order_item.get("quantity"), 0.0)
        subtotal = to_float(order_item.get("subtotal"), quantity * to_float(order_item.get("unit_price"), 0.0))
        cost_price = menu_meta["cost_price"]
        menu_stat = menu_stats[menu_id]

        menu_stat["sold"] += quantity
        menu_stat["revenue"] += subtotal
        menu_stat["estimated_cost"] += quantity * cost_price
        menu_stat["orders"].add(order_id)
        basket_by_order[order_id].add(menu_meta["menu"])

        try:
            order_date = datetime.fromisoformat(str(order.get("order_date")))
        except (TypeError, ValueError):
            continue

        if order_date >= split:
            menu_stat["recent"] += quantity
        elif order_date >= previous_split:
            menu_stat["previous"] += quantity

    total_quantity = sum(row["sold"] for row in menu_stats.values())
    total_revenue = sum(row["revenue"] for row in menu_stats.values())
    total_profit = sum(row["revenue"] - row["estimated_cost"] for row in menu_stats.values())

    rows = []
    for menu_id, stat in menu_stats.items():
        revenue = stat["revenue"]
        quantity = stat["sold"]
        profit = revenue - stat["estimated_cost"]
        stat["profit"] = profit
        stat["profitMargin"] = (profit / revenue * 100) if revenue else 0.0
        if stat["previous"] > 0:
            stat["growth"] = ((stat["recent"] - stat["previous"]) / stat["previous"]) * 100
        else:
            stat["growth"] = None

        share_of_quantity = (quantity / total_quantity * 100) if total_quantity else 0.0
        share_of_revenue = (revenue / total_revenue * 100) if total_revenue else 0.0
        score = (share_of_quantity * 0.55) + (share_of_revenue * 0.45)
        stat["score"] = score

        rows.append({
            "menuId": menu_id,
            "menu": stat["menu"],
            "category": stat["category"],
            "image": stat["image"],
            "sold": quantity,
            "revenue": revenue,
            "orders": len(stat["orders"]),
            "recent": stat["recent"],
            "previous": stat["previous"],
            "growth": stat["growth"],
            "score": score,
            "profit": profit,
            "profitMargin": stat["profitMargin"],
            "shareOfQuantity": share_of_quantity,
            "shareOfRevenue": share_of_revenue,
            "group": "Steady Performers",
            "trend": "No trend data",
            "action": "Monitor",
        })

    if rows:
        ranked = sorted(rows, key=lambda row: (row["revenue"], row["sold"]), reverse=True)
        cutoff = max(1, int(math.ceil(len(ranked) * 0.35)))
        best_ids = {row["menuId"] for row in ranked[:cutoff]}
        attention_ids = {row["menuId"] for row in ranked[-cutoff:]}

        for row in rows:
            if row["menuId"] in best_ids:
                row["group"] = "Best Sellers"
                row["action"] = "Keep & Promote"
            elif row["menuId"] in attention_ids:
                row["group"] = "Needs Attention"
                row["action"] = "Review / Improve"
            else:
                row["group"] = "Steady Performers"
                row["action"] = "Monitor"

            if row["growth"] is not None:
                row["trend"] = f"{row['growth']:+.1f}% Sales Growth"
            else:
                row["trend"] = f"{row['shareOfQuantity']:.1f}% of quantity sold"

    rows.sort(key=lambda row: row["score"], reverse=True)
    group_names = ["Best Sellers", "Steady Performers", "Needs Attention"]
    groups_response = []
    for name in group_names:
        members = [row for row in rows if row["group"] == name]
        groups_response.append({
            "name": name,
            "count": len(members),
            "example": members[0]["menu"] if members else None,
        })

    trending = [
        row for row in sorted(rows, key=lambda row: (row["growth"] is not None, row["growth"] or 0), reverse=True)
        if row["growth"] is not None
    ][:6]

    total_transactions = len(selected_orders)
    if total_transactions <= 0:
        association_rules = []
    else:
        transactions = [tuple(sorted(basket)) for basket in basket_by_order.values() if len(basket) > 1]
        if not transactions:
            association_rules = []
        else:
            all_items = sorted({item for transaction in transactions for item in transaction})
            frame = pd.DataFrame(
                [
                    {item: bool(item in transaction) for item in all_items}
                    for transaction in transactions
                ],
                dtype=bool,
            )

            frequent_itemsets = fpgrowth(frame, min_support=min_support, use_colnames=True)
            if frequent_itemsets.empty:
                association_rules = []
            else:
                rule_frame = mlxtend_association_rules(
                    frequent_itemsets,
                    metric="lift",
                    min_threshold=min_lift,
                )
                rule_frame = rule_frame[
                    (rule_frame["support"] >= min_support)
                    & (rule_frame["confidence"] >= min_confidence)
                    & (rule_frame["lift"] >= min_lift)
                ]
                rule_frame = rule_frame.sort_values(
                    ["lift", "confidence", "support"],
                    ascending=False,
                ).head(max_rules)

                association_rules = []
                seen_itemsets = set()
                for _, row in rule_frame.iterrows():
                    itemset = tuple(sorted(set(list(row["antecedents"]) + list(row["consequents"]))))
                    if itemset in seen_itemsets:
                        continue
                    seen_itemsets.add(itemset)

                    rule_text = " + ".join(itemset)
                    association_rules.append({
                        "antecedent": list(itemset),
                        "consequent": [],
                        "support": round(float(row["support"]) * 100, 3),
                        "confidence": round(float(row["confidence"]) * 100, 3),
                        "lift": round(float(row["lift"]), 3),
                        "rule": rule_text,
                    })

    category_breakdown = []
    category_totals = defaultdict(lambda: {"revenue": 0.0, "quantity": 0.0, "profit": 0.0})
    for row in rows:
        bucket = category_totals[row["category"]]
        bucket["revenue"] += row["revenue"]
        bucket["quantity"] += row["sold"]
        bucket["profit"] += row["profit"]

    for category, totals in sorted(category_totals.items()):
        category_breakdown.append({
            "category": category,
            "revenue": totals["revenue"],
            "quantity": totals["quantity"],
            "profit": totals["profit"],
            "margin": (totals["profit"] / totals["revenue"] * 100) if totals["revenue"] else 0.0,
        })

    category_breakdown.sort(key=lambda item: item["revenue"], reverse=True)

    branch_summary = []
    if branch_id == "all":
        branch_map = defaultdict(lambda: {"revenue": 0.0, "quantity": 0.0, "profit": 0.0, "orders": 0})
        for order in selected_orders.values():
            branch_id_value = str(order.get("branch_id") or order.get("branchId") or "")
            branch_map[branch_id_value]["orders"] += 1
        for order_item in order_items:
            order = selected_orders.get(str(order_item.get("order_id")))
            if not order:
                continue
            menu_id = str(order_item.get("menu_id"))
            menu_meta = menu_lookup.get(menu_id)
            if not menu_meta:
                continue
            branch_value = str(order.get("branch_id") or order.get("branchId") or "")
            qty = to_float(order_item.get("quantity"), 0.0)
            subtotal = to_float(order_item.get("subtotal"), qty * to_float(order_item.get("unit_price"), 0.0))
            cost = qty * to_float(menu_meta.get("cost_price"), 0.0)
            bucket = branch_map[branch_value]
            bucket["revenue"] += subtotal
            bucket["quantity"] += qty
            bucket["profit"] += (subtotal - cost)
        for branch_name, values in sorted(branch_map.items()):
            branch_summary.append({
                "branchId": branch_name,
                "branchName": next((branch.get("branch_name") for branch in branches if str(branch.get("branch_id")) == branch_name), branch_name),
                "revenue": values["revenue"],
                "quantity": values["quantity"],
                "profit": values["profit"],
            })

    return {
        "branches": [{
            "id": str(branch.get("branch_id")),
            "name": str(branch.get("branch_name") or "Unknown branch"),
            "city": str(branch.get("city") or "")
        } for branch in branches],
        "selectedBranch": branch_id,
        "hasProfit": True,
        "summary": {
            "totalRevenue": total_revenue,
            "totalQuantity": total_quantity,
            "estimatedProfit": total_profit,
            "orders": len(selected_orders),
        },
        "groups": groups_response,
        "rows": rows,
        "trending": trending,
        "associationRules": association_rules,
        "categoryBreakdown": category_breakdown,
        "branchBreakdown": branch_summary,
    }
# ============================================================
# ANALYTICS DASHBOARD
# ============================================================

@app.get("/api/analytics/dashboard")
def analytics_dashboard():

    collection = db["order_details"]


    data = list(
        collection.find(
            {},
            {
                "_id": 0,
                "Description": 1,
                "CategoryDescription": 1,
                "StoreNumber": 1,
                "Price": 1,
                "AdjustedPrice": 1,
                "Quantity": 1,
                "date": 1
            }
        )
    )

    total_sales = 0
    total_quantity = 0

    menu_sales = defaultdict(float)
    menu_quantity = defaultdict(float)
    category_sales = defaultdict(float)
    branch_sales = defaultdict(float)
    daily_sales = defaultdict(float)

    for item in data:

        # ============================================
        # PRICE
        # ============================================

        price = item.get(
            "Price",
            item.get(
                "AdjustedPrice",
                0
            )
        )

        quantity = item.get(
            "Quantity",
            0
        )

        try:

            price = float(price)

        except:
            price = 0

        try:
            quantity = float(quantity)
        except:
            quantity = 0

        # SALES = PRICE × QUANTITY

        amount = price * quantity
        total_sales += amount
        total_quantity += quantity

        # ============================================
        # MENU SALES
        # ============================================

        menu = item.get(
            "Description",
            "Unknown"
        )

        menu_sales[menu] += amount
        menu_quantity[menu] += quantity

        # ============================================
        # CATEGORY SALES
        # ============================================

        category = item.get(
            "CategoryDescription",
            "Unknown"
        )

        category_sales[category] += amount

        # ============================================
        # BRANCH SALES
        # ============================================

        branch = str(
            item.get(
                "StoreNumber",
                "Unknown"
            )
        )

        branch_sales[branch] += amount

        # ============================================
        # DAILY SALES
        # ============================================


        date = item.get(
            "date",
            "Unknown"
        )

        daily_sales[date] += amount

    # ============================================
    # TOP / LEAST SELLING MENU
    # ============================================


    top_menu = sorted(
        menu_quantity.items(),
        key=lambda x: x[1],
        reverse=True
    )[:10]

    least_menu = sorted(
        menu_quantity.items(),
        key=lambda x: x[1]
    )[:10]

    return {

        "total_sales": round(
            total_sales,
            2
        ),

        "total_quantity": round(
            total_quantity,
            2
        ),

        "top_menu":[

            {
                "name": name,

                "quantity": round(
                    qty,
                    2
                ),
                "sales": round(
                    menu_sales[name],
                    2
                )
            }
            for name, qty in top_menu
        ],

        "least_menu":[
            {
                "name": name,
                "quantity": round(
                    qty,
                    2
                ),

                "sales": round(
                    menu_sales[name],
                    2
                )
            }
            for name, qty in least_menu
        ],

        "category_sales":[
            {
                "category": name,
                "sales": round(
                    value,
                    2
                )
            }
            for name, value in sorted(
                category_sales.items(),
                key=lambda x:x[1],
                reverse=True
            )
        ],

        "branch_performance":[
            {
                "store": name,
                "sales": round(
                    value,
                    2
                )
            }

            for name, value in sorted(
                branch_sales.items(),
                key=lambda x:x[1],
                reverse=True
            )
        ],

        "daily_sales":[
            {
                "date": name,
                "sales": round(
                    value,
                    2
                )
            }
            for name, value in daily_sales.items()
        ]
    }
# ============================================================
# ADMIN DASHBOARD OVERVIEW
# ============================================================

@app.get("/api/admin/dashboard")
def admin_dashboard():

    # Orders
    total_orders = db["order_details"].count_documents({})

    # Branches
    branches = list(
        db["store_restaurant"].find(
            {},
            {
                "_id":0
            }
        )
    )
    total_branches = len(branches)
    loyalty_branches = 0

    for b in branches:
        if b.get(
            "STORE_LOYALTY_FLAG"
        ) == "Y":
            loyalty_branches += 1

    # Orders by branch
    pipeline = [

        {
            "$group":{
                "_id":"$StoreNumber",
                "orders":{
                    "$sum":1
                }
            }
        },

        {
            "$sort":{
                "orders":-1
            }
        }
    ]

    branch_orders = list(
        db["order_details"].aggregate(
            pipeline
        )
    )

    return {
        "total_orders": total_orders,
        "total_branches": total_branches,
        "loyalty_branches": loyalty_branches,

        "branch_orders":[
            {
                "storeNumber":x["_id"],
                "orders":x["orders"]
            }
            for x in branch_orders
        ]
    }

@app.get("/api/admin/branch-performance")
def branch_performance():
    branches = list(db["branches"].find({}, {"_id": 0}))
    orders = list(db["orders"].find({}, {"_id": 0}))
    performance = []
    for branch in branches:
        branch_id = branch.get("branch_id")
        branch_orders = [
            order for order in orders
            if (order.get("branchId") or order.get("branch_id")) == branch_id
        ]
        active_orders = [order for order in branch_orders if order.get("status") not in {"cancelled", "Cancelled"}]
        revenue = sum(float(order.get("total_amount", order.get("total", 0)) or 0) for order in active_orders)
        completed = sum(1 for order in active_orders if str(order.get("status", "")).lower() in {"completed", "confirmed"})
        average_order = revenue / len(active_orders) if active_orders else 0
        performance.append({
            "branchId": branch_id,
            "branchName": branch.get("branch_name", "").strip(),
            "city": branch.get("city", "").strip(),
            "orders": len(active_orders),
            "completedOrders": completed,
            "revenue": round(revenue, 2),
            "averageOrder": round(average_order, 2),
            "performanceScore": 0,
        })
    max_orders = max((item["orders"] for item in performance), default=1)
    max_revenue = max((item["revenue"] for item in performance), default=1)
    for item in performance:
        completion_rate = item["completedOrders"] / item["orders"] if item["orders"] else 0
        item["performanceScore"] = round(
            100 * (0.4 * item["orders"] / max_orders + 0.4 * item["revenue"] / max_revenue + 0.2 * completion_rate),
            1,
        )
    return sorted(performance, key=lambda item: item["performanceScore"], reverse=True)

class LoginRequest(BaseModel):
    username:str
    password:str

@app.post("/api/login")
def login(data:LoginRequest):

    customer_accounts = {
        "customer1": "BR001",
        "customer2": "BR002",
        "customer3": "BR003",
        "customer4": "BR004",
    }
    username = data.username.strip().lower()
    if username in customer_accounts and data.password == f"c{username[-1]}":
        return {
            "success": True,
            "user": {
                "_id": username,
                "username": username,
                "name": f"Customer {username[-1]}",
                "phone": "",
                "role": "customer",
                "branchId": customer_accounts[username],
            },
        }

    manager_accounts = {
        "branch1": ("b1", "BR001", "Hlaing Taste Manager"),
        "branch2": ("b2", "BR002", "Downtown Taste Manager"),
        "branch3": ("b3", "BR003", "Sanchaung Kitchen Manager"),
        "branch4": ("b4", "BR004", "Bahan Kitchen Manager"),
    }
    if username in manager_accounts and data.password == manager_accounts[username][0]:
        password, branch_id, name = manager_accounts[username]
        return {"success": True, "user": {"_id": username, "username": username, "name": name, "phone": "", "role": "branch_manager", "branchId": branch_id}}

    if username == "admin" and data.password == "mainadmin":
        return {"success": True, "user": {"_id": "admin", "username": "admin", "name": "Main Admin", "phone": "", "role": "main_admin"}}

    user = db["users"].find_one(
        {
            "username":data.username,
            "password":data.password
        },
        {
            "_id":0
        }
    )

    if not user:
        return {
            "success":False,
            "message":"Invalid login"
        }

    return {
        "success":True,
        "user":user
    }
class RegisterRequest(BaseModel):
    username:str
    name:str
    phone:str
    password:str

# @app.post("/api/register")
# def register(data:RegisterRequest):

    # exist = db["users"].find_one(
# /        {
        #    "username":data.username
        # }
    # )

    # if exist:
        # return {
            # "success":False,
            # "message":"Username already exists"
        # }

    # user = {
        # "username":data.username,
        # "name":data.name,
        # "phone":data.phone,
        # "password":data.password,
        # "role":"customer"
    # }

    # db["users"].insert_one(user)

    # return {
        # "success":True,
        # "message":"Account created"
    # }