import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { useBranchShell } from "@/components/branch-admin/BranchShell";

export const Route = createFileRoute("/branch-manager/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Branch Manager" }, { name: "robots", content: "noindex" }] }),
  component: BranchInventory,
});

type Ingredient = { IngredientName: string; Stock: number; Unit: string; IngredientId: string | number };
type Usage = { ingredient: string; used: number; unit: string; beforeStock: number; remaining: number; orderId: string; date: string };

function BranchInventory() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [loading, setLoading] = useState(true);
  const { adminUser } = useStore();
  const { activeBranchId } = useBranchShell();
  const branchId = adminUser?.branchId ?? activeBranchId;

  useEffect(() => {
    if (!branchId) return;
    const load = async () => {
      try {
        const [inventoryRes, usageRes] = await Promise.all([
          fetch(`http://127.0.0.1:8000/api/branch-inventory/${branchId}`),
          fetch(`http://127.0.0.1:8000/api/branch-inventory/${branchId}/stock-usage`),
        ]);
        if (!inventoryRes.ok || !usageRes.ok) throw new Error("Inventory API request failed");
        const inventoryData = await inventoryRes.json();
        const usageData = await usageRes.json();
        setIngredients(Array.isArray(inventoryData) ? inventoryData : []);
        const rows = Array.isArray(usageData) ? usageData : usageData?.data || [];
        setUsage(rows.map((item: any) => ({
          ingredient: item.ingredient || item.IngredientName || "Unknown",
          used: Number(item.used ?? item.Used ?? 0),
          unit: item.unit || item.Unit || "",
          beforeStock: Number(item.beforeStock ?? 0),
          remaining: Number(item.remaining ?? item.Remaining ?? 0),
          orderId: String(item.orderId ?? item.order_id ?? ""),
          date: String(item.date ?? item.createdAt ?? ""),
        })));
      } catch (err) {
        console.error(err);
        setIngredients([]);
        setUsage([]);
      } finally {
        setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => window.clearInterval(timer);
  }, [branchId]);

  if (loading) return <div className="p-8">Loading inventory...</div>;

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-4xl font-bold">Inventory</h1>
        <p className="text-muted-foreground">Branch ingredient stock management</p>
        <p className="text-sm text-primary">Branch ID: {branchId}</p>
      </div>

      <div className="rounded-2xl border bg-card">
        <h2 className="p-5 text-xl font-bold">Current Stock</h2>
        <table className="w-full">
          <thead><tr className="border-b"><th className="p-4 text-left">Ingredient</th><th className="p-4 text-left">Stock</th><th className="p-4 text-left">Unit</th><th className="p-4 text-left">Status</th></tr></thead>
          <tbody>{ingredients.map(item => (
            <tr key={String(item.IngredientId)} className="border-b">
              <td className="p-4 font-semibold">{item.IngredientName}</td>
              <td className="p-4">{item.Stock}</td>
              <td className="p-4">{item.Unit}</td>
              <td className="p-4">{item.Stock < 100 ? <span className="rounded-full bg-red-100 px-3 py-1 text-red-600">Low Stock</span> : <span className="rounded-full bg-green-100 px-3 py-1 text-green-600">Available</span>}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      <div className="rounded-2xl border bg-card">
        <h2 className="p-5 text-xl font-bold">Recent Stock Usage</h2>
        <div className="divide-y">
          {usage.length > 0 ? usage.map((item, index) => (
            <div key={index} className="flex justify-between p-5">
              <div>
                <p className="font-semibold">{item.ingredient}</p>
                <p className="text-sm text-muted-foreground">Used: {item.used} {item.unit}</p>
                <p className="text-xs text-muted-foreground">Order ID: {item.orderId}</p>
              </div>
              <div className="text-right"><p className="text-sm">Remaining</p><p className="font-bold">{item.remaining} {item.unit}</p></div>
            </div>
          )) : <p className="p-5 text-muted-foreground">No stock usage history</p>}
        </div>
      </div>
    </div>
  );
}
