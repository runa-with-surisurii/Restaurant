import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  DollarSign,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency } from "@/lib/utils";

export const Route = createFileRoute("/admin/menu-insights")({
  head: () => ({
    meta: [{ title: "Menu Insights — Admin" }, { name: "robots", content: "noindex" }],
  }),
  component: MenuInsightsPage,
});

type AssociationRule = {
  antecedent: string[];
  consequent: string[];
  support: number;
  confidence: number;
  lift: number;
  rule: string;
};

type InsightRow = {
  menuId: string;
  menu: string;
  category: string;
  sold: number;
  revenue: number;
  orders: number;
  growth: number | null;
  score: number;
  group: string;
  trend: string;
  action: string;
  profit: number | null;
  image?: string;
  shareOfQuantity?: number;
  shareOfRevenue?: number;
};
type Group = { name: string; count: number; example: string | null };
type InsightData = {
  branches: Array<{ id: string; name: string; city: string }>;
  selectedBranch: string;
  hasProfit: boolean;
  summary: {
    totalRevenue: number;
    totalQuantity: number;
    estimatedProfit: number;
    orders: number;
  };
  groups: Group[];
  rows: InsightRow[];
  trending: InsightRow[];
  associationRules: AssociationRule[];
  categoryBreakdown: Array<{
    category: string;
    revenue: number;
    quantity: number;
    profit: number;
    margin: number;
  }>;
  branchBreakdown: Array<{
    branchId: string;
    branchName: string;
    revenue: number;
    quantity: number;
    profit: number;
  }>;
};

const groupMeta = {
  "Best Sellers": {
    icon: Sparkles,
    color: "text-primary",
    panel: "bg-primary/10",
    description: "Highest contribution to sales and revenue",
  },
  "Steady Performers": {
    icon: TrendingUp,
    color: "text-emerald-600",
    panel: "bg-emerald-500/10",
    description: "Solid sales with moderate performance",
  },
  "Needs Attention": {
    icon: AlertTriangle,
    color: "text-destructive",
    panel: "bg-destructive/10",
    description: "Lower contribution and weaker lift",
  },
};

const categoryColors: Record<string, string> = {
  burgers: "bg-orange-500/15 text-orange-700",
  chicken: "bg-amber-500/15 text-amber-700",
  drinks: "bg-sky-500/15 text-sky-700",
  desserts: "bg-pink-500/15 text-pink-700",
  salads: "bg-emerald-500/15 text-emerald-700",
};

function groupBadgeClass(group: string) {
  if (group === "Best Sellers") return "border-primary/30 bg-primary/10 text-primary";
  if (group === "Steady Performers") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
  return "border-destructive/30 bg-destructive/10 text-destructive";
}

function MenuInsightsPage() {
  const [mode, setMode] = useState("overall");
  const [branch, setBranch] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [data, setData] = useState<InsightData | null>(null);
  const [error, setError] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(
      `http://127.0.0.1:8000/api/menu-insights?branch_id=${encodeURIComponent(mode === "branch" ? branch : "all")}`,
    )
      .then((response) =>
        response.ok ? response.json() : Promise.reject(new Error("Unable to load menu insights")),
      )
      .then((payload) => setData(payload as InsightData))
      .catch((reason) =>
        setError(reason instanceof Error ? reason.message : "Unable to load menu insights"),
      );
  }, [mode, branch]);

  const rows = useMemo(
    () => data?.rows.filter((row) => selectedGroup === "all" || row.group === selectedGroup) ?? [],
    [data, selectedGroup],
  );
  const groups = data?.groups ?? [];
  const topAssociationRules = useMemo(() => {
    return [...(data?.associationRules ?? [])]
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 5)
      .map((rule, index) => ({
        ...rule,
        rank: index + 1,
      }));
  }, [data]);
  const strongestRule = useMemo(() => {
    return [...(data?.associationRules ?? [])].sort((a, b) => b.lift - a.lift)[0] ?? null;
  }, [data]);
  const branchLabel = mode === "branch" ? data?.branches.find((item) => item.id === branch)?.name ?? "Branch" : "All Branches";

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-4xl tracking-wide md:text-5xl">Menu Insights</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Data-mining insights from completed orders: menu performance and item associations.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value);
              setSelectedGroup("all");
            }}
          >
            <TabsList>
              <TabsTrigger value="overall">Overall</TabsTrigger>
              <TabsTrigger value="branch">By Branch</TabsTrigger>
            </TabsList>
          </Tabs>
          {mode === "branch" && data && (
            <Select value={branch} onValueChange={setBranch}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Select branch" />
              </SelectTrigger>
              <SelectContent>
                {data.branches.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}
      {!data && !error && (
        <Card>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            Loading menu insights...
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Total Revenue</CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(data.summary.totalRevenue)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Quantity Sold</CardDescription>
                <CardTitle className="text-2xl">{data.summary.totalQuantity.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Estimated Gross Profit</CardDescription>
                <CardTitle className="text-2xl">{formatCurrency(data.summary.estimatedProfit)}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardDescription>Completed Orders</CardDescription>
                <CardTitle className="text-2xl">{data.summary.orders.toLocaleString()}</CardTitle>
              </CardHeader>
            </Card>
          </section>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {groups.map((group) => {
              const meta = groupMeta[group.name as keyof typeof groupMeta];
              const Icon = meta.icon;
              return (
                <button
                  type="button"
                  key={group.name}
                  onClick={() => {
                    const nextGroup = selectedGroup === group.name ? "all" : group.name;
                    setSelectedGroup(nextGroup);
                    requestAnimationFrame(() => tableRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
                  }}
                  aria-pressed={selectedGroup === group.name}
                  className="text-left"
                >
                  <Card
                    className={
                      selectedGroup === group.name
                        ? `border-primary ring-1 ring-primary ${meta.panel}`
                        : `transition hover:border-primary/60 ${meta.panel}`
                    }
                  >
                    <CardHeader className="flex-row items-start justify-between space-y-0">
                      <div>
                        <CardDescription className="font-medium">{group.name}</CardDescription>
                        <CardTitle className="mt-2 text-2xl">{group.count} menus</CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">{meta.description}</p>
                      </div>
                      <span className="rounded-full bg-background/70 p-2">
                        <Icon className={`size-5 ${meta.color}`} />
                      </span>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between text-sm">
                      <span className="truncate font-medium">
                        {group.example ?? "No menu data"}
                      </span>
                      <ArrowUpRight className={`size-4 ${meta.color}`} />
                    </CardContent>
                  </Card>
                </button>
              );
            })}
          </div>

          <section className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Menu Combination Insights</CardTitle>
                <CardDescription>
                  FP-Growth association rules on completed orders. Results show which items are commonly bought together, not future sales predictions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {topAssociationRules.length ? (
                  <>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      {topAssociationRules.map((rule) => {
                        const isStrongest = rule.rank === 1;
                        const combinationItems = rule.rule
                          .split(" + ")
                          .map((item) => item.trim())
                          .filter(Boolean);

                        return (
                          <div
                            key={`${rule.rule}-${rule.rank}`}
                            className={[
                              "rounded-xl border p-3 shadow-sm transition-all",
                              isStrongest
                                ? "border-primary/50 bg-primary/5 ring-1 ring-primary/20"
                                : "border-border bg-background/80 hover:border-primary/40",
                            ].join(" ")}
                          >
                            <div className="mb-3 flex items-center justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                Rank #{rule.rank}
                              </span>
                              {isStrongest && (
                                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                                  Strongest
                                </span>
                              )}
                            </div>

                            <div className="space-y-2 text-sm">
                              <div className="min-w-0">
                                <p className="text-xs uppercase tracking-wide text-muted-foreground">Combination</p>
                                <div className="mt-1 flex min-w-0 flex-col gap-1">
                                  {combinationItems.length ? (
                                    combinationItems.map((item, index) => (
                                      <span
                                        key={`${item}-${index}`}
                                        className="break-words text-sm font-medium leading-snug text-foreground"
                                      >
                                        {item}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="break-words text-sm font-medium leading-snug text-foreground">
                                      {rule.rule}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="rounded-lg bg-muted/40 px-2 py-2">
                                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Combo Strength</p>
                                <p className="mt-1 text-lg font-bold text-primary">{rule.lift.toFixed(2)}×</p>
                              </div>

                              <div className="space-y-1 text-xs text-muted-foreground">
                                <div className="flex items-center justify-between gap-2">
                                  <span>Order Frequency</span>
                                  <span className="font-medium text-foreground">{rule.support.toFixed(2)}%</span>
                                </div>
                                <div className="flex items-center justify-between gap-2">
                                  <span>Co-Order Rate</span>
                                  <span className="font-medium text-foreground">{rule.confidence.toFixed(1)}%</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[700px] text-sm">
                        <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                          <tr>
                            {['Combination / Rule', 'Order Frequency', 'Co-Order Rate', 'Combo Strength'].map((heading) => (
                              <th key={heading} className="px-4 py-3">{heading}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.associationRules.map((rule, index) => (
                            <tr key={`${rule.rule}-${index}`} className="border-t odd:bg-background even:bg-muted/20">
                              <td className="px-4 py-3 font-medium">{rule.rule}</td>
                              <td className="px-4 py-3">{rule.support.toFixed(2)}%</td>
                              <td className="px-4 py-3">{rule.confidence.toFixed(1)}%</td>
                              <td className="px-4 py-3">{rule.lift.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No strong item associations were found for the selected branch/period. This can happen when most orders contain only one menu item.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>

          {mode === "overall" && data.branchBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Branch comparison</CardTitle>
                <CardDescription>Completed-order revenue, quantity, and estimated profit by branch.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[600px] text-sm">
                    <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3">Branch</th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Revenue</th>
                        <th className="px-4 py-3">Estimated Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.branchBreakdown.map((branchItem) => (
                        <tr key={branchItem.branchId} className="border-t odd:bg-background even:bg-muted/20">
                          <td className="px-4 py-3 font-medium">{branchItem.branchName}</td>
                          <td className="px-4 py-3">{branchItem.quantity.toLocaleString()}</td>
                          <td className="px-4 py-3">{formatCurrency(branchItem.revenue)}</td>
                          <td className="px-4 py-3">{formatCurrency(branchItem.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          <Card ref={tableRef}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="size-5 text-primary" /> Menu Performance
              </CardTitle>
              <CardDescription>
                {selectedGroup !== "all"
                  ? `${rows.length} menus in ${selectedGroup}.`
                  : `${branchLabel} • completed orders only`}
              </CardDescription>
              {selectedGroup !== "all" && (
                <Button variant="outline" size="sm" className="mt-3 w-fit" onClick={() => setSelectedGroup("all")}>
                  Clear group filter
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[1000px] text-sm">
                  <thead className="bg-muted/40 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {[
                        "Rank",
                        "Menu",
                        "Category",
                        "Quantity Sold",
                        "Revenue",
                        "Estimated Profit",
                        "Orders",
                        "Group",
                        "Action",
                      ].map((heading) => (
                        <th key={heading} className="px-4 py-3">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={row.menuId} className="border-t odd:bg-background even:bg-muted/20 hover:bg-primary/5">
                        <td className="px-4 py-3 font-semibold text-muted-foreground">#{index + 1}</td>
                        <td className="px-4 py-3 font-medium">{row.menu}</td>
                        <td className="px-4 py-3">{row.category}</td>
                        <td className="px-4 py-3">{row.sold.toLocaleString()}</td>
                        <td className="px-4 py-3">{formatCurrency(row.revenue)}</td>
                        <td className="px-4 py-3">{formatCurrency(row.profit ?? 0)}</td>
                        <td className="px-4 py-3">{row.orders}</td>
                        <td className="px-4 py-3">
                          <Badge className={groupBadgeClass(row.group)} variant="outline">{row.group}</Badge>
                        </td>
                        <td className="px-4 py-3">{row.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!rows.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">No menu performance data for the selected filters.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
