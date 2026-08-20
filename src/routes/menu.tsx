import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Plus, Search, ShoppingCart } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { useCart } from "@/lib/cart";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta:[

      {
        title: "Menu — Ember & Oak",
      },

      {
        name: "description",
        content: "Explore restaurant menu."
      }

    ],
  }),

  component: MenuPage,
});

type Dish = {
  id: string;

  name: string;

  description: string;

  price: number;

  image: string;

  categoryId: string;

  rating: number;

  reviewCount: number;
};

type ApiMenuItem = {
  id?: number | string;

  name?: string;
  description?: string;

  MenuItemName?: string;
  MenuItemDescription?: string;

  category?: string;

  price?: number;

  image?: string;
};






type SortKey =

"popular"

|

"price-asc"

|

"price-desc"

|

"rating";









const categories = [


{

id:"all",

name:"All",

emoji:"🍽️"

},



{

id:"sandwiches",

name:"Sandwiches",

emoji:"🥪"

},



// {
    // id: "burgers",
// name:"Burgers",
// emoji:"🍔"
// 
  // },



{

id:"pizza",

name:"Pizza",

emoji:"🍕"

},



{
    id: "drinks",
    name: "Drinks",
    emoji: "🥤",
},

  {
    id: "desserts",
    name: "Desserts",
    emoji: "🍰",
  },



{

id:"other",
name:"Other",
emoji:"🍴"

}



];

function getDefaultPrice(category: string) {
  switch (category) {

//  case "burgers":
//    return 6;
    case "pizza":
      return 7;

    case "sandwiches":
      return 5;

    case "drinks":
      return 2;

    case "desserts":
      return 1.5;

    default:
      return 5;
  }
}

function formatMenuName(name:string){
  const n = name.toLowerCase();

  if (n.includes("chpizza")) return "Chicken Pizza";
  if (n.includes("vgpizza")) return "Veggie Pizza";
  if (n.includes("ham")) return "Ham Sandwich";
  if (n.includes("cookie")) return "Cookie";
  if (n.includes("coke")) return "Coca Cola";
  return name;
}

function detectCategory(text:string){

const n = text.toLowerCase();


// =======================
// PIZZA
// =======================

if(
 n.includes("pizza") ||
 n.includes("piza") ||
 n.includes("piz")
){
 return "pizza";
}



// =======================
// DRINKS
// =======================

if(
 n.includes("coffee") ||
 n.includes("coke") ||
 n.includes("cola") ||
 n.includes("water") ||
 n.includes("fountain") ||
 n.includes("tea") ||
 n.includes("drink")
){
 return "drinks";
}



// =======================
// DESSERT
// =======================

if(
 n.includes("cookie") ||
 n.includes("dessert")
){
 return "desserts";
}



// =======================
// SANDWICH
// IMPORTANT: Subway abbreviations
// =======================

if(
 n.includes("ham") ||
    n.includes("steak") ||
 n.includes("chicken") ||
 n.includes("turkey") ||
 n.includes("ftl") ||
 n.includes("six") ||
 n.includes("ffb") ||
 n.includes("fbd") ||
  n.includes("FtFbd") ||
 n.includes("flatbd") ||
  n.includes("chse") ||
 n.includes("sub")
){
 return "sandwiches";
}



return "other";


}

function convertMenuItem(item: ApiMenuItem, index: number): Dish {
  const rawName = item.name?.trim() || item.MenuItemName?.trim() || `Menu Item ${index + 1}`;

  const name = formatMenuName(rawName);

  const categoryId = detectCategory(name + " " + item.description);
  console.log(name, categoryId);
  return {
    id: String(item.id ?? index),
    name,
    description: item.description || item.MenuItemDescription || "Delicious menu item.",
    price: Number(item.price) || getDefaultPrice(categoryId),

    image: item.image || "",
    categoryId,
    rating: 4.5,
    reviewCount: 0,
  };
}

function MenuPage() {
  const [menu, setMenu] = useState<Dish[]>([]);

  const [query, setQuery] = useState("");

  const [category, setCategory] = useState("all");

  const [sort, setSort] = useState<SortKey>("popular");

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState("");

  const { addItem, items } = useCart();

// =====================================================
// LOAD MENU
// =====================================================

  useEffect(() => {
    async function loadMenu() {


try{


setLoading(true);

setError("");



const response = await fetch(

"http://127.0.0.1:8000/api/menu"

);



if(!response.ok){


throw new Error(
"Failed to load menu"
);


}



const data =
await response.json();





const apiItems =


Array.isArray(data)

?

data

:

data.items || [];






const converted =


apiItems.map(

(item:ApiMenuItem,index:number)=>

convertMenuItem(
item,
index
)

);





setMenu(converted);



}

catch(err){



console.log(
err
);



setError(

err instanceof Error

?

err.message

:

"Unable to load menu"

);


}


finally{


setLoading(false);


}



}



loadMenu();



},[]);









// =====================================================
// FILTER
// =====================================================


const list = useMemo(()=>{


const search =

query
.trim()
.toLowerCase();





let result = menu.filter((dish)=>{



const categoryMatch =


category==="all"

||

dish.categoryId===category;





const searchMatch =


!search

||

dish.name
.toLowerCase()
.includes(search)

;



return (

categoryMatch

&&

searchMatch

);



});






switch(sort){



case "price-asc":


result.sort(

(a,b)=>

a.price-b.price

);


break;




case "price-desc":


result.sort(

(a,b)=>

b.price-a.price

);


break;



case "rating":


result.sort(

(a,b)=>

b.rating-a.rating

);


break;




default:


result.sort(

(a,b)=>

b.reviewCount-a.reviewCount

);


}





return result;



},[

menu,

query,

category,

sort


]);








const cartCount =


items.reduce(

(total,item)=>

total + item.quantity,

0

);






return (

<SiteLayout>


<section className="
border-b
bg-muted/20
">


<div className="
mx-auto
max-w-7xl
px-4
py-10
">


<div className="
flex
justify-between
items-start
">


<div>


<p className="
text-xs
font-semibold
uppercase
tracking-widest
text-primary
">

Ember & Oak

</p>



<h1 className="
text-5xl
font-bold
mt-2
">

Full Menu

</h1>



<p className="
text-muted-foreground
mt-3
">

Choose your favourite menu items

</p>


</div>






<Link

to="/cart"

className="
rounded-full
border
px-4
py-3
flex
gap-2
items-center
"

>


<ShoppingCart/>

Cart


{
cartCount>0 &&


<span className="
rounded-full
bg-primary
text-white
px-2
">

{cartCount}

</span>


}



</Link>

</div>

{/* CATEGORY BUTTONS */}

<div className="
mt-6
flex
flex-wrap
gap-2
">


{
categories.map((item)=>(


<button


key={item.id}


onClick={()=>setCategory(item.id)}


className={cn(

"rounded-full border px-4 py-2 text-sm font-medium",


category===item.id

?

"bg-primary text-white"

:

"bg-card"

)}


>


{item.emoji}

{" "}

{item.name}


</button>



))


}


</div>



</div>


</section>







{/* MENU LIST */}



<section className="
mx-auto
max-w-7xl
px-4
py-10
">





{
loading &&


<div className="
flex
justify-center
p-10
">


<Loader2 className="
animate-spin
"/>


Loading menu...


</div>


}







{
error &&


<div className="
rounded-xl
border
p-6
text-center
">


<AlertCircle/>


<p>

{error}

</p>


</div>


}








{
!loading &&

!error &&



<div className="
grid
gap-6
sm:grid-cols-2
lg:grid-cols-3
xl:grid-cols-4
">


{


list.map((dish)=>(



<div

key={dish.id}

className="
overflow-hidden
rounded-2xl
border
bg-card
shadow-sm
hover:shadow-lg
transition
"

>




{/* IMAGE */}


<div className="
h-48
bg-muted
flex
items-center
justify-center
overflow-hidden
">


{


dish.image

?


<img

src={dish.image}

alt={dish.name}

className="
h-full
w-full
object-cover
"


onError={(e)=>{

e.currentTarget.style.display="none";

}}


/>


:


<span className="
text-6xl
">


{

categories.find(

(c)=>

c.id===dish.categoryId

)?.emoji

}


</span>


}



</div>









{/* INFO */}


<div className="
p-4
">


<h2 className="
font-bold
text-lg
">


{dish.name}


</h2>





<p className="
text-sm
text-muted-foreground
mt-1
">


{
categories.find(

(c)=>

c.id===dish.categoryId

)?.name

}


</p>






<p className="
text-sm
text-muted-foreground
mt-2
line-clamp-2
">


{dish.description}


</p>








<div className="
flex
justify-between
items-center
mt-4
">


<span className="
font-bold
text-lg
">


$

{dish.price.toFixed(2)}


</span>







<button


onClick={()=>addItem(dish)}


className="
rounded-full
bg-primary
px-4
py-2
text-sm
font-semibold
text-white
flex
items-center
gap-2
"


>


<Plus size={16}/>


Add


</button>



</div>



</div>





</div>



))


}




</div>


}

</section>

</SiteLayout>

);


}