import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useStore, type OrderStatus, type BookingStatus } from "@/lib/store";

export const Route = createFileRoute("/admin/overview")({
  head: () => ({ meta: [{ title: "Chain Overview — Admin" }, { name: "robots", content: "noindex" }] }),
  component: Overview,
});

const orderColor: Record<OrderStatus, string> = {
  placed: "bg-blue-500/10 text-blue-600",
  preparing: "bg-amber-500/10 text-amber-700",
  ready: "bg-emerald-500/10 text-emerald-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/10 text-red-600",
};
const bookingColor: Record<BookingStatus, string> = {
  confirmed: "bg-blue-500/10 text-blue-600",
  seated: "bg-amber-500/10 text-amber-700",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-red-500/10 text-red-600",
};

function Overview() {
  const { adminUser, orders, bookings, branchesState } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (adminUser && adminUser.role !== "main_admin") navigate({ to: "/admin" });
  }, [adminUser, navigate]);

  const perBranch = useMemo(() => {
    return branchesState.map((b) => {
      const bOrders = orders.filter((o) => o.branchId === b.id);
      const bBookings = bookings.filter((k) => k.branchId === b.id);
      return {
        branch: b,
        activeOrders: bOrders.filter((o) => o.status === "placed" || o.status === "preparing" || o.status === "ready").length,
        totalOrders: bOrders.length,
        upcomingBookings: bBookings.filter((k) => k.status === "confirmed" || k.status === "seated").length,
        totalBookings: bBookings.length,
      };
    });
  }, [orders, bookings, branchesState]);

  const branchName = (id: string) => branchesState.find((b) => b.id === id)?.name ?? id;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide md:text-4xl">Chain Overview</h1>
        <p className="text-sm text-muted-foreground">Live view across every branch.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {perBranch.map((r) => (
          <Card key={r.branch.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{r.branch.name}</CardTitle>
              <CardDescription>{r.branch.city}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active orders</span>
                <span className="font-medium">{r.activeOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total orders</span>
                <span className="font-medium">{r.totalOrders}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Upcoming bookings</span>
                <span className="font-medium">{r.upcomingBookings}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total bookings</span>
                <span className="font-medium">{r.totalBookings}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent orders</CardTitle>
            <CardDescription>Latest across the chain</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {orders.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {orders.slice(0, 10).map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 font-mono text-xs">{o.id}</td>
                      <td className="py-2 pr-2 text-xs">{branchName(o.branchId)}</td>
                      <td className="py-2 pr-2 text-xs text-muted-foreground">
                        {format(new Date(o.createdAt), "MMM d HH:mm")}
                      </td>
                      <td className="py-2 pr-2">${o.total.toFixed(2)}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={orderColor[o.status]}>{o.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Upcoming bookings</CardTitle>
            <CardDescription>Across the chain</CardDescription>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            {bookings.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No bookings yet.</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {bookings.slice(0, 10).map((b) => (
                    <tr key={b.id} className="border-b last:border-0">
                      <td className="py-2 pr-2 text-xs">
                        {format(new Date(b.date), "MMM d")} · {b.time}
                      </td>
                      <td className="py-2 pr-2 text-xs">{branchName(b.branchId)}</td>
                      <td className="py-2 pr-2">{b.guestName}</td>
                      <td className="py-2 pr-2 text-xs">party {b.partySize}</td>
                      <td className="py-2">
                        <Badge variant="outline" className={bookingColor[b.status]}>{b.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
