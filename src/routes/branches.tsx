import { createFileRoute } from "@tanstack/react-router";
import { MapPin, Phone, Clock } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { branches } from "@/lib/data";

export const Route = createFileRoute("/branches")({
  head: () => ({
    meta: [
      { title: "Our branches — Ember & Oak" },
      { name: "description", content: "Find your nearest Ember & Oak fire-kitchen — four locations across the U.S." },
      { property: "og:title", content: "Our branches — Ember & Oak" },
      { property: "og:description", content: "Find your nearest Ember & Oak fire-kitchen — four locations across the U.S." },
    ],
  }),
  component: BranchesPage,
});

function BranchesPage() {
  return (
    <SiteLayout>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <h1 className="font-display text-5xl md:text-6xl">Our branches</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">Four fire-kitchens, one philosophy. Drop by any time — we're open late.</p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          {branches.map((b) => (
            <article key={b.id} className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <h2 className="font-display text-3xl">{b.name}</h2>
              <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><MapPin className="size-4 text-primary" /> {b.address}, {b.city}</li>
                <li className="flex items-center gap-2"><Phone className="size-4 text-primary" /> {b.phone}</li>
                <li className="flex items-center gap-2"><Clock className="size-4 text-primary" /> Open {b.hours}</li>
              </ul>
            </article>
          ))}
        </div>
      </section>
    </SiteLayout>
  );
}