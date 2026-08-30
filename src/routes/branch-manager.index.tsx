import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useBranchShell } from "@/components/branch-admin/BranchShell";
import { ShoppingBag, DollarSign, Users, TrendingUp, MapPin, Brain } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

export const Route = createFileRoute("/branch-manager/")({ component: BranchDashboard });

type Branch = { storeNumber:number; city:string; state:string; type?:string; loyalty?:string };
type Prediction = { algorithm:string; nextDay:number; forecast:{date:string;predictedSales:number}[] };
type Analytics = {
  orders:number; revenue:number; customers:number; growth:number;
  weekly_sales:{day:string;sales:number}[];
  current_menu_sold?: {menuId:string|number;name:string;quantity:number;image:string}|null;
  currentMenuSold?: {menuId:string|number;name:string;quantity:number;image:string}|null;
  inventory_usage:{ingredient:string;used:number;unit:string;beforeStock:number;remaining:number;orderId:string;date:string}[];
  sales_prediction?: Prediction; salesPrediction?: Prediction;
};

function BranchDashboard(){
  const { adminUser } = useStore();
  const { activeBranchId } = useBranchShell();
  const branchId = adminUser?.role === "branch_manager" ? adminUser.branchId : activeBranchId;
  const [branch,setBranch] = useState<Branch|null>(null); const [analytics,setAnalytics] = useState<Analytics|null>(null); const [loading,setLoading] = useState(true);
  useEffect(()=>{
    if(!adminUser || !branchId) return;
    Promise.all([fetch("http://127.0.0.1:8000/api/branches").then(r=>r.json()), fetch(`http://127.0.0.1:8000/api/branch/dashboard/${branchId}`).then(r=>r.json())])
      .then(([branches,data])=>{ setBranch(branches.find((b:Branch)=>String(b.branchId ?? b.storeNumber)===String(branchId))); setAnalytics(data); })
      .catch(console.error).finally(()=>setLoading(false));
  },[adminUser,branchId]);
  if(loading) return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading Dashboard...</div>;
  const currentMenu = analytics?.current_menu_sold || analytics?.currentMenuSold; const prediction = analytics?.sales_prediction || analytics?.salesPrediction;
  return <div className="min-h-screen bg-muted/30 p-8 space-y-8">
    <div><h1 className="text-5xl font-bold">Branch Analytics Dashboard</h1><p className="mt-2 text-muted-foreground">Real-time branch performance overview</p></div>
    <div className="grid gap-5 md:grid-cols-4">
      <KpiCard title="Today's Orders" value={analytics?.orders?.toLocaleString() || "0"} icon={<ShoppingBag/>}/><KpiCard title="Revenue" value={`$${analytics?.revenue?.toLocaleString() || 0}`} icon={<DollarSign/>}/><KpiCard title="Customers" value={analytics?.customers?.toLocaleString() || "0"} icon={<Users/>}/><KpiCard title="Growth" value={`+${analytics?.growth || 0}%`} icon={<TrendingUp/>}/>
    </div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Branch Information</CardTitle></CardHeader><CardContent className="space-y-4"><div className="flex items-center gap-4"><MapPin size={32}/><div><h2 className="text-2xl font-bold uppercase">{branch?.city || "Unknown"}</h2><p>{branch?.state || "-"}</p></div></div><p>Manager: <b>{adminUser?.name}</b></p><p>Store: <b>{adminUser?.branchId}</b></p></CardContent></Card>
      <Card><CardHeader><CardTitle>Performance Summary</CardTitle></CardHeader><CardContent className="space-y-5"><ProgressBar title="Operational Score" value="92%"/><div className="border-t pt-5"><div className="flex items-center justify-between mb-3"><span className="font-semibold">Current Menu Sold</span>{currentMenu&&<span className="text-sm text-muted-foreground">Qty {currentMenu.quantity}</span>}</div>{currentMenu?<div className="flex items-center gap-4"><img src={currentMenu.image} alt={currentMenu.name} className="h-16 w-16 rounded-xl object-cover" onError={e=>{e.currentTarget.src="/menu/default.png"}}/><div><p className="font-bold">{currentMenu.name}</p><p className="text-sm text-muted-foreground">Latest confirmed order</p></div></div>:<p className="text-sm text-muted-foreground">No menu sold yet</p>}</div></CardContent></Card>
    </div>
    <Card><CardHeader><CardTitle>Sales Prediction — Linear Regression</CardTitle><p className="text-sm text-muted-foreground">7-day forecast based on the last 30 days of branch net sales</p></CardHeader><CardContent><div className="grid gap-5 md:grid-cols-3"><div className="rounded-xl border p-5"><p className="text-sm text-muted-foreground">Next Day Predicted Sales</p><p className="text-3xl font-bold mt-2">${prediction?.nextDay?.toLocaleString() || "0"}</p></div><div className="rounded-xl border p-5"><p className="text-sm text-muted-foreground">Algorithm</p><p className="text-xl font-bold mt-2">{prediction?.algorithm || "Linear Regression"}</p></div><div className="rounded-xl border p-5"><p className="text-sm text-muted-foreground">Forecast Horizon</p><p className="text-xl font-bold mt-2">7 Days</p></div></div>{prediction?.forecast?.length?<div className="h-[280px] mt-6"><ResponsiveContainer width="100%" height="100%"><LineChart data={prediction.forecast}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="date"/><YAxis/><Tooltip/><Line type="monotone" dataKey="predictedSales" stroke="#f97316" strokeWidth={3} name="Predicted Sales"/></LineChart></ResponsiveContainer></div>:<p className="text-muted-foreground mt-5">Not enough sales data for a forecast.</p>}</CardContent></Card>
    <Card><CardHeader><CardTitle>Weekly Sales Trend</CardTitle></CardHeader><CardContent><div className="h-[320px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={analytics?.weekly_sales||[]}><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey="day"/><YAxis/><Tooltip/><Line type="monotone" dataKey="sales" stroke="#f97316" strokeWidth={3}/></LineChart></ResponsiveContainer></div></CardContent></Card>
    <Card><CardHeader><CardTitle>Recent Stock Usage</CardTitle></CardHeader><CardContent><div className="space-y-4">{analytics?.inventory_usage?.length?analytics.inventory_usage.map((item,index)=><div key={index} className="flex justify-between items-center border-b pb-3"><div><p className="font-semibold">{item.ingredient}</p><p className="text-sm text-muted-foreground">Used: {item.used} {item.unit}</p></div><div className="text-right"><p className="text-sm text-muted-foreground">Remaining</p><p className="font-bold">{item.remaining} {item.unit}</p></div></div>):<p className="text-muted-foreground">No inventory usage yet</p>}</div></CardContent></Card>
  </div>;
}
function KpiCard({title,value,icon}:{title:string;value:string;icon:React.ReactNode}){return <Card><CardContent className="p-6"><div className="flex items-center justify-between"><div><p className="text-sm text-muted-foreground">{title}</p><h2 className="text-3xl font-bold">{value}</h2></div><div className="rounded-xl bg-orange-100 p-3 text-orange-600">{icon}</div></div></CardContent></Card>}
function ProgressBar({title,value}:{title:string;value:string}){return <div><div className="flex justify-between mb-2"><span>{title}</span><span className="font-bold">{value}</span></div><div className="h-3 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-orange-500" style={{width:value}}/></div></div>}
