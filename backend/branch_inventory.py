from fastapi import APIRouter
from database import db
from datetime import datetime


router = APIRouter()



# ==========================================
# UNIT CONVERSION
# ==========================================

def convert_unit(stock, unit):

    if stock is None:
        stock = 0


    if unit is None:
        unit = ""


    unit = unit.lower()



    if unit == "mg" and stock >= 1000:

        return round(stock / 1000,2), "g"



    if unit == "g" and stock >= 1000:

        return round(stock / 1000,2), "kg"



    if unit == "ml" and stock >= 1000:

        return round(stock / 1000,2), "L"



    return stock, unit

# ==========================================
# INITIALIZE BRANCH INVENTORY
# ==========================================


@router.post("/api/branch-inventory/init")
def initialize_branch_inventory():


    branches = list(
        db["store_restaurant"].find({})
    )


    ingredients = list(
        db["ingredients"].find({})
    )


    created = 0



    for branch in branches:


        branch_id = branch.get(
            "STORE_NUMBER"
        )


        if branch_id:

            branch_id = int(branch_id)



        for ingredient in ingredients:


            ingredient_id = ingredient.get(
                "IngredientId"
            )


            exists = db["branch_inventory"].find_one({

                "branchId": branch_id,

                "IngredientId": ingredient_id

            })


            if exists:
                continue




            data = {


                "branchId":
                branch_id,


                "IngredientId":
                ingredient_id,


                "IngredientName":
                ingredient.get(
                    "IngredientName"
                ),



                # IMPORTANT
                # Every branch starts with 1000

                "Stock":
                1000,



                "Unit":
                "unit",



                "createdAt":
                datetime.now()

            }




            db["branch_inventory"].insert_one(
                data
            )


            created += 1





    return {


        "success":True,


        "message":
        "Branch inventory initialized with default stock",


        "created":
        created

    }
# ==========================================
# GET BRANCH INVENTORY
# ==========================================


@router.get("/api/branch-inventory/{branch_id}")
def get_branch_inventory(branch_id:int):



    inventory = list(

        db["branch_inventory"].find(

            {

                "branchId":branch_id

            },


            {

                "_id":0

            }

        )

    )




    result=[]



    for item in inventory:



        stock,unit = convert_unit(

            item.get(
                "Stock",
                0
            ),

            item.get(
                "Unit",
                ""
            )

        )



        result.append({



            "IngredientId":

                item.get(
                    "IngredientId"
                ),



            "IngredientName":

                item.get(
                    "IngredientName"
                ),



            "Stock":

                stock,



            "Unit":

                unit,



            "branchId":

                item.get(
                    "branchId"
                )



        })





    return result