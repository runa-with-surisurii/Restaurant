import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { ImageIcon } from "lucide-react";

export const Route = createFileRoute("/branch-manager/orders")({

  head: () => ({
    meta:[
      {
        title:"Live Orders — Branch Manager",
      }
    ],
  }),

  component: BranchManagerOrders,

});





function BranchManagerOrders(){


  const { adminUser } = useStore();


  const [orders,setOrders] = useState<any[]>([]);

  const [loading,setLoading] = useState(true);



  const branchId = adminUser?.branchId;



  useEffect(()=>{


    if(!branchId) return;


    fetch(
      `http://127.0.0.1:8000/api/orders/${branchId}`
    )

    .then(res=>res.json())

    .then(data=>{

      setOrders(data);

    })

    .finally(()=>{

      setLoading(false);

    });


  },[branchId]);





  async function confirmOrder(id:string){


    await fetch(

      `http://127.0.0.1:8000/api/orders/${id}/confirm`,

      {
        method:"PUT"
      }

    );


    setOrders(prev=>

      prev.map(order=>

        order._id===id

        ?

        {
          ...order,
          status:"confirmed"
        }

        :

        order

      )

    );

  }





  if(loading){

    return <div className="p-6">
      Loading orders...
    </div>

  }




  return (

    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">


      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="text-sm font-semibold text-primary">🔒 Branch Manager View</div>

        <div className="text-xs text-muted-foreground">Live orders from your branch</div>
      </div>




      <div className="rounded-2xl border bg-card">
        <div className="p-5">
          <h1 className="text-xl font-bold">Live Orders</h1>

          <p className="text-sm text-muted-foreground">{orders.length} orders</p>
        </div>




        <div className="divide-y">
          {orders.map((order) => (
<div
key={order._id}
className="
p-5
space-y-4
"
>


<div className="
flex
justify-between
items-start
">


<div>


<div className="font-semibold">

#{order._id.slice(-6)}

</div>


<p className="text-sm text-muted-foreground">

{order.items?.length ?? 0} items

</p>


</div>




<div className="flex items-center gap-3">


<span
className="
rounded-full
bg-orange-100
px-3
py-1
text-sm
text-orange-600
"
>

{order.status}

</span>


{
order.status==="pending"

&&

<button

onClick={()=>confirmOrder(order._id)}

className="
rounded-lg
bg-primary
px-4
py-2
text-white
"

>

Confirm

</button>

}



</div>


</div>







{/* MENU ITEMS */}


<div className="
grid
gap-3
md:grid-cols-2
"
>


{
order.items?.map((item:any,index:number)=>(


<div

key={index}

className="
flex
items-center
gap-4
rounded-xl
border
p-3
"


>


{/* IMAGE */}


<div className="
h-16
w-16
rounded-lg
bg-muted
flex
items-center
justify-center
overflow-hidden
">


{
item.image

?


<img

src={item.image}

className="
h-full
w-full
object-cover
"

/>


:


<ImageIcon
className="text-muted-foreground"
/>

}



</div>







<div>


<p className="font-semibold">

{item.name}

</p>


<p className="text-sm text-muted-foreground">

Qty:
{" "}
{item.quantity}

</p>



<p className="text-sm">

${item.price}

</p>



</div>



</div>



))


}


</div>







<div className="
text-right
font-bold
border-t
pt-3
">


Total:

{" "}

${order.total}


</div>



</div>

        ))}


        </div>


      </div>


    </div>

  );

}