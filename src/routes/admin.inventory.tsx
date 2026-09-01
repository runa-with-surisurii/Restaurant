import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Package, AlertTriangle, TrendingDown, Warehouse, Filter, ArrowUpDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { useBranchShell } from "@/components/branch-admin/BranchShell";
import { RecentStockUsage } from "@/components/recent-stock-usage";

export const Route = createFileRoute("/admin/inventory")({
  head: () => ({ meta: [{ title: "Inventory — Taste & Treasure" }, { name: "robots", content: "noindex" }] }),
  component: () => <InventoryPage key="admin" />,
});

type InvItem = {
  id: string;
  name: string;
  category: string;
  inStock: number;
  unit: string;
  reorderLevel: number | null;
  supplier: string;
  lastRestock: string;
  branchId: string;
};

const API = "http://127.0.0.1:8000";

export function InventoryPage() {
  const { adminUser } = useStore();
  const { activeBranchId, section } = useBranchShell();
  const branchId = adminUser?.branchId ?? (section === "chain" ? "all" : activeBranchId);
  const [tab, setTab] = useState<"all" | "low" | "out">("all");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<InvItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    setError("");
    fetch(`${API}/api/branch-inventory/${encodeURIComponent(String(branchId))}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`Inventory API ${r.status}`);
        return r.json();
      })
      .then((rows) => {
        const data = Array.isArray(rows) ? rows : [];
        setItems(data.map((row: any, index: number) => ({
          id: `${row.branchId ?? branchId}-${row.IngredientId ?? index}`,
          name: row.IngredientName ?? "Unknown",
          category: row.category ?? "Ingredient",
          inStock: Number(row.Stock ?? row.stock_quantity ?? 0),
          unit: row.Unit ?? row.unit ?? "",
          reorderLevel: row.reorderLevel == null ? null : Number(row.reorderLevel),
          supplier: row.supplier ?? "",
          lastRestock: row.lastRestock ?? "",
          branchId: String(row.branchId ?? branchId),
        })));
      })
      .catch((e) => {
        console.error(e);
        setItems([]);
        setError("Could not load inventory from the database.");
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  const { filtered, kpis } = useMemo(() => {
    const isLow = (i: InvItem) => i.inStock > 0 && i.reorderLevel != null && i.inStock <= i.reorderLevel;
    let filteredItems = items.filter((i) => {
      if (tab === "low") return isLow(i);
      if (tab === "out") return i.inStock <= 0;
      return true;
    });
    if (q.trim()) {
      const s = q.toLowerCase();
      filteredItems = filteredItems.filter((i) =>
        i.name.toLowerCase().includes(s) || i.category.toLowerCase().includes(s) || i.supplier.toLowerCase().includes(s)
      );
    }
    return {
      filtered: filteredItems,
      kpis: {
        totalSKUs: items.length,
        lowStock: items.filter(isLow).length,
        outStock: items.filter((i) => i.inStock <= 0).length,
        stockValue: 0,
      },
    };
  }, [items, tab, q]);

  const statusOf = (i: InvItem) => {
    if (i.inStock <= 0) return { label: "Out of Stock", cls: "bg-red-500/10 text-red-600 ring-red-500/20", icon: AlertTriangle, pct: 0 };
    if (i.reorderLevel != null && i.inStock <= i.reorderLevel) {
      const pct = Math.min(100, Math.round((i.inStock / Math.max(i.reorderLevel * 2.5, 1)) * 100));
      return { label: "Reorder", cls: "bg-amber-500/10 text-amber-600 ring-amber-500/20", icon: TrendingDown, pct };
    }
    const pct = i.reorderLevel != null ? Math.min(100, Math.round((i.inStock / Math.max(i.reorderLevel * 2.5, 1)) * 100)) : 100;
    return { label: "In Stock", cls: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20", icon: Warehouse, pct };
  };

  return <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
    <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
      <div><h1 className="font-display text-4xl tracking-wide md:text-5xl">Inventory</h1><p className="mt-1 text-sm text-muted-foreground">Live stock levels from the MongoDB branch inventory.</p></div>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KPI label="Total SKUs" value={String(kpis.totalSKUs)} icon={Package}/>
      <KPI label="Low Stock Alerts" value={String(kpis.lowStock)} icon={TrendingDown}/>
      <KPI label="Out of Stock" value={String(kpis.outStock)} icon={AlertTriangle}/>
      <KPI label="Database Stock" value={loading ? "…" : "Live"} icon={Warehouse}/>
    </div>

    {error && <Card><CardContent className="p-5 text-sm text-red-600">{error}</CardContent></Card>}

    <Card>
      <CardHeader className="gap-4 space-y-0 md:flex-row md:items-center md:justify-between">
        <div><CardTitle>Stock list</CardTitle><CardDescription>{loading ? "Loading database stock…" : `${filtered.length} items · live database data`}</CardDescription></div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}><TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="low">⚠️ Low stock</TabsTrigger><TabsTrigger value="out">❌ Out</TabsTrigger></TabsList></Tabs>
          <div className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/><Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search ingredients..." className="w-full pl-9 sm:w-64"/></div>
          <Button variant="outline" size="icon" title="Sort"><ArrowUpDown className="size-4"/></Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-hidden rounded-xl border border-border/60">
          <table className="w-full text-sm"><thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"><tr><th className="px-4 py-3">Item</th><th className="px-4 py-3">Branch</th><th className="px-4 py-3">In Stock</th><th className="hidden px-4 py-3 md:table-cell">Reorder At</th><th className="px-4 py-3">Status</th></tr></thead>
          <tbody className="divide-y divide-border/60">
            {filtered.map((it, i) => { const s = statusOf(it), Icon = s.icon; return <motion.tr key={it.id} initial={{opacity:0,y:4}} animate={{opacity:1,y:0}} transition={{delay:i*0.02}} className="hover:bg-muted/30">
              <td className="px-4 py-3 font-medium">{it.name}</td><td className="px-4 py-3 text-muted-foreground">{it.branchId}</td>
              <td className="px-4 py-3"><div className="font-semibold">{it.inStock}<span className="ml-1 text-xs font-normal text-muted-foreground">{it.unit}</span></div><div className="mt-1 w-24"><Progress value={s.pct} className="h-1.5"/></div></td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{it.reorderLevel == null ? "—" : `${it.reorderLevel} ${it.unit}`}</td>
              <td className="px-4 py-3"><Badge variant="outline" className={cn("gap-1.5 ring-1", s.cls)}><Icon className="size-3"/>{s.label}</Badge></td>
            </motion.tr>; })}
            {!loading && !filtered.length && <tr><td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">No database inventory items match your filters.</td></tr>}
          </tbody></table>
        </div>
      </CardContent>
    </Card>
    {branchId ? <RecentStockUsage branchId={String(branchId)}/> : null}
  </div>;
}

function KPI({label,value,icon:Icon}:any){return <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}><Card><CardContent className="p-5"><div className="flex items-start justify-between"><div><div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-2 font-display text-3xl tracking-wide">{value}</div></div><span className="grid size-10 place-items-center rounded-lg bg-background/70 text-primary ring-1 ring-border"><Icon className="size-5"/></span></div></CardContent></Card></motion.div>}
