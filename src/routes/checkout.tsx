import {
  createFileRoute,
  useNavigate,
} from "@tanstack/react-router";

import {
  useState,
} from "react";

import {
  toast,
} from "sonner";


import {
  SiteLayout,
} from "@/components/site-layout";


import {
  useCart,
} from "@/lib/cart";


import {
  useStore,
} from "@/lib/store";




export const Route = createFileRoute("/checkout")({

  component: CheckoutPage,

});








function CheckoutPage(){


const navigate = useNavigate();



const {
  items,
  clearCart,
}=useCart();





const {
  adminUser
}=useStore();





const [loading,setLoading]=
useState(false);





const total = items.reduce(

(sum,item)=>

sum +

(
Number(item.dish.price || 0)
*
item.quantity
),

0

);








const submitOrder = async()=>{



if(!adminUser){


toast.error(
"Please login as branch manager"
);


navigate({

to:"/login",

replace:true

});


return;


}






try{


setLoading(true);






const response = await fetch(

"http://127.0.0.1:8000/api/orders",

{


method:"POST",


headers:{


"Content-Type":
"application/json"


},



body:JSON.stringify({


branchId:
adminUser.branchId,


createdBy:
adminUser.username || adminUser.name,



items:

items.map(item=>(


{


dishId:
item.dish.id,


name:
item.dish.name,


quantity:
item.quantity,


price:
Number(item.dish.price || 0)



}


)),




total:total,


status:"pending"



})


}


);








const data =
await response.json();






console.log(
"ORDER RESPONSE:",
data
);







if(data.success){


toast.success(
"Order created successfully"
);



clearCart();



navigate({

to:"/branch-manager",

replace:true

});



}

else{


toast.error(
data.message ||
"Order failed"
);


}



}



catch(error){



console.log(error);


toast.error(
"Server error"
);



}



finally{


setLoading(false);


}



};












return (


<SiteLayout>


<div className="
mx-auto
max-w-5xl
px-4
py-12
">





<h1 className="
text-5xl
font-bold
">

Create Order

</h1>




<p className="
mt-2
text-muted-foreground
">

Branch POS Order System

</p>









<div className="
mt-8
rounded-2xl
border
bg-card
p-6
">







<div className="
mb-6
rounded-xl
bg-muted
p-4
">


<p>

Branch:

<b>
{" "}
{adminUser?.branchId || "-"}
</b>

</p>



<p>

Cashier:

<b>
{" "}
{adminUser?.name || "-"}
</b>

</p>



</div>









<h2 className="
text-2xl
font-semibold
">

Order Summary

</h2>







<div className="
mt-6
space-y-4
">





{

items.map(item=>(


<div

key={item.dish.id}

className="
flex
justify-between
border-b
pb-3
"

>



<div>


<p className="
font-semibold
">

{item.dish.name}

</p>



<p className="
text-sm
text-muted-foreground
">

Qty:
{item.quantity}

</p>


</div>







<div className="
font-semibold
">


$


{

(
Number(item.dish.price || 0)
*
item.quantity

)

.toFixed(2)

}



</div>





</div>



))


}







</div>









<div className="
mt-6
flex
justify-between
border-t
pt-5
text-xl
font-bold
">


<span>

Total

</span>



<span className="
text-primary
">

${total.toFixed(2)}

</span>



</div>









<button


onClick={submitOrder}


disabled={loading}


className="
mt-8
w-full
rounded-full
bg-primary
px-5
py-3
font-semibold
text-primary-foreground
"

>


{

loading

?

"Creating Order..."

:

"Confirm Order"

}



</button>








</div>





</div>



</SiteLayout>


);


}