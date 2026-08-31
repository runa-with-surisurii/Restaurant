import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, Store } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type DashboardData = { total_orders: number; branch_orders: { storeNumber: number; orders: number }[] };
type Branch = { storeNumber: number; city: string; state: string; branchId?: string };

function AdminDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("http://127.0.0.1:8000/api/admin/dashboard").then((res) => res.json()),
      fetch("http://127.0.0.1:8000/api/branches").then((res) => res.json()),
    ])
      .then(([data, branchList]) => {
        setDashboard(data);
        setBranches(Array.isArray(branchList) ? branchList : []);
      })
      .catch(console.error);
  }, []);

  if (!dashboard) return <div className="p-8">Loading Dashboard...</div>;

  const totalBranches = branches.length || dashboard.branch_orders?.length || 0;

  return (
    <div className="p-8 space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Weekly overview</p>
        <h1 className="text-5xl font-display">Weekly Branches Intelligence Dashboard</h1>
        <p className="mt-2 text-muted-foreground">Branch performance and order intelligence for the current week.</p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <KpiCard title="Total Orders" value={dashboard.total_orders || 0} icon={<ShoppingBag />} />
        <KpiCard title="Total Branches" value={totalBranches} icon={<Store />} />
      </div>

      <Card>
        <CardHeader><CardTitle>Weekly Branch Performance</CardTitle></CardHeader>
        <CardContent><div className="h-[350px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={dashboard.branch_orders || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="storeNumber" /><YAxis /><Tooltip /><Bar dataKey="orders" fill="#f97316" /></BarChart></ResponsiveContainer></div></CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Branch Ranking</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="p-2 text-left">Rank</th><th className="p-2 text-left">Branch</th><th className="p-2 text-left">Orders</th></tr></thead>
            <tbody>{(dashboard.branch_orders || []).map((branch, index) => <tr key={branch.storeNumber} className="border-b"><td className="p-2">{index + 1}</td><td className="p-2">{branches.find((b) => Number(b.storeNumber) === Number(branch.storeNumber))?.city || branch.storeNumber}</td><td className="p-2">{branch.orders.toLocaleString()}</td></tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return <Card><CardContent className="p-6"><div className="flex justify-between items-center"><div><p className="text-muted-foreground">{title}</p><h2 className="text-4xl font-bold">{value.toLocaleString()}</h2></div><div className="rounded-xl bg-orange-100 p-3">{icon}</div></div></CardContent></Card>;
}
