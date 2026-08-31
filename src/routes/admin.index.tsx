import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShoppingBag, Store } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

export const Route = createFileRoute("/admin/")({ component: AdminDashboard });

type DashboardData = {
  total_orders: number;
  branch_orders: { storeNumber: string; orders: number; branchName?: string }[];
  week_start?: string | null;
  week_end?: string | null;
};

type Branch = { branchId: string; branchName: string; city: string; state: string };

function AdminDashboard() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("http://127.0.0.1:8000/api/admin/dashboard").then((res) => {
        if (!res.ok) throw new Error("Unable to load dashboard");
        return res.json();
      }),
      fetch("http://127.0.0.1:8000/api/branches").then((res) => {
        if (!res.ok) throw new Error("Unable to load branches");
        return res.json();
      }),
    ])
      .then(([data, branchList]) => {
        setDashboard(data);
        setBranches(Array.isArray(branchList) ? branchList : []);
      })
      .catch(console.error);
  }, []);

  if (!dashboard) return <div className="p-8">Loading Dashboard...</div>;

  const totalBranches = branches.length || dashboard.branch_orders?.length || 0;
  const ranking = dashboard.branch_orders || [];

  return (
    <div className="p-8 space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">Weekly overview</p>
        <h1 className="text-5xl font-display">Weekly Branches Intelligence Dashboard</h1>
        <p className="mt-2 text-muted-foreground">
          Branch performance and order intelligence for the current dataset week
          {dashboard.week_start && dashboard.week_end ? ` (${dashboard.week_start} – ${dashboard.week_end})` : ""}.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <KpiCard title="Total Orders" value={dashboard.total_orders || 0} icon={<ShoppingBag />} />
        <KpiCard title="Total Branches" value={totalBranches} icon={<Store />} />
      </div>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-semibold">Weekly Branch Performance</h2>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ranking}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="storeNumber" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="mb-4 text-lg font-semibold">Branch Ranking — This Week</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="p-2 text-left">Rank</th>
                <th className="p-2 text-left">Branch</th>
                <th className="p-2 text-left">Orders</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((branch, index) => {
                const branchInfo = branches.find((b) => String(b.branchId) === String(branch.storeNumber));
                return (
                  <tr key={branch.storeNumber} className="border-b">
                    <td className="p-2">{index + 1}</td>
                    <td className="p-2">
                      {branchInfo?.branchName || branch.branchName || branchInfo?.city || branch.storeNumber}
                    </td>
                    <td className="p-2">{branch.orders.toLocaleString()}</td>
                  </tr>
                );
              })}
              {!ranking.length && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-muted-foreground">No weekly order data available.</td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ title, value, icon }: { title: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-muted-foreground">{title}</p>
            <h2 className="text-4xl font-bold">{value.toLocaleString()}</h2>
          </div>
          <div className="rounded-xl bg-orange-100 p-3">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
