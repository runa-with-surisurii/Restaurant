import { createFileRoute } from "@tanstack/react-router";
import { useMemo } from "react";
import { format, subDays, isToday, isTomorrow, parseISO } from "date-fns";
import { motion } from "framer-motion";
import {
  DollarSign,
  ShoppingBag,
  Users,
  TrendingUp,
  CalendarDays,
  Clock,
  ChefHat,
  UtensilsCrossed,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  MapPin,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useStore } from "@/lib/store";
import { branches } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/branch-manager/")({
  component: BranchManagerDashboard,
});

const fmtMoney = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmtInt = (n: number) => n.toLocaleString("en-US");

function BranchManagerDashboard() {
  const { adminUser, orders, bookings, dishesState, availability } = useStore();

  const branchId = adminUser?.branchId ?? (adminUser?.role === "main_admin" ? branches[0]?.id : null);
  const branch = branches.find((b) => b.id === branchId);

  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  const { todaysOrders, todaysRevenue, todaysBookings, upcomingBookings, liveOrders, lowStockItems, topItems } = useMemo(() => {
    const branchOrders = orders.filter((o) => o.branchId === branchId);

    const todaysOrders = branchOrders.filter((o) => {
      const d = parseISO(o.createdAt);
      return format(d, "yyyy-MM-dd") === todayStr;
    });

    const todaysRevenue = todaysOrders.reduce((s, o) => s + o.total, 0);

    const todaysBookings = bookings.filter((b) => {
      if (b.branchId !== branchId) return false;
      return b.date === todayStr && b.status !== "cancelled";
    });

    const upcomingBookings = bookings
      .filter((b) => b.branchId === branchId && b.status !== "cancelled")
      .filter((b) => {
        const d = parseISO(b.date + "T" + b.time);
        return d >= new Date(today.getTime() - 2 * 60 * 60 * 1000);
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 8);

    const liveOrders = branchOrders
      .filter((o) => ["placed", "preparing", "ready"].includes(o.status))
      .sort((a, b) => parseISO(b.createdAt).getTime() - parseISO(a.createdAt).getTime())
      .slice(0, 6);

    const qtySold = new Map<string, number>();
    todaysOrders.forEach((o) => {
      o.items.forEach((it) => qtySold.set(it.dishId, (qtySold.get(it.dishId) ?? 0) + it.qty));
    });
    const topItems = Array.from(qtySold.entries())
      .map(([dishId, qty]) => ({ dish: dishesState.find((d) => d.id === dishId), qty }))
      .filter((x) => x.dish)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    const lowStockItems = dishesState
      .filter((d) => branchId && availability[branchId]?.[d.id] === false)
      .slice(0, 6);

    return {
      todaysOrders,
      todaysRevenue,
      todaysBookings,
      upcomingBookings,
      liveOrders,
      lowStockItems,
      topItems,
    };
  }, [orders, bookings, branchId, dishesState, availability, todayStr]);

  const orderStatusMeta: Record<string, { label: string; cls: string; icon: any }> = {
    placed: { label: "Placed", cls: "bg-blue-500/10 text-blue-600 ring-blue-500/20", icon: ShoppingBag },
    preparing: { label: "Preparing", cls: "bg-amber-500/10 text-amber-600 ring-amber-500/20", icon: ChefHat },
    ready: { label: "Ready", cls: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20", icon: CheckCircle2 },
    completed: { label: "Completed", cls: "bg-slate-500/10 text-slate-600 ring-slate-500/20", icon: CheckCircle2 },
    cancelled: { label: "Cancelled", cls: "bg-red-500/10 text-red-600 ring-red-500/20", icon: AlertTriangle },
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold uppercase tracking-wider">
            <MapPin className="size-3.5 text-primary" />
            {branch?.name ?? "All branches"}
          </div>
          <h1 className="mt-3 font-display text-4xl tracking-wide md:text-5xl">
            Branch Manager Dashboard
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(today, "EEEE, MMMM d, yyyy")} · Real-time view of today's shift
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/branch-manager/orders">View all orders <ArrowRight className="ml-1 size-4" /></Link>
          </Button>
          <Button asChild className="bg-gradient-ember text-primary-foreground shadow-ember hover:opacity-90">
            <Link to="/branch-manager/bookings">Reservations &amp; floor</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Today's Revenue"
          value={fmtMoney(todaysRevenue)}
          icon={DollarSign}
          accent="from-primary/20 to-primary/5"
          delta={12.4}
        />
        <KpiCard
          label="Today's Orders"
          value={fmtInt(todaysOrders.length)}
          icon={ShoppingBag}
          accent="from-accent/25 to-accent/5"
          delta={8.1}
        />
        <KpiCard
          label="Bookings Today"
          value={fmtInt(todaysBookings.length)}
          icon={CalendarDays}
          accent="from-secondary/25 to-secondary/5"
          delta={-3.2}
        />
        <KpiCard
          label="Covers Est."
          value={fmtInt(
            todaysBookings.reduce((s, b) => s + b.partySize, 0) + Math.round(todaysOrders.length * 1.4),
          )}
          icon={Users}
          accent="from-primary/15 to-transparent"
          delta={5.7}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Live orders</CardTitle>
              <CardDescription>Currently in the kitchen or ready.</CardDescription>
            </div>
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="active">Active</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="space-y-3">
            {liveOrders.length === 0 ? (
              <EmptyState icon={ShoppingBag} title="No active orders" desc="New orders will appear here automatically." />
            ) : (
              liveOrders.map((o, i) => {
                const meta = orderStatusMeta[o.status] ?? orderStatusMeta.placed;
                return (
                  <motion.div
                    key={o.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-4"
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-xl bg-muted/60 ring-1 ring-border/60">
                        <meta.icon className="size-4 text-primary" />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{o.id}</span>
                          <Badge className={cn("ring-1", meta.cls)} variant="outline">{meta.label}</Badge>
                        </div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {o.items.reduce((s, i) => s + i.qty, 0)} items · {o.guestName ?? "Walk-in"} · {format(parseISO(o.createdAt), "h:mm a")}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-lg">{fmtMoney(o.total)}</div>
                      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{o.mode}</div>
                    </div>
                  </motion.div>
                );
              })
            )}
            {liveOrders.length > 0 && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/branch-manager/orders">Open all orders →</Link>
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming bookings</CardTitle>
            <CardDescription>Next arrivals for this branch.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingBookings.length === 0 ? (
              <EmptyState icon={CalendarDays} title="No upcoming bookings" desc="Reservations will show up here." />
            ) : (
              upcomingBookings.map((b) => (
                <div key={b.id} className="rounded-xl border border-border/60 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="size-4 text-primary" />
                      <span className="text-sm font-semibold">{b.time}</span>
                    </div>
                    <Badge variant="outline" className={cn(b.status === "confirmed" && "bg-primary/10 text-primary ring-primary/20", b.status === "seated" && "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20")}>
                      {b.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm">
                    <span className="font-medium">{b.guestName}</span>
                    <span className="mx-1 text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{b.partySize} guests</span>
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    Table {b.tableId} · {isToday(parseISO(b.date)) ? "Today" : isTomorrow(parseISO(b.date)) ? "Tomorrow" : format(parseISO(b.date), "MMM d")}
                  </div>
                </div>
              ))
            )}
            {upcomingBookings.length > 0 && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/branch-manager/bookings">Floor plan →</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Top sellers today</CardTitle>
              <CardDescription>Highest-volume menu items.</CardDescription>
            </div>
            <UtensilsCrossed className="size-5 text-muted-foreground" />
          </CardHeader>
          <CardContent className="space-y-2">
            {topItems.length === 0 ? (
              <EmptyState icon={UtensilsCrossed} title="No sales yet" desc="Today's top dishes will appear here." />
            ) : (
              topItems.map((t, i) => (
                <div key={t.dish!.id} className="flex items-center justify-between rounded-xl p-2 hover:bg-muted/40">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 w-12 shrink-0 place-items-center rounded-lg bg-gradient-ember text-sm font-bold text-primary-foreground shadow-ember">
                      #{i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-medium">{t.dish!.name}</div>
                      <div className="text-xs text-muted-foreground">{t.dish!.tags.slice(0, 3).join(" · ")}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{t.qty}× sold</div>
                    <div className="text-xs text-muted-foreground">{fmtMoney(t.qty * t.dish!.price)}</div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Availability alerts</CardTitle>
              <CardDescription>Items currently marked out-of-stock at this branch.</CardDescription>
            </div>
            <AlertTriangle className="size-5 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-2">
            {lowStockItems.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="All items available" desc="Everything on the menu is in stock." positive />
            ) : (
              lowStockItems.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-amber-500/10 ring-1 ring-amber-500/20">
                      <AlertTriangle className="size-4 text-amber-600" />
                    </span>
                    <div>
                      <div className="font-medium">{d.name}</div>
                      <div className="text-xs text-muted-foreground">Toggle in Menu Availability</div>
                    </div>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <Link to="/branch-manager/menu-availability">Fix</Link>
                  </Button>
                </div>
              ))
            )}
            {lowStockItems.length > 0 && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link to="/branch-manager/menu-availability">Manage availability →</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  delta,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
  delta: number;
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
              {up ? <TrendingUp className="size-3" /> : <TrendingUp className="size-3 rotate-180" />}
              {up ? "+" : ""}{delta.toFixed(1)}%
            </Badge>
            <span className="text-xs text-muted-foreground">vs yesterday</span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EmptyState({ icon: Icon, title, desc, positive }: { icon: any; title: string; desc: string; positive?: boolean }) {
  return (
    <div className="grid place-items-center rounded-xl border border-dashed border-border/70 p-8 text-center">
      <span className={cn("grid size-12 place-items-center rounded-2xl ring-1", positive ? "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20" : "bg-muted/60 text-muted-foreground ring-border")}>
        <Icon className="size-5" />
      </span>
      <div className="mt-3 font-semibold">{title}</div>
      <div className="mt-0.5 text-xs text-muted-foreground">{desc}</div>
    </div>
  );
}
