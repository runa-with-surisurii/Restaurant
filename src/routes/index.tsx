import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Flame, MapPin, Clock, Sparkles } from "lucide-react";
import { SiteLayout } from "@/components/site-layout";
import { DishCard } from "@/components/dish-card";
import { categories, dishes, promotions } from "@/lib/data";
import heroImg from "@/assets/hero-food.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const featured = dishes.filter((d) => d.featured);
  const popular = dishes.filter((d) => d.popular);

  return (
    <SiteLayout>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <img src={heroImg} alt="" className="h-full w-full object-cover" width={1600} height={1000} />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal/95 via-charcoal/70 to-charcoal/30" />
        </div>
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-24 text-primary-foreground md:grid-cols-2 md:py-36 md:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
              <Flame className="size-3.5" /> Fire-kitchen chain, est. 2019
            </span>
            <h1 className="mt-4 font-display text-5xl leading-none md:text-7xl lg:text-8xl">
              Cooked over<br /><span className="text-gradient-ember">oak &amp; ember.</span>
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/80">
              Wood-fired classics, chef-driven grill, and a menu that changes with the seasons — served across four kitchens nationwide.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/menu" className="inline-flex items-center gap-2 rounded-full bg-gradient-ember px-6 py-3 font-semibold text-primary-foreground shadow-ember transition-transform hover:scale-105">
                Browse the menu <ArrowRight className="size-4" />
              </Link>
              <Link to="/branches" className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/5 px-6 py-3 font-semibold text-white backdrop-blur hover:bg-white/10">
                <MapPin className="size-4" /> Find a branch
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-6">
        <div className="flex flex-wrap gap-3">
          {categories.map((c) => (
            <Link key={c.id} to="/menu" className="group flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold shadow-sm transition-colors hover:border-primary hover:text-primary">
              <span className="text-lg">{c.emoji}</span> {c.name}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-accent">
              <Sparkles className="size-3.5" /> Chef picks
            </span>
            <h2 className="font-display text-4xl md:text-5xl">Featured this week</h2>
          </div>
          <Link to="/menu" className="hidden text-sm font-semibold text-primary hover:underline md:inline">
            See full menu →
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((d, i) => <DishCard key={d.id} dish={d} index={i} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <h2 className="mb-6 font-display text-4xl md:text-5xl">Running now</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {promotions.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }} className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-elegant">
              <div className="absolute -right-8 -top-8 size-32 rounded-full bg-gradient-ember opacity-10 blur-2xl" />
              <span className="inline-block rounded-full bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-accent">{p.discount}</span>
              <h3 className="mt-3 font-display text-2xl">{p.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{p.description}</p>
              <div className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted px-3 py-2 text-sm">
                Code <span className="font-mono font-bold text-primary">{p.code}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="font-display text-4xl md:text-5xl">Most loved</h2>
          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3.5" /> Ordered {popular.reduce((s, p) => s + p.reviewCount, 0).toLocaleString()}× this month
          </span>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {popular.map((d, i) => <DishCard key={d.id} dish={d} index={i} />)}
        </div>
      </section>
    </SiteLayout>
  );
}
