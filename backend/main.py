from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from collections import defaultdict
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
        "http://127.0.0.1:8080",
        "http://127.0.0.1:8081",

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
def get_menu():

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
            {},
            {
                "_id":0
            }
        )
    )
    result = []

    for item in items:
        name = str(
            item.get(
                "MenuItemName",
                ""
            )
        ).strip()

        description = str(
            item.get(
                "MenuItemDescription",
                ""
            )
        ).strip()

        text = (
            f"{name} {description}"
        ).lower()

        # ====================================================
        # IMPROVED CATEGORY
        # ====================================================

        category = "Other"

        # Sandwiches
        if any(
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

        elif any(
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

        elif any(
            word in text
            for word in [
                "pizza",
                "pepperoni"
            ]
        ):
            category = "Pizza"

        # Salads

        elif any(
            word in text
            for word in [
                "salad",
                "veggie bowl"
            ]
        ):
            category = "Salads"

        # Desserts
        elif any(
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

        plu = item.get(
            "PLU"
        )
        price = price_map.get(
            plu,
            0
        )
        try:
            price = float(price)
        except:
            price = 0

        # ====================================================
        # RESPONSE
        # ====================================================

        result.append({

            "id": item.get(
                "MenuItemId"
            ),
            "name": name,
            "description": description,
            "plu": plu,
            "recipeId": item.get(
                "RecipeId"
            ),
            "category": category,
            "price": price,
            "image": ""
        })
    return result

# ============================================================
# CATEGORY API
# ============================================================

@app.get("/api/menu/categories")
def get_menu_categories():

    return [

        {
            "id":"all",
            "name":"All",
            "emoji":"🍽️"
        },

        {
            "id":"sandwiches",
            "name":"Sandwiches",
            "emoji":"🥪"
        },

        {
            "id":"burgers",
            "name":"Burgers",
            "emoji":"🍔"
        },

        {
            "id":"pizza",
            "name":"Pizza",
            "emoji":"🍕"
        },

        {
            "id":"salads",
            "name":"Salads",
            "emoji":"🥗"
        },

        {
            "id":"desserts",
            "name":"Desserts",
            "emoji":"🍰"
        },

        {
            "id":"other",
            "name":"Other",
            "emoji":"🍴"
        }
    ]

# ============================================================
# OTHER DATA
# ============================================================

@app.get("/api/branches")
def get_branches():

    branches = list(
        db["store_restaurant"].find(
            {},
            {"_id":0}
        )
    )

    result=[]

    for b in branches:
        result.append({

            "storeNumber": b.get(
                "STORE_NUMBER"
            ),

            "city": b.get(
                "STORE_CITY",
                ""
            ).strip(),

            "state": b.get(
                "STORE_STATE",
                ""
            ).strip(),

            "region": b.get(
                "DISTRIBUTION_REGION",
                ""
            ).strip(),

            "type": b.get(
                "STORE_TYPE",
                ""
            ).strip(),

            "loyalty": b.get(
                "STORE_LOYALTY_FLAG",
                ""
            )

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

            "IngredientId": item.get(
                "IngredientId"
            ),

            "IngredientName": item.get(
                "IngredientName",
                ""
            ).strip(),

            "Stock": item.get(
                "Stock",
                0
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

class LoginRequest(BaseModel):
    username:str
    password:str

@app.post("/api/login")
def login(data:LoginRequest):

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