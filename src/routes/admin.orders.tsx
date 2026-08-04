import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useStore, type Order, type OrderStatus } from "@/lib/store";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({ meta: [{ title: "Live Orders — Admin" }, { name: "robots", content: "noindex" }] }),
  component: OrdersAdmin,
});

const statusFlow: Record<OrderStatus, OrderStatus | null> = {
  placed: "preparing",
  preparing: "ready",
  ready: "completed",
  completed: null,
  cancelled: null,
};

const statusColor: Record<OrderStatus, string> = {
  placed: "bg-blue-500/10 text-blue-600",
  preparing: "bg-amber-500/10 text-amber-700",
  ready: "bg-emerald-500/10 text-emerald-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/10 text-red-600",
};

export function OrdersAdmin() {
  const { orders, adminUser, branchesState, updateOrderStatus, cancelOrder } = useStore();
  const isManager = adminUser?.role === "branch_manager";
  const forcedBranch = isManager ? adminUser?.branchId : undefined;
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [branchFilter, setBranchFilter] = useState<string>(forcedBranch ?? "all");
  const activeBranch = forcedBranch ?? branchFilter;

  const filtered = useMemo(() => {
    return orders.filter(
      (o) =>
        (status === "all" || o.status === status) &&
        (activeBranch === "all" || o.branchId === activeBranch),
    );
  }, [orders, status, activeBranch]);

  const counts = useMemo(() => {
    const c: Record<OrderStatus, number> = {
      placed: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0,
    };
    for (const o of orders) {
      if (activeBranch !== "all" && o.branchId !== activeBranch) continue;
      c[o.status]++;
    }
    return c;
  }, [orders, activeBranch]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="font-display text-3xl tracking-wide md:text-4xl">Live Orders</h1>
          <p className="text-sm text-muted-foreground">Advance orders through the kitchen &amp; pass.</p>
        </div>
        {!isManager && (
          <Select value={branchFilter} onValueChange={setBranchFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {branchesState.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {(["placed", "preparing", "ready", "completed", "cancelled"] as OrderStatus[]).map((s) => (
          <Card key={s}>
            <CardContent className="p-4">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">{s}</div>
              <div className="mt-1 font-display text-2xl">{counts[s]}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs value={status} onValueChange={(v) => setStatus(v as typeof status)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="placed">Placed</TabsTrigger>
          <TabsTrigger value="preparing">Preparing</TabsTrigger>
          <TabsTrigger value="ready">Ready</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>{filtered.length} order{filtered.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No orders yet. Place one from the customer site to see it here.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Order</th>
                  <th className="py-2 pr-4 font-medium">Placed</th>
                  <th className="py-2 pr-4 font-medium">Branch</th>
                  <th className="py-2 pr-4 font-medium">Guest</th>
                  <th className="py-2 pr-4 font-medium">Items</th>
                  <th className="py-2 pr-4 font-medium">Total</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((o) => (
                  <OrderRow
                    key={o.id}
                    order={o}
                    branchName={branchesState.find((b) => b.id === o.branchId)?.name ?? o.branchId}
                    onAdvance={() => {
                      const next = statusFlow[o.status];
                      if (next) {
                        updateOrderStatus(o.id, next);
                        toast.success(`Order ${o.id} → ${next}`);
                      }
                    }}
                    onCancel={() => {
                      cancelOrder(o.id);
                      toast("Order cancelled");
                    }}
                  />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderRow({
  order,
  branchName,
  onAdvance,
  onCancel,
}: {
  order: Order;
  branchName: string;
  onAdvance: () => void;
  onCancel: () => void;
}) {
  const next = statusFlow[order.status];
  const active = order.status !== "completed" && order.status !== "cancelled";
  return (
    <tr className="border-b last:border-0 align-top">
      <td className="py-3 pr-4 font-mono text-xs">{order.id}</td>
      <td className="py-3 pr-4 text-xs text-muted-foreground">{format(new Date(order.createdAt), "MMM d, HH:mm")}</td>
      <td className="py-3 pr-4">{branchName}</td>
      <td className="py-3 pr-4">
        <div>{order.guestName ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{order.phone ?? ""}</div>
      </td>
      <td className="py-3 pr-4 text-xs text-muted-foreground">
        {order.items.reduce((s, i) => s + i.qty, 0)} item{order.items.length === 1 ? "" : "s"}
      </td>
      <td className="py-3 pr-4 font-medium">${order.total.toFixed(2)}</td>
      <td className="py-3 pr-4">
        <Badge variant="outline" className={statusColor[order.status]}>{order.status}</Badge>
      </td>
      <td className="py-3 pr-4 text-right">
        <div className="flex justify-end gap-2">
          {next && (
            <Button size="sm" onClick={onAdvance}>
              Mark {next}
            </Button>
          )}
          {active && (
            <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
          )}
        </div>
      </td>
    </tr>
  );
}
