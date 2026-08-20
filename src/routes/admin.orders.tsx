import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useStore } from "@/lib/store";
import { toast } from "sonner";


export const Route = createFileRoute("/admin/orders")({

  head:()=>({
    meta:[
      {
        title:"Live Orders — Admin"
      }
    ]
  }),

  component:OrdersAdmin

});





type OrderStatus =
"placed"
|
"preparing"
|
"ready"
|
"completed"
|
"cancelled";





const statusFlow:Record<OrderStatus,OrderStatus|null>={

placed:"preparing",

preparing:"ready",

ready:"completed",

completed:null,

cancelled:null

};





const statusColor:Record<OrderStatus,string>={

placed:
"bg-blue-500/10 text-blue-600",

preparing:
"bg-amber-500/10 text-amber-700",

ready:
"bg-emerald-500/10 text-emerald-700",

completed:
"bg-muted text-muted-foreground",

cancelled:
"bg-red-500/10 text-red-600"

};






export function OrdersAdmin(){



const {
adminUser,
branchesState
}=useStore();



const [orders,setOrders]=useState<any[]>([]);


const isManager =
adminUser?.role==="branch_manager";


const forcedBranch =
isManager
?
adminUser?.branchId
:
undefined;



const [status,setStatus]=useState<OrderStatus|"all">(
"all"
);



const [branchFilter,setBranchFilter]=useState(
forcedBranch ?? "all"
);



const activeBranch =
forcedBranch ?? branchFilter;






// LOAD ORDERS FROM MONGODB

useEffect(()=>{


if(!adminUser?.branchId && isManager){
return;
}



const branch =
isManager
?
adminUser.branchId
:
branchFilter;



const url =
branch==="all"
?
"http://127.0.0.1:8000/api/orders/all"
:
`http://127.0.0.1:8000/api/orders/${branch}`;



fetch(url)

.then(res=>res.json())

.then(data=>{


console.log(
"MONGO ORDERS:",
data
);


setOrders(data);


})


.catch(err=>{

console.log(
"LOAD ORDER ERROR",
err
);


});


},[
adminUser,
branchFilter
]);







const filtered =
useMemo(()=>{


return orders.filter(o=>

(status==="all" || o.status===status)

&&

(activeBranch==="all" ||
o.branchId===activeBranch)

);


},[
orders,
status,
activeBranch
]);









const counts =
useMemo(()=>{


const c:any={

placed:0,

preparing:0,

ready:0,

completed:0,

cancelled:0

};



orders.forEach(o=>{


if(c[o.status]!==undefined){

c[o.status]++;

}


});


return c;


},[orders]);







return (

<div className="
mx-auto
max-w-7xl
space-y-6
p-4
md:p-8
">





<div>

<h1 className="
font-display
text-4xl
">

Live Orders

</h1>


<p className="
text-sm
text-muted-foreground
">

MongoDB Live Order System

</p>


</div>








{
!isManager &&

<Select

value={branchFilter}

onValueChange={setBranchFilter}

>

<SelectTrigger className="w-[220px]">

<SelectValue/>

</SelectTrigger>


<SelectContent>

<SelectItem value="all">

All branches

</SelectItem>


{
branchesState.map(b=>(

<SelectItem

key={b.id}

value={b.id}

>

{b.name}

</SelectItem>

))

}


</SelectContent>


</Select>


}







<div className="
grid
gap-3
sm:grid-cols-2
lg:grid-cols-5
">


{
(["placed",
"preparing",
"ready",
"completed",
"cancelled"] as OrderStatus[])

.map(s=>(


<Card key={s}>


<CardContent className="p-4">


<div className="
text-xs
uppercase
">

{s}

</div>


<div className="
text-2xl
font-bold
">

{counts[s]}

</div>


</CardContent>


</Card>


))

}


</div>








<Tabs

value={status}

onValueChange={(v)=>
setStatus(v as any)
}

>


<TabsList>


<TabsTrigger value="all">

All

</TabsTrigger>


{
(["placed",
"preparing",
"ready",
"completed",
"cancelled"]

).map(s=>(

<TabsTrigger
key={s}
value={s}
>

{s}

</TabsTrigger>

))

}


</TabsList>


</Tabs>









<Card>


<CardHeader>

<CardTitle>

Orders

</CardTitle>


<CardDescription>

{filtered.length} orders

</CardDescription>


</CardHeader>





<CardContent>


{
filtered.length===0

?

<div className="
py-10
text-center
">

No orders found

</div>


:


<table className="w-full text-sm">


<thead>

<tr className="border-b">


<th className="text-left">

ID

</th>


<th>

Branch

</th>


<th>

Items

</th>


<th>

Total

</th>


<th>

Status

</th>


</tr>

</thead>






<tbody>


{
filtered.map(order=>(


<tr
key={order._id}
className="border-b"
>


<td className="py-3">

{order._id.slice(-6)}

</td>


<td>

{order.branchId}

</td>


<td>

{order.items.length}

</td>


<td>

${order.total}

</td>


<td>


<Badge

className={
statusColor[order.status as OrderStatus]
}

>

{order.status}

</Badge>


</td>


</tr>


))

}


</tbody>


</table>


}


</CardContent>


</Card>





</div>


);


}