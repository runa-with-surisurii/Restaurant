import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBranchShell } from "@/components/branch-admin/BranchShell";
import { useStore } from "@/lib/store";

export const Route = createFileRoute("/admin/orders")({ head: () => ({ meta: [{ title: "Live Orders - Admin" }] }), component: OrdersAdmin });
type OrderStatus = "pending" | "placed" | "preparing" | "ready" | "completed" | "cancelled" | "confirmed";
const statusColor: Record<string,string> = { pending:"bg-orange-500/10 text-orange-700", placed:"bg-blue-500/10 text-blue-600", preparing:"bg-amber-500/10 text-amber-700", ready:"bg-emerald-500/10 text-emerald-700", completed:"bg-muted text-muted-foreground", confirmed:"bg-primary/10 text-primary", cancelled:"bg-red-500/10 text-red-600" };

function orderImage(item:any){
  if(item.image) return item.image;
  const id = item.menu_id ?? item.menuItemId ?? item.MenuItemId;
  return id ? `/menu/${id}.jpg` : "";
}

function OrdersAdmin(){
  const { adminUser } = useStore();
  const { activeBranchId, section } = useBranchShell();
  const [orders,setOrders]=useState<any[]>([]);
  const [status,setStatus]=useState<OrderStatus|"all">("all");
  const isManager=adminUser?.role==="branch_manager";
  const activeBranch=isManager?adminUser?.branchId:section==="chain"?"all":activeBranchId||"all";

  useEffect(()=>{
    if(isManager&&!adminUser?.branchId)return;
    const url=activeBranch==="all"?"http://127.0.0.1:8000/api/orders/all":`http://127.0.0.1:8000/api/orders/${activeBranch}`;
    const load=async()=>{try{const response=await fetch(url);if(!response.ok)throw new Error();const data=await response.json();setOrders(Array.isArray(data)?data:[]);}catch{setOrders([]);}};
    load();const timer=window.setInterval(load,5000);return()=>window.clearInterval(timer);
  },[activeBranch,adminUser?.branchId,isManager]);

  const filtered=useMemo(()=>orders.filter(order=>(status==="all"||String(order.status).toLowerCase()===status)&&(activeBranch==="all"||String(order.branchId??order.branch_id)===String(activeBranch))),[orders,status,activeBranch]);

  return <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
    <div><h1 className="font-display text-4xl">Live Orders</h1><p className="text-sm text-muted-foreground">{activeBranch==="all"?"All branches":"Selected branch"}</p></div>
    {!isManager&&<Select value={status} onValueChange={v=>setStatus(v as OrderStatus|"all")}><SelectTrigger className="w-48"><SelectValue placeholder="Filter status"/></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{Object.keys(statusColor).map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select>}
    <Card><CardHeader><CardTitle>{filtered.length} orders</CardTitle></CardHeader><CardContent className="space-y-4">
      {filtered.map(order=>{
        const id=String(order.id??order._id??order.order_id??"");
        const total=Number(order.total_amount??order.total??0);
        return <div key={id} className="rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><div className="font-mono text-xs text-muted-foreground">#{id.slice(-8)}</div><div className="mt-1 font-semibold">Branch {order.branchId??order.branch_id??"-"}</div></div><div className="flex items-center gap-3"><Badge variant="outline" className={statusColor[String(order.status).toLowerCase()]??""}>{order.status??"pending"}</Badge><span className="font-display text-xl text-primary">${total.toFixed(2)}</span></div></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(order.items??[]).map((item:any,index:number)=>{const src=orderImage(item);return <div key={`${id}-${item.menu_id??index}`} className="flex items-center gap-3 rounded-lg bg-muted/30 p-2"><div className="size-16 shrink-0 overflow-hidden rounded-lg bg-muted">{src?<img src={src} alt={item.name??"Menu item"} className="h-full w-full object-cover" onError={e=>{const el=e.currentTarget;if(!el.dataset.fallback){el.dataset.fallback="1";el.src="/menu/default.jpg";}}}/>:<div className="grid h-full place-items-center text-xl">🍽️</div>}</div><div className="min-w-0"><div className="truncate font-medium">{item.name??"Unknown menu item"}</div><div className="text-sm text-muted-foreground">{item.quantity??item.qty??1} × ${Number(item.unit_price??item.price??0).toFixed(2)}</div></div></div>})}
          </div>
        </div>;
      })}
      {!filtered.length&&<div className="p-8 text-center text-muted-foreground">No orders found.</div>}
    </CardContent></Card>
  </div>;
}
