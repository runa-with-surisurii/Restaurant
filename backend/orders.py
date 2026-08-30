from fastapi import APIRouter
from database import db
from datetime import datetime
from bson import ObjectId


router = APIRouter()



# =====================================================
# UNIT CONVERSION
# =====================================================

def convert_unit(value, from_unit, to_unit):

    if not from_unit or not to_unit:
        return value


    from_unit = str(from_unit).lower()
    to_unit = str(to_unit).lower()


    if from_unit == to_unit:
        return value



    conversions = {

        ("kg","g"):1000,
        ("g","kg"):0.001,

        ("l","ml"):1000,
        ("liter","ml"):1000,
        ("ml","l"):0.001,
        ("ml","liter"):0.001,

        ("mg","g"):0.001,
        ("g","mg"):1000,

        ("oz","g"):28.3495,
        ("g","oz"):0.035274,

        ("ounce","gram"):28.3495,
        ("gram","ounce"):0.035274

    }


    factor = conversions.get(
        (
            from_unit,
            to_unit
        )
    )


    if factor:
        return value * factor


    return value







# =====================================================
# CREATE ORDER
# =====================================================

@router.post("/api/orders")
def create_order(order:dict):


    items=[]
    order_items=[]
    branch_id = order.get("branchId") or order.get("branch_id")
    total_amount = float(order.get("total", 0) or 0)


    for item in order.get("items",[]):


        menu=None


        dish_id=item.get("dishId") or item.get("menu_id")



        if dish_id:


            try:

                menu=db["menu_items"].find_one({
                    "$or": [
                        {"menu_id": dish_id},
                        {"MenuItemId": int(dish_id) if str(dish_id).isdigit() else -1},
                        {"Description": str(dish_id)},
                    ]
                })

            except:

                pass




        if not menu:


            menu=db["menu_items"].find_one({

                "Description":
                item.get("name")

            })




        if menu:


            item["recipeId"]=menu.get(
                "RecipeId"
            )


            item["menuItemId"]=menu.get(
                "MenuItemId"
            )


            item["image"]=menu.get(
                "Image",
                "/menu/default.png"
            )

            item["menu_id"] = menu.get("menu_id") or menu.get("MenuItemId")



        items.append(item)

        quantity = int(item.get("quantity", 1) or 1)
        unit_price = float(item.get("price", 0) or 0)
        subtotal = quantity * unit_price
        order_items.append({
            "menu_id": item.get("menu_id") or item.get("dishId") or item.get("menuItemId"),
            "menu_name": item.get("name"),
            "quantity": quantity,
            "unit_price": unit_price,
            "subtotal": subtotal,
            "cost_price": item.get("costPrice", 0),
        })
        total_amount += subtotal



    order_data={


        "branchId": branch_id,
        "branch_id": branch_id,
        "createdBy":
        order.get(
            "createdBy",
            "customer"
        ),
        "items": items,
        "total": total_amount,
        "status": "pending",
        "createdAt": datetime.now(),
    }

    result = db["orders"].insert_one(order_data)
    order_id = str(result.inserted_id)

    db["orders"].update_one(
        {"_id": result.inserted_id},
        {"$set": {"order_id": order_id, "branch_id": branch_id, "branchId": branch_id}},
    )

    for order_item in order_items:
        db["order_items"].insert_one({
            "order_id": order_id,
            "orderItemId": "OI" + order_id[-6:],
            "menu_id": order_item.get("menu_id"),
            "menu_name": order_item.get("menu_name"),
            "quantity": order_item.get("quantity", 1),
            "unit_price": order_item.get("unit_price", 0),
            "subtotal": order_item.get("subtotal", 0),
            "cost_price": order_item.get("cost_price", 0),
            "branch_id": branch_id,
        })

    return {


        "success":True,
        "orderId": order_id,
        "order_id": order_id,
    }








# =====================================================
# GET ALL ORDERS
# =====================================================

@router.get("/api/orders/all")
def get_all_orders():
    orders = list(db["orders"].find({}).sort("createdAt", -1))

    for order in orders:
        order["_id"] = str(order["_id"])

    return orders

# =====================================================
# GET ORDERS
# =====================================================

@router.get("/api/orders/{branch_id}")
def get_orders(branch_id:str):


    orders=list(

        db["orders"].find({

            "$or":[

                {"branchId": branch_id},
                {"branch_id": branch_id},

            ]

        }).sort("createdAt", -1)

    )



    for order in orders:

        order["_id"]=str(
            order["_id"]
        )


    return orders

# =====================================================
# CONFIRM ORDER
# =====================================================

@router.put("/api/orders/{order_id}/confirm")
def confirm_order(order_id:str):


    try:

        order=db["orders"].find_one({

            "_id":
            ObjectId(order_id)

        })


    except:

        return {

            "success":False,

            "message":"Invalid order id"

        }




    if not order:


        return {

            "success":False,

            "message":"Order not found"

        }




    if order.get("status")=="confirmed":


        return {

            "success":False,

            "message":"Already confirmed"

        }





    branch_id=order.get(
        "branchId"
    ) or order.get("branch_id")

    if not order.get("order_id"):
        db["orders"].update_one(
            {"_id": order["_id"]},
            {"$set": {"order_id": str(order["_id"])}}
        )
        order["order_id"] = str(order["_id"])

    order_id_value = str(order.get("order_id") or order.get("_id"))

    existing_order_items = list(db["order_items"].find({"order_id": order_id_value}, {"_id": 0}))
    if not existing_order_items:
        for item in order.get("items", []):
            menu = None
            dish_id = item.get("dishId") or item.get("menu_id")
            if dish_id:
                menu = db["menu_items"].find_one({
                    "$or": [
                        {"menu_id": dish_id},
                        {"MenuItemId": int(dish_id) if str(dish_id).isdigit() else -1},
                        {"Description": str(dish_id)},
                    ]
                })
            if not menu:
                menu = db["menu_items"].find_one({"Description": item.get("name")})
            if not menu:
                continue
            qty = int(item.get("quantity", 1) or 1)
            price = float(item.get("price", item.get("unit_price", 0)) or 0)
            menu_id = menu.get("menu_id") or menu.get("MenuItemId")
            if db["order_items"].find_one({"order_id": order_id_value, "menu_id": menu_id}):
                continue
            db["order_items"].insert_one({
                "order_id": order_id_value,
                "orderItemId": "OI" + order_id_value[-6:],
                "menu_id": menu_id,
                "menu_name": item.get("name") or menu.get("menu_name") or menu.get("Description"),
                "quantity": qty,
                "unit_price": price,
                "subtotal": qty * price,
                "cost_price": menu.get("cost_price", 0),
                "branch_id": branch_id,
            })

    stock_updates=[]





    # =====================================================
    # STOCK DEDUCTION (ONLY THIS BRANCH)
    # =====================================================


    for item in order.get("items",[]):


        recipe_id=item.get(
            "recipeId"
        )



        # fallback recipe search

        if not recipe_id:


            menu=db["menu_items"].find_one({

                "Description":
                item.get("name")

            })


            if menu:

                recipe_id=menu.get(
                    "RecipeId"
                )



        if not recipe_id:

            continue





        recipes=list(

            db["recipe_ingredient_assignments"].find({

                "$or":[

                    {
                        "RecipeId":recipe_id
                    },

                    {
                        "RecipeId":str(recipe_id)
                    },

                    {
                        "RecipeId":int(recipe_id)
                    }

                ]

            })

        )






        quantity_ordered=int(

            item.get(
                "quantity",
                1
            )

        )





        for recipe in recipes:



            ingredient_id=recipe.get(
                "IngredientId"
            )




            recipe_qty=float(

                recipe.get(
                    "Quantity",
                    0
                )

            )



            recipe_unit=recipe.get(
                "Unit",
                ""
            )





            # GET ONLY CURRENT BRANCH STOCK

            inventory=db["branch_inventory"].find_one({

                "$and":[

                    {

                    "$or":[

                        {
                            "branchId":branch_id
                        },

                        {
                            "branchId":str(branch_id)
                        }

                    ]

                    },


                    {

                    "$or":[

                        {
                        "IngredientId":ingredient_id
                        },


                        {
                        "IngredientId":str(ingredient_id)
                        }

                    ]

                    }

                ]

            })





            if not inventory:

                continue





            stock_unit=inventory.get(
                "Unit",
                ""
            )




            used = convert_unit(

                recipe_qty,

                recipe_unit,

                stock_unit

            )



            used = used * quantity_ordered





            before=float(

                inventory.get(
                    "Stock",
                    0
                )

            )




            if before < used:

                continue





            remaining = before - used






            # UPDATE ONLY THIS BRANCH


            db["branch_inventory"].update_one(


                {


                "_id":
                inventory["_id"]


                },


                {


                "$set":{


                    "Stock":
                    remaining


                }


                }


            )







            # SAVE TRANSACTION


            db["inventory_transactions"].insert_one({


                "orderId":
                order_id,


                "branchId":
                branch_id,


                "IngredientId":
                ingredient_id,


                "IngredientName":
                inventory.get(
                    "IngredientName",
                    "Unknown"
                ),


                "beforeStock":
                before,


                "used":
                used,


                "unit":
                stock_unit,


                "remaining":
                remaining,


                "createdAt":
                datetime.now()

            })






            stock_updates.append({


                "IngredientName":
                inventory.get(
                    "IngredientName"
                ),


                "Used":
                used,


                "Unit":
                stock_unit,


                "Remaining":
                remaining


            })









    # =====================================================
    # SAVE SALES DETAILS
    # =====================================================


    for item in order.get("items",[]):


        qty=item.get(
            "quantity",
            1
        )


        price=item.get(
            "price",
            0
        )



        db["order_details"].insert_one({


            "StoreNumber":
            branch_id,


            "OrderId":
            order_id,


            "Description":
            item.get(
                "name",
                "Unknown"
            ),


            "Quantity":
            qty,


            "Price":
            price,


            "Total":
            qty * price,


            "date":
            datetime.now().strftime(
                "%Y-%m-%d"
            )


        })









    # =====================================================
    # CHANGE ORDER STATUS
    # =====================================================


    db["orders"].update_one({


        "_id":
        ObjectId(order_id)


    },


    {


        "$set":{


            "status":
            "confirmed",


            "confirmedAt":
            datetime.now()


        }


    })





    return {


        "success":True,


        "message":
        "Order confirmed successfully",


        "stockUpdated":
        stock_updates

    }