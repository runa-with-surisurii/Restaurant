import { createFileRoute } from "@tanstack/react-router";
import { OrdersAdmin } from "./admin.orders";

export const Route = createFileRoute("/branch-manager/orders")({
  head: () => ({
    meta: [
      { title: "Live Orders — Branch Manager" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:p-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
        <div className="text-sm font-semibold text-primary">🔒 Branch Manager View</div>
        <div className="text-xs text-muted-foreground">
          Orders are filtered to your assigned branch only.
        </div>
      </div>
      <OrdersAdmin />
    </div>
  ),
});
