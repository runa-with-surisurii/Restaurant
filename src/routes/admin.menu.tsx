import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { categories, type Dish } from "@/lib/data";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/menu")({
  head: () => ({ meta: [{ title: "Menu Editor — Admin" }, { name: "robots", content: "noindex" }] }),
  component: MenuAdmin,
});

const empty = (): Dish => ({
  id: "",
  name: "",
  description: "",
  price: 0,
  image: "",
  categoryId: categories[0]?.id ?? "",
  rating: 4.5,
  reviewCount: 0,
  tags: [],
  prepTime: 15,
  calories: 500,
});

function MenuAdmin() {
  const { adminUser, dishesState, addDish, updateDish, deleteDish } = useStore();
  const navigate = useNavigate();
  useEffect(() => {
    if (adminUser && adminUser.role !== "main_admin") navigate({ to: "/admin" });
  }, [adminUser, navigate]);

  const [editing, setEditing] = useState<Dish | null>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-wide md:text-4xl">Menu Editor</h1>
          <p className="text-sm text-muted-foreground">Chain-wide dish catalog.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="size-4" />Add dish</Button>
          </DialogTrigger>
          <DishDialog
            editing={editing}
            onSubmit={(d) => {
              if (editing) {
                updateDish(editing.id, d);
                toast.success("Dish updated");
              } else {
                const id = d.id || d.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
                addDish({ ...d, id });
                toast.success("Dish added");
              }
              setOpen(false);
              setEditing(null);
            }}
          />
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All dishes</CardTitle>
          <CardDescription>{dishesState.length} items</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {dishesState.map((d) => (
            <div key={d.id} className="flex gap-3 rounded-lg border p-3">
              <img
                src={d.image}
                alt={d.name}
                className="size-20 shrink-0 rounded-md object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div className="font-medium leading-tight">{d.name}</div>
                  <div className="text-sm font-medium">${d.price.toFixed(2)}</div>
                </div>
                <div className="text-xs text-muted-foreground">
                  {categories.find((c) => c.id === d.categoryId)?.name}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{d.description}</p>
                <div className="mt-2 flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(d); setOpen(true); }}>
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      if (confirm(`Delete ${d.name}?`)) {
                        deleteDish(d.id);
                        toast("Dish deleted");
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function DishDialog({
  editing,
  onSubmit,
}: {
  editing: Dish | null;
  onSubmit: (d: Dish) => void;
}) {
  const [form, setForm] = useState<Dish>(editing ?? empty());
  useEffect(() => { setForm(editing ?? empty()); }, [editing]);
  const set = <K extends keyof Dish>(k: K, v: Dish[K]) => setForm({ ...form, [k]: v });

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit dish" : "New dish"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1">
          <Label>Name</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set("description", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Price ($)</Label>
            <Input
              type="number" step="0.5" value={form.price}
              onChange={(e) => set("price", Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label>Category</Label>
            <Select value={form.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-1">
          <Label>Image URL</Label>
          <Input value={form.image} onChange={(e) => set("image", e.target.value)} placeholder="https://..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>Prep time (min)</Label>
            <Input type="number" value={form.prepTime} onChange={(e) => set("prepTime", Number(e.target.value))} />
          </div>
          <div className="space-y-1">
            <Label>Calories</Label>
            <Input type="number" value={form.calories} onChange={(e) => set("calories", Number(e.target.value))} />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Tags (comma-separated)</Label>
          <Input
            value={form.tags.join(", ")}
            onChange={(e) => set("tags", e.target.value.split(",").map((t) => t.trim()).filter(Boolean))}
          />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => { if (form.name) onSubmit(form); }}>
          {editing ? "Save" : "Add dish"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
