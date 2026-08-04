import { createFileRoute } from "@tanstack/react-router";
import { SalesReportPage } from "./admin.sales-reports";

export const Route = createFileRoute("/branch-manager/sales-reports")({
  head: () => ({
    meta: [{ title: "Sales Reports — Branch Manager" }, { name: "robots", content: "noindex" }],
  }),
  component: () => (
    <div className="space-y-4">
      <div className="mx-auto max-w-[1400px] px-4 pt-4 md:px-8 md:pt-8">
        <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
          <div className="text-sm font-semibold text-primary">🔒 Branch Manager View</div>
          <div className="text-xs text-muted-foreground">Analytics limited to your branch.</div>
        </div>
      </div>
      <SalesReportPage />
    </div>
  ),
});
