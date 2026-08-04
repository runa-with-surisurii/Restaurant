import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format, subDays } from "date-fns";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import {
  CalendarIcon,
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  TrendingDown,
  Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { branches } from "@/lib/data";
import { useStore } from "@/lib/store";
import {
  aggregateByBranch,
  aggregateByDate,
  categoryShare,
  computeKpis,
  filterSeries,
  shiftRange,
} from "@/lib/analytics";
import type { DateRange } from "react-day-picker";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtInt = (n: number) => n.toLocaleString("en-US");

type Preset = "7d" | "30d" | "90d" | "custom";

function AdminDashboard() {
  const { adminUser } = useStore();
  const isManager = adminUser?.role === "branch_manager";
  const forcedBranch = isManager ? adminUser?.branchId ?? "all" : null;
  const [branchIdState, setBranchId] = useState<string>(forcedBranch ?? "all");
  const branchId = forcedBranch ?? branchIdState;
  const [preset, setPreset] = useState<Preset>("30d");
  const [range, setRange] = useState<DateRange | undefined>(() => ({
    from: subDays(new Date(), 29),
    to: new Date(),
  }));
  const [metric, setMetric] = useState<"revenue" | "orders" | "customers">("revenue");

  const setPresetRange = (p: Preset) => {
    setPreset(p);
    if (p === "custom") return;
    const days = p === "7d" ? 6 : p === "30d" ? 29 : 89;
    setRange({ from: subDays(new Date(), days), to: new Date() });
  };

  const from = range?.from ?? subDays(new Date(), 29);
  const to = range?.to ?? new Date();

  const { current, previous, byDate, byBranch, catShare, kpis } = useMemo(() => {
    const current = filterSeries(branchId, from, to);
    const { prevFrom, prevTo } = shiftRange(from, to);
    const previous = filterSeries(branchId, prevFrom, prevTo);
    return {
      current,
      previous,
      byDate: aggregateByDate(current),
      byBranch: aggregateByBranch(filterSeries("all", from, to)),
      catShare: categoryShare(current),
      kpis: computeKpis(current, previous),
    };
  }, [branchId, from, to]);

  const exportCsv = () => {
    const rows = [["date", "revenue", "orders", "customers"], ...byDate.map((r) => [r.date, r.revenue, r.orders, r.customers])];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `ember-oak-${branchId}-${format(from, "yyyyMMdd")}-${format(to, "yyyyMMdd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const metricColor = metric === "revenue" ? "hsl(18 88% 55%)" : metric === "orders" ? "hsl(0 72% 52%)" : "hsl(34 92% 58%)";

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-4xl tracking-wide md:text-5xl">Business Intelligence</h1>
          <p className="text-sm text-muted-foreground">
            {format(from, "MMM d, yyyy")} — {format(to, "MMM d, yyyy")} ·{" "}
            {branchId === "all" ? "All branches" : branches.find((b) => b.id === branchId)?.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!isManager && (
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All branches</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Tabs value={preset} onValueChange={(v) => setPresetRange(v as Preset)}>
            <TabsList>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="90d">90d</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("gap-2", preset !== "custom" && "text-muted-foreground")}>
                <CalendarIcon className="size-4" />
                {format(from, "MMM d")} – {format(to, "MMM d")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={range}
                onSelect={(r) => {
                  setRange(r);
                  if (r?.from && r?.to) setPreset("custom");
                }}
                numberOfMonths={2}
                className="pointer-events-auto p-3"
              />
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={exportCsv} className="gap-2">
            <Download className="size-4" />
            Export
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Revenue" value={fmtMoney(kpis.revenue)} delta={kpis.revenueDelta} icon={DollarSign} accent="from-primary/20 to-primary/5" />
        <KpiCard label="Orders" value={fmtInt(kpis.orders)} delta={kpis.ordersDelta} icon={ShoppingBag} accent="from-accent/25 to-accent/5" />
        <KpiCard label="Customers" value={fmtInt(kpis.customers)} delta={kpis.customersDelta} icon={Users} accent="from-secondary/25 to-secondary/5" />
        <KpiCard label="Avg. order" value={fmtMoney(kpis.avgOrder)} delta={kpis.avgOrderDelta} icon={TrendingUp} accent="from-primary/15 to-transparent" />
      </div>

      {/* Main trend chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
          <div>
            <CardTitle>Sales trend</CardTitle>
            <CardDescription>Daily performance over the selected window.</CardDescription>
          </div>
          <Tabs value={metric} onValueChange={(v) => setMetric(v as typeof metric)}>
            <TabsList>
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="customers">Customers</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>
        <CardContent className="h-[340px] pl-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={byDate} margin={{ left: 12, right: 24, top: 8, bottom: 8 }}>
              <defs>
                <linearGradient id="mArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={metricColor} stopOpacity={0.55} />
                  <stop offset="95%" stopColor={metricColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.25)" opacity={0.4} />
              <XAxis
                dataKey="date"
                stroke="rgba(120,113,108,0.9)"
                fontSize={12}
                tickFormatter={(d: string) => format(new Date(d), "MMM d")}
                minTickGap={24}
              />
              <YAxis
                stroke="rgba(120,113,108,0.9)"
                fontSize={12}
                tickFormatter={(v: number) => (metric === "revenue" ? `$${(v / 1000).toFixed(0)}k` : fmtInt(v))}
              />
              <Tooltip
                contentStyle={{
                  background: "#ffffff",
                  border: "1px solid rgba(120,113,108,0.25)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelFormatter={(d) => format(new Date(d as string), "EEE, MMM d yyyy")}
                formatter={(v: number) => [metric === "revenue" ? fmtMoney(v) : fmtInt(v), metric]}
              />
              <Area
                type="monotone"
                dataKey={metric}
                stroke={metricColor}
                strokeWidth={2.5}
                fill="url(#mArea)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Row 2 */}
      <div className={cn("grid gap-4", isManager ? "" : "lg:grid-cols-3")}>
        {!isManager && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Revenue by branch</CardTitle>
              <CardDescription>Comparison across the chain for the selected period.</CardDescription>
            </CardHeader>
            <CardContent className="h-[320px] pl-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byBranch} margin={{ left: 12, right: 24, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.25)" opacity={0.4} />
                  <XAxis dataKey="name" stroke="rgba(120,113,108,0.9)" fontSize={11} />
                  <YAxis stroke="rgba(120,113,108,0.9)" fontSize={12} tickFormatter={(v: number) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ background: "#ffffff", border: "1px solid rgba(120,113,108,0.25)", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtMoney(v), "Revenue"]}
                  />
                  <Bar dataKey="revenue" radius={[8, 8, 0, 0]}>
                    {byBranch.map((b) => (
                      <Cell
                        key={b.branchId}
                        fill={branchId === "all" || branchId === b.branchId ? "hsl(18 88% 55%)" : "hsl(18 88% 55% / 0.35)"}
                        style={{ cursor: "pointer" }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Category mix</CardTitle>
            <CardDescription>Share of revenue by menu category.</CardDescription>
          </CardHeader>
          <CardContent className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={catShare} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {catShare.map((c) => (
                    <Cell key={c.name} fill={c.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: "#ffffff", border: "1px solid rgba(120,113,108,0.25)", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, n) => [fmtMoney(v), n as string]}
                />
                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Row 3 - Orders vs Customers line */}
      <Card>
        <CardHeader>
          <CardTitle>Orders vs. customers</CardTitle>
          <CardDescription>Volume trend to spot repeat-visit patterns.</CardDescription>
        </CardHeader>
        <CardContent className="h-[300px] pl-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDate} margin={{ left: 12, right: 24, top: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(120,113,108,0.25)" opacity={0.4} />
              <XAxis dataKey="date" stroke="rgba(120,113,108,0.9)" fontSize={12} tickFormatter={(d: string) => format(new Date(d), "MMM d")} minTickGap={24} />
              <YAxis stroke="rgba(120,113,108,0.9)" fontSize={12} />
              <Tooltip
                contentStyle={{ background: "#ffffff", border: "1px solid rgba(120,113,108,0.25)", borderRadius: 8, fontSize: 12 }}
                labelFormatter={(d) => format(new Date(d as string), "EEE, MMM d yyyy")}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="orders" stroke="hsl(0 72% 52%)" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="customers" stroke="hsl(34 92% 58%)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Branch table */}
      {!isManager && (
        <Card>
          <CardHeader>
            <CardTitle>Branch performance</CardTitle>
            <CardDescription>Ranked by revenue for the selected period.</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Branch</th>
                  <th className="py-2 pr-4 font-medium">Revenue</th>
                  <th className="py-2 pr-4 font-medium">Orders</th>
                  <th className="py-2 pr-4 font-medium">Avg. order</th>
                  <th className="py-2 pr-4 font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {byBranch.map((b) => {
                  const total = byBranch.reduce((s, x) => s + x.revenue, 0) || 1;
                  const share = (b.revenue / total) * 100;
                  return (
                    <tr key={b.branchId} className="border-b/50 border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{b.name}</td>
                      <td className="py-3 pr-4">{fmtMoney(b.revenue)}</td>
                      <td className="py-3 pr-4">{fmtInt(b.orders)}</td>
                      <td className="py-3 pr-4">{fmtMoney(b.revenue / Math.max(b.orders, 1))}</td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                            <div className="h-full bg-gradient-ember" style={{ width: `${share}%` }} />
                          </div>
                          <span className="text-xs text-muted-foreground">{share.toFixed(1)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  delta,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  delta: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  const up = delta >= 0;
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
      <Card className={cn("relative overflow-hidden bg-gradient-to-br", accent)}>
        <CardContent className="p-5">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
              <div className="mt-2 font-display text-3xl tracking-wide">{value}</div>
            </div>
            <span className="grid size-10 place-items-center rounded-lg bg-background/70 text-primary ring-1 ring-border">
              <Icon className="size-5" />
            </span>
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <Badge variant="outline" className={cn("gap-1 border-transparent", up ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600")}>
              {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {up ? "+" : ""}
              {delta.toFixed(1)}%
            </Badge>
            <span className="text-xs text-muted-foreground">vs. previous period</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}