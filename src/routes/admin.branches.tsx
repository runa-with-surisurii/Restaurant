import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  Clock,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Search as SearchIcon,
  Trash2,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useStore } from "@/lib/store";
import type { Branch } from "@/lib/data";
import { toast } from "sonner";
import { KpiCard } from "@/components/branch-admin/KpiCard";
import { SectionHeader, ToolbarCard } from "@/components/branch-admin/SectionHeader";
import { EmptyState } from "@/components/branch-admin/EmptyState";
import { useBranchShell } from "@/components/branch-admin/BranchShell";

export const Route = createFileRoute("/admin/branches")({
  head: () => ({ meta: [{ title: "Branches — Ember & Oak" }, { name: "robots", content: "noindex" }] }),
  component: BranchesAdmin,
});

function BranchesAdmin() {
  const {
    adminUser,
    branchesState,
    orders,
    bookings,
    addBranch,
    updateBranch,
    deleteBranch,
  } = useStore();
  const { setSection, setActiveBranchId } = useBranchShell();
  const navigate = useNavigate();

  useEffect(() => {
    if (adminUser && adminUser.role !== "main_admin") navigate({ to: "/admin" });
    setSection("chain");
  }, [adminUser, navigate, setSection]);

  const [editing, setEditing] = useState<Branch | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const stats = useMemo(() => {
    const activeBranches = branchesState.length;
    const totalSeats = branchesState.reduce((acc, b) => acc + (b.tables ?? 0) * (b.seatsPerTable ?? 4), 0);
    const todayOrders = orders.filter((o) => isToday(o.placedAt)).length;
    const todayBookings = bookings.filter((b) => isToday(b.dateTime)).length;
    return { activeBranches, totalSeats, todayOrders, todayBookings };
  }, [branchesState, orders, bookings]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return branchesState;
    return branchesState.filter(
      (b) =>
        b.name.toLowerCase().includes(needle) ||
        b.city.toLowerCase().includes(needle) ||
        b.address.toLowerCase().includes(needle),
    );
  }, [branchesState, q]);

  const onSubmit = (b: Omit<Branch, "id">) => {
    if (editing) {
      updateBranch(editing.id, b);
      toast.success("Branch updated");
    } else {
      addBranch(b);
      toast.success("Branch added");
    }
    setOpen(false);
    setEditing(null);
  };

  const goBranch = (id: string) => {
    setActiveBranchId(id);
    setSection("branch");
    navigate({ to: "/admin" });
  };

  return (
    <div className="space-y-8">
      <SectionHeader
        eyebrow="Chain operations"
        title="Branches"
        description="Onboard new locations, keep each restaurant's contact and hours up to date, and jump into a branch's day-to-day workspace."
        actions={
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button className="rounded-full shadow-sm hover:shadow-ember/30">
                <Plus className="size-4" /> Add branch
              </Button>
            </DialogTrigger>
            <BranchDialog editing={editing} onSubmit={onSubmit} />
          </Dialog>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Locations"
          value={stats.activeBranches}
          icon={Building2}
          trend={{ value: 0.8, label: "30 day avg" }}
          accent="from-primary/20 to-transparent"
        />
        <KpiCard
          label="Total Capacity"
          value={`${stats.totalSeats.toLocaleString()} seats`}
          icon={Users}
          trend={{ value: 3.2, label: "seasonal gain" }}
          accent="from-accent/20 to-transparent"
        />
        <KpiCard
          label="Today's Orders"
          value={stats.todayOrders}
          icon={TrendingUp}
          trend={{ value: 11.4, label: "vs yesterday" }}
          accent="from-emerald-500/15 to-transparent"
        />
        <KpiCard
          label="Today's Bookings"
          value={stats.todayBookings}
          icon={Building2}
          trend={{ value: -2.1, label: "vs yesterday" }}
          accent="from-secondary/15 to-transparent"
        />
      </div>

      <ToolbarCard>
        <div className="flex flex-1 items-center gap-2">
          <div className="relative w-full md:max-w-md">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name, city, or address…"
              className="w-full rounded-full border-border/70 bg-background pl-9 shadow-sm"
            />
          </div>
          <Badge variant="outline" className="rounded-full px-3 py-1">
            {filtered.length} {filtered.length === 1 ? "branch" : "branches"}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={() => setQ("")}>Clear filters</Button>
        </div>
      </ToolbarCard>

      {filtered.length === 0 ? (
        <EmptyState
          title="No branches match your search"
          description="Try a different keyword or add a new location to expand operations."
          icon={Building2}
          actionLabel="Add branch"
          onAction={() => { setEditing(null); setOpen(true); }}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((b, idx) => {
            const branchOrders = orders.filter((o) => o.branchId === b.id);
            const todays = branchOrders.filter((o) => isToday(o.placedAt));
            const revenue = todays.reduce((acc, o) => acc + o.total, 0);
            const tables = b.tables ?? 20;
            const seats = tables * (b.seatsPerTable ?? 4);
            const capacity = tables;
            const filled = Math.min(capacity, bookings.filter((bk) => bk.branchId === b.id && isToday(bk.dateTime)).reduce((acc, x) => acc + Math.ceil(x.partySize / (b.seatsPerTable ?? 4)), 0));
            const occupancy = capacity ? Math.round((filled / capacity) * 100) : 0;
            return (
              <motion.article
                key={b.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: idx * 0.04 }}
                className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent" />
                <div className="relative flex items-start gap-4 p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/80 text-primary shadow-sm ring-1 ring-border/70 group-hover:text-accent">
                    <Building2 className="size-6" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-display text-2xl leading-tight tracking-wide text-foreground">
                          {b.name}
                        </h3>
                        <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="size-3" /> {b.city}
                        </p>
                      </div>
                      <Badge variant="outline" className="rounded-full bg-background px-2 py-0.5 text-[11px]">
                        Open
                      </Badge>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Today's revenue
                        </div>
                        <div className="mt-1 font-display text-2xl tracking-wide">
                          ${revenue.toFixed(0)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                          Orders
                        </div>
                        <div className="mt-1 font-display text-2xl tracking-wide">{todays.length}</div>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Phone className="size-3.5 text-primary" /> {b.phone || "—"}
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="size-3.5 text-primary" /> {b.hours || "11:00 – 23:00"}
                      </div>
                      <div className="flex items-start gap-2">
                        <MapPin className="mt-0.5 size-3.5 text-primary" />
                        <span className="line-clamp-2">{b.address}</span>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-3 shadow-sm">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="text-muted-foreground">
                          Occupancy · {filled}/{capacity} tables · {seats} seats
                        </span>
                        <span className="text-foreground">{occupancy}%</span>
                      </div>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-gradient-ember transition-[width] duration-500"
                          style={{ width: `${occupancy}%` }}
                        />
                      </div>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <Button
                        variant="default"
                        className="flex-1 rounded-full shadow-sm hover:shadow-ember/30"
                        onClick={() => goBranch(b.id)}
                      >
                        Open branch
                      </Button>
                      <Button
                        size="icon"
                        variant="outline"
                        className="rounded-full"
                        onClick={() => { setEditing(b); setOpen(true); }}
                        aria-label="Edit branch"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="rounded-full text-muted-foreground hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Delete ${b.name}?`)) {
                            deleteBranch(b.id);
                            toast("Branch deleted");
                          }
                        }}
                        aria-label="Delete branch"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BranchDialog({
  editing,
  onSubmit,
}: {
  editing: Branch | null;
  onSubmit: (b: Omit<Branch, "id">) => void;
}) {
  const [form, setForm] = useState<Omit<Branch, "id">>({
    name: editing?.name ?? "",
    address: editing?.address ?? "",
    city: editing?.city ?? "",
    phone: editing?.phone ?? "",
    hours: editing?.hours ?? "11:00 – 23:00",
    tables: editing?.tables ?? 20,
    seatsPerTable: editing?.seatsPerTable ?? 4,
  });
  useEffect(() => {
    setForm({
      name: editing?.name ?? "",
      address: editing?.address ?? "",
      city: editing?.city ?? "",
      phone: editing?.phone ?? "",
      hours: editing?.hours ?? "11:00 – 23:00",
      tables: editing?.tables ?? 20,
      seatsPerTable: editing?.seatsPerTable ?? 4,
    });
  }, [editing]);

  return (
    <DialogContent className="rounded-2xl border-border/70 shadow-elegant">
      <DialogHeader>
        <DialogTitle className="font-display text-2xl tracking-wide">
          {editing ? "Edit branch" : "New branch"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {(["name", "address", "city", "phone", "hours"] as const).map((f) => (
          <div key={f} className="space-y-1.5">
            <Label htmlFor={f} className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {f}
            </Label>
            <Input
              id={f}
              value={(form as any)[f]}
              onChange={(e) => setForm({ ...form, [f]: e.target.value })}
              className="rounded-xl border-border/70 shadow-sm"
            />
          </div>
        ))}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="tables" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tables
            </Label>
            <Input
              id="tables"
              type="number"
              value={form.tables ?? 0}
              onChange={(e) => setForm({ ...form, tables: Number(e.target.value) || 0 })}
              className="rounded-xl border-border/70 shadow-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seatsPerTable" className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Seats / table
            </Label>
            <Input
              id="seatsPerTable"
              type="number"
              value={form.seatsPerTable ?? 0}
              onChange={(e) => setForm({ ...form, seatsPerTable: Number(e.target.value) || 0 })}
              className="rounded-xl border-border/70 shadow-sm"
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button
          className="rounded-full shadow-sm hover:shadow-ember/30"
          onClick={() => {
            if (!form.name) return;
            onSubmit(form);
          }}
        >
          {editing ? "Save changes" : "Add branch"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function isToday(value: string | Date): boolean {
  const d = value instanceof Date ? value : new Date(value);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
