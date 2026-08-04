import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Minus, Plus, Trash2, ShoppingBag, Package, CalendarCheck, UtensilsCrossed } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { useStore } from "@/lib/store";
import { getDish, branches } from "@/lib/data";

export const Route = createFileRoute("/cart")({
  head: () => ({ meta: [{ title: "Your cart — Ember & Oak" }, { name: "robots", content: "noindex" }] }),
  component: CartPage,
});

function CartPage() {
  const { cart, setQty, removeFromCart, cartSubtotal, clearCart } = useStore();
  const { bookings } = useStore();
  const navigate = useNavigate();
  const upcoming = useMemo(
    () => bookings.filter((b) => b.status === "confirmed" || b.status === "seated"),
    [bookings],
  );
  type Mode = "pickup" | "booking_only" | "booking_preorder";
  const [mode, setMode] = useState<Mode>("pickup");
  const [branchId, setBranchId] = useState(branches[0].id);
  const tax = cartSubtotal * 0.08;
  const total = cartSubtotal + tax;

  const continueFlow = () => {
    if (mode === "pickup") {
      navigate({ to: "/checkout", search: { mode: "dine_in" as const, branchId } });
    } else if (mode === "booking_only") {
      navigate({ to: "/book" });
    } else {
      navigate({ to: "/book", search: { preorder: 1 } });
    }
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h1 className="font-display text-5xl">Your cart</h1>

        {cart.length === 0 ? (
          <div className="mt-10 grid place-items-center rounded-3xl border border-dashed border-border bg-muted/30 py-20 text-center">
            <ShoppingBag className="size-10 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">Your cart is empty.</p>
            <Link to="/menu" className="mt-6 inline-flex rounded-full bg-gradient-ember px-6 py-3 font-semibold text-primary-foreground">
              Browse the menu
            </Link>
          </div>
        ) : (
          <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">How do you want this?</div>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <ModeCard
                    active={mode === "pickup"}
                    onClick={() => setMode("pickup")}
                    icon={<Package className="size-5 text-primary" />}
                    title="Pickup (parcel)"
                    desc="Takeaway — collect at the counter."
                  />
                  <ModeCard
                    active={mode === "booking_only"}
                    onClick={() => setMode("booking_only")}
                    icon={<CalendarCheck className="size-5 text-primary" />}
                    title="Booking only"
                    desc="Reserve a table, order later."
                  />
                  <ModeCard
                    active={mode === "booking_preorder"}
                    onClick={() => setMode("booking_preorder")}
                    icon={<UtensilsCrossed className="size-5 text-primary" />}
                    title="Booking + pre-order"
                    desc="Reserve a table & pre-order this cart."
                  />
                </div>
                {mode === "pickup" && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pickup branch</span>
                    <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="w-full rounded-xl border border-input bg-background px-4 py-2.5 text-sm">
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
                    </select>
                  </label>
                )}
                {mode === "booking_only" && (
                  <p className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                    You'll pick a branch, time and table next. Your cart stays saved for later.
                  </p>
                )}
                {mode === "booking_preorder" && (
                  <p className="mt-3 rounded-xl bg-primary/5 p-3 text-xs text-foreground">
                    We'll attach these {cart.reduce((s, i) => s + i.qty, 0)} item(s) to your booking so the kitchen preps ahead. You'll pay when seated.
                  </p>
                )}
              </div>

              {cart.map((item) => {
                const d = getDish(item.dishId);
                if (!d) return null;
                return (
                  <div key={item.dishId} className="flex gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm">
                    <img src={d.image} alt={d.name} className="size-24 shrink-0 rounded-xl object-cover" />
                    <div className="flex flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-display text-lg">{d.name}</h3>
                          <p className="text-sm text-muted-foreground">${d.price.toFixed(2)} each</p>
                        </div>
                        <button onClick={() => removeFromCart(item.dishId)} aria-label="Remove" className="text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                      <div className="mt-auto flex items-center justify-between">
                        <div className="inline-flex items-center rounded-full border border-border">
                          <button onClick={() => setQty(item.dishId, item.qty - 1)} className="grid size-9 place-items-center hover:text-primary"><Minus className="size-3.5" /></button>
                          <span className="w-8 text-center text-sm font-semibold">{item.qty}</span>
                          <button onClick={() => setQty(item.dishId, item.qty + 1)} className="grid size-9 place-items-center hover:text-primary"><Plus className="size-3.5" /></button>
                        </div>
                        <span className="font-display text-lg text-primary">${(d.price * item.qty).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <button onClick={clearCart} className="text-sm text-muted-foreground hover:text-destructive">Clear cart</button>
            </div>

            <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <h2 className="font-display text-2xl">Summary</h2>
              <dl className="mt-4 space-y-2 text-sm">
                <Row label="Subtotal" value={`$${cartSubtotal.toFixed(2)}`} />
                <Row label="Tax (8%)" value={`$${tax.toFixed(2)}`} />
              </dl>
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <span className="font-display text-lg">Total</span>
                <span className="font-display text-2xl text-primary">${total.toFixed(2)}</span>
              </div>
              <button
                type="button"
                onClick={continueFlow}
                className="mt-6 block w-full rounded-full bg-gradient-ember py-3 text-center font-semibold text-primary-foreground shadow-ember hover:scale-[1.01]"
              >
                {mode === "pickup" ? "Checkout" : mode === "booking_only" ? "Book a table" : "Book & pre-order"}
              </button>
            </aside>
          </div>
        )}
      </div>
    </SiteLayout>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <dt>{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}

function ModeCard({ active, onClick, icon, title, desc }: { active: boolean; onClick: () => void; icon: React.ReactNode; title: string; desc: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${active ? "border-primary bg-primary/5 shadow-ember" : "border-border hover:border-primary/50"}`}
    >
      <span className="mt-0.5">{icon}</span>
      <span>
        <span className="block font-semibold leading-tight">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{desc}</span>
      </span>
    </button>
  );
}