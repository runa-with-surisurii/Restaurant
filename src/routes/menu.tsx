import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { DishCard } from "@/components/dish-card";
import { categories, dishes } from "@/lib/data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu")({
  head: () => ({
    meta: [
      { title: "Menu — Ember & Oak" },
      { name: "description", content: "Explore Ember & Oak's fire-kitchen menu — burgers, wood-fired pizza, grill, pasta, and more." },
      { property: "og:title", content: "Menu — Ember & Oak" },
      { property: "og:description", content: "Explore Ember & Oak's fire-kitchen menu — burgers, wood-fired pizza, grill, pasta, and more." },
    ],
  }),
  component: MenuPage,
});

type SortKey = "popular" | "price-asc" | "price-desc" | "rating";

function MenuPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("popular");

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = dishes.filter((d) => (category === "all" || d.categoryId === category) && (!q || d.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)));
    switch (sort) {
      case "price-asc": out = [...out].sort((a, b) => a.price - b.price); break;
      case "price-desc": out = [...out].sort((a, b) => b.price - a.price); break;
      case "rating": out = [...out].sort((a, b) => b.rating - a.rating); break;
      default: out = [...out].sort((a, b) => b.reviewCount - a.reviewCount);
    }
    return out;
  }, [query, category, sort]);

  return (
    <SiteLayout>
      <section className="border-b border-border bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
          <h1 className="font-display text-5xl md:text-6xl">The full menu</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">Search, filter, and sort — from ember-charred starters to molten desserts.</p>

          <div className="mt-6 flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search dishes…"
                className="w-full rounded-full border border-input bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className="rounded-full border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary">
              <option value="popular">Most popular</option>
              <option value="rating">Highest rated</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>All</FilterChip>
            {categories.map((c) => (
              <FilterChip key={c.id} active={category === c.id} onClick={() => setCategory(c.id)}>
                <span>{c.emoji}</span> {c.name}
              </FilterChip>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-10 md:px-6">
        {list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-muted-foreground">
            No dishes match your filters.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((d, i) => <DishCard key={d.id} dish={d} index={i} />)}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card hover:border-primary/50",
      )}
    >
      {children}
    </button>
  );
}