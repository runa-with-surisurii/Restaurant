import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { SiteLayout } from "@/components/site-layout";
import { useStore } from "@/lib/store";
import { branches, getDish } from "@/lib/data";

const checkoutSearchSchema = z.union([
  z.object({ mode: z.literal("dine_in"), branchId: z.string().optional() }),
  z.object({ mode: z.literal("booking"), bookingId: z.string() }),
]);

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — Ember & Oak" }, { name: "robots", content: "noindex" }] }),
  validateSearch: (s) => checkoutSearchSchema.parse({ mode: (s as { mode?: string }).mode ?? "dine_in", ...s }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { cart, cartSubtotal, placeOrder, clearCart, user, bookings } = useStore();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const booking = useMemo(
    () => (search.mode === "booking" ? bookings.find((b) => b.id === search.bookingId) : undefined),
    [search, bookings],
  );
  const [branchId, setBranchId] = useState(
    search.mode === "dine_in" ? search.branchId ?? branches[0].id : booking?.branchId ?? branches[0].id,
  );
  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [paying, setPaying] = useState(false);

  const tax = cartSubtotal * 0.08;
  const total = cartSubtotal + tax;

  if (cart.length === 0) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-md px-4 py-24 text-center">
          <h1 className="font-display text-3xl">Nothing to check out</h1>
          <Link to="/menu" className="mt-4 inline-block text-primary">Browse the menu →</Link>
        </div>
      </SiteLayout>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone) return toast.error("Please fill in your details");
    setPaying(true);
    setTimeout(() => {
      const order = placeOrder({
        items: cart,
        total,
        branchId: booking?.branchId ?? branchId,
        mode: booking ? "booking" : "dine_in",
        bookingId: booking?.id,
        guestName: name,
        phone,
      });
      clearCart();
      toast.success(`Order ${order.id} placed!`);
      navigate({ to: "/orders/$id", params: { id: order.id } });
    }, 800);
  };

  return (
    <SiteLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 md:px-6">
        <h1 className="font-display text-5xl">{booking ? "Add to your booking" : "Pickup / Dine-in"}</h1>
        {booking && (
          <p className="mt-2 text-sm text-muted-foreground">
            Adding to booking <span className="font-mono font-semibold text-foreground">{booking.id}</span> on {booking.date} at {booking.time}
          </p>
        )}
        <form onSubmit={onSubmit} className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <Section title="Contact details">
              <Field label="Full name"><input required value={name} onChange={(e) => setName(e.target.value)} className="input" /></Field>
              <Field label="Phone"><input required value={phone} onChange={(e) => setPhone(e.target.value)} className="input" /></Field>
            </Section>
            {!booking && (
              <Section title="Pickup branch">
                <Field label="Branch">
                  <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className="input">
                    {branches.map((b) => <option key={b.id} value={b.id}>{b.name} — {b.city}</option>)}
                  </select>
                </Field>
                <p className="text-xs text-muted-foreground">We'll ping you when your order is ready to collect at the counter.</p>
              </Section>
            )}
            <Section title="Payment (demo)">
              <Field label="Card number"><input placeholder="4242 4242 4242 4242" className="input" defaultValue="4242 4242 4242 4242" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Expiry"><input placeholder="MM/YY" className="input" defaultValue="12/28" /></Field>
                <Field label="CVC"><input placeholder="123" className="input" defaultValue="123" /></Field>
              </div>
            </Section>
          </div>

          <aside className="h-fit rounded-2xl border border-border bg-card p-6 shadow-elegant">
            <h2 className="font-display text-2xl">Order summary</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {cart.map((i) => {
                const d = getDish(i.dishId);
                if (!d) return null;
                return (
                  <li key={i.dishId} className="flex justify-between">
                    <span>{i.qty}× {d.name}</span>
                    <span>${(d.price * i.qty).toFixed(2)}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 space-y-1 border-t border-border pt-4 text-sm text-muted-foreground">
              <div className="flex justify-between"><span>Subtotal</span><span className="text-foreground">${cartSubtotal.toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span className="text-foreground">${tax.toFixed(2)}</span></div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <span className="font-display text-lg">Total</span>
              <span className="font-display text-2xl text-primary">${total.toFixed(2)}</span>
            </div>
            <button type="submit" disabled={paying} className="mt-6 block w-full rounded-full bg-gradient-ember py-3 text-center font-semibold text-primary-foreground shadow-ember disabled:opacity-60">
              {paying ? "Placing order…" : `Place order · $${total.toFixed(2)}`}
            </button>
          </aside>
        </form>
      </div>
      <style>{`.input{width:100%;border-radius:0.75rem;border:1px solid var(--color-input);background:var(--color-background);padding:0.75rem 1rem;font-size:0.875rem;outline:none}.input:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in oklab,var(--color-primary) 20%,transparent)}`}</style>
    </SiteLayout>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <h2 className="font-display text-2xl">{title}</h2>
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>{children}</label>;
}