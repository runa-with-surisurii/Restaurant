import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export type StockUsageRow = {
  orderId: string;
  IngredientName: string;
  used: number;
  unit: string;
  beforeStock: number;
  remaining: number;
  createdAt?: string;
};

export function RecentStockUsage({ branchId }: { branchId?: string | null }) {
  const [rows, setRows] = useState<StockUsageRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!branchId) return;
    let active = true;
    const load = async () => {
      try {
        const response = await fetch(`http://127.0.0.1:8000/api/branch-inventory/${encodeURIComponent(branchId)}/stock-usage`);
        if (!response.ok) throw new Error("Unable to load stock usage");
        const data = await response.json();
        if (active) setRows(Array.isArray(data) ? data : []);
      } catch {
        if (active) setRows([]);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [branchId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Stock Usage</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading stock usage...</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No stock usage recorded yet. Confirm an order to create a usage transaction.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="px-3 py-3">Ingredient</th><th className="px-3 py-3">Used</th><th className="px-3 py-3">Before</th><th className="px-3 py-3">Remaining</th><th className="px-3 py-3">Order</th></tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, index) => (
                  <tr key={`${row.orderId}-${row.IngredientName}-${index}`}>
                    <td className="px-3 py-3 font-medium">{row.IngredientName}</td>
                    <td className="px-3 py-3"><Badge variant="outline">-{row.used} {row.unit}</Badge></td>
                    <td className="px-3 py-3 text-muted-foreground">{row.beforeStock} {row.unit}</td>
                    <td className="px-3 py-3 font-semibold">{row.remaining} {row.unit}</td>
                    <td className="px-3 py-3 font-mono text-xs">#{row.orderId.slice(-6)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
