import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dishes as seedDishes, branches as seedBranches, type Dish, type Branch } from "@/lib/data";

export type CartItem = { dishId: string; qty: number; notes?: string };
export type OrderStatus = "placed" | "preparing" | "ready" | "completed" | "cancelled";
export type OrderMode = "dine_in" | "booking";
export type Order = {
  id: string; items: CartItem[]; total: number; branchId: string; status: OrderStatus; createdAt: string; mode: OrderMode;
  bookingId?: string; guestName?: string; phone?: string;
};
export type User = { id: string; name: string; email: string; phone?: string; branchId?: string };
export type CustomerAccount = { id: string; name: string; email: string; phone: string; password: string; role: "customer" };
export type AdminRole = "main_admin" | "branch_manager";
export type AuthRole = "customer" | AdminRole;
export type AdminUser = { name: string; role: AdminRole; branchId?: string; branchName?: string; username?: string };
export type BookingStatus = "confirmed" | "seated" | "completed" | "cancelled";
export type Booking = { id: string; branchId: string; tableId: string; date: string; time: string; durationMin: number; partySize: number; guestName: string; phone: string; occasion?: string; notes?: string; preOrderItems: CartItem[]; depositHeld: number; status: BookingStatus; createdAt: string; linkedOrderIds: string[] };

type Store = {
  selectedBranchId: string | null; selectBranch: (branchId: string) => void; clearSelectedBranch: () => void;
  cart: CartItem[]; addToCart: (dishId: string, qty?: number) => void; removeFromCart: (dishId: string) => void; setQty: (dishId: string, qty: number) => void; clearCart: () => void; cartCount: number; cartSubtotal: number;
  favorites: string[]; toggleFavorite: (dishId: string) => void; isFavorite: (dishId: string) => boolean;
  orders: Order[]; placeOrder: (o: Omit<Order, "id" | "createdAt" | "status">) => Order; cancelOrder: (id: string) => void; updateOrderStatus: (id: string, status: OrderStatus) => void;
  bookings: Booking[]; createBooking: (b: Omit<Booking, "id" | "createdAt" | "status" | "linkedOrderIds">) => Booking; cancelBooking: (id: string) => void; updateBookingStatus: (id: string, status: BookingStatus) => void;
  user: User | null; currentRole: AuthRole | null; isAuthenticated: boolean;
  authenticate: (identifier: string, password: string) => Promise<AuthRole>; signUpCustomer: (payload: { name: string; email: string; phone: string; password: string }) => User; login: (email: string, name?: string) => void; logout: () => void; logoutAll: () => void; updateProfile: (u: Partial<User>) => void;
  adminUser: AdminUser | null; loginAdmin: (u: AdminUser) => void; logoutAdmin: () => void;
  branchesState: Branch[]; addBranch: (b: Omit<Branch, "id"> & { id?: string }) => void; updateBranch: (id: string, patch: Partial<Branch>) => void; deleteBranch: (id: string) => void;
  dishesState: Dish[]; addDish: (d: Dish) => void; updateDish: (id: string, patch: Partial<Dish>) => void; deleteDish: (id: string) => void;
  availability: Record<string, Record<string, boolean>>; isAvailable: (branchId: string, dishId: string) => boolean; toggleAvailability: (branchId: string, dishId: string) => void;
  reviews: Review[]; submitReview: (r: Omit<Review, "id" | "createdAt" | "approved" | "sentiment">) => Review; moderateReview: (id: string, patch: Partial<Review>) => void; replyToReview: (id: string, reply: string) => void;
  branchMenu: Record<string, BranchMenu>; addBranchSpecial: (branchId: string, d: Omit<Dish, "id"> & { id?: string }) => void; updateBranchSpecial: (branchId: string, id: string, patch: Partial<Dish>) => void; deleteBranchSpecial: (branchId: string, id: string) => void; hideChainDish: (branchId: string, dishId: string) => void; unhideChainDish: (branchId: string, dishId: string) => void; overridePrice: (branchId: string, dishId: string, price: number) => void;
};
export type ReviewSentiment = "positive" | "neutral" | "negative";
export type Review = { id: string; branchId: string; dishId?: string; rating: 1 | 2 | 3 | 4 | 5; author: string; title: string; body: string; sentiment: ReviewSentiment; approved: boolean; createdAt: string; reply?: string; repliedAt?: string };
export type BranchMenu = { specials: Dish[]; hiddenChain: string[]; priceOverrides: Record<string, number> };
const StoreContext = createContext<Store | null>(null);
const KEY = "ember-oak-store-v3";
const STAFF_CREDENTIALS = [{ username: "admin", password: "mainadmin", role: "main_admin" as const, name: "Main Admin" }, { username: "branch1", password: "b1", role: "branch_manager" as const, branchId: "BR001", name: "Hlaing Taste Manager" }, { username: "branch2", password: "b2", role: "branch_manager" as const, branchId: "BR002", name: "Downtown Taste Manager" }, { username: "branch3", password: "b3", role: "branch_manager" as const, branchId: "BR003", name: "Sanchaung Kitchen Manager" }, { username: "branch4", password: "b4", role: "branch_manager" as const, branchId: "BR004", name: "Bahan Kitchen Manager" }];
const CUSTOMER_CREDENTIALS = [{ username: "customer1", password: "c1", branchId: "BR001" }, { username: "customer2", password: "c2", branchId: "BR002" }, { username: "customer3", password: "c3", branchId: "BR003" }, { username: "customer4", password: "c4", branchId: "BR004" }];
const seededReviews: Review[] = [];
const initial = (): Persisted => ({ selectedBranchId: null, cart: [], favorites: [], orders: [], bookings: [], user: null, adminUser: null, customerAccounts: [], branchesState: seedBranches, dishesState: seedDishes, availability: {}, reviews: seededReviews, branchMenu: seedBranches.reduce<Record<string, BranchMenu>>((acc, b) => { acc[b.id] = { specials: [], hiddenChain: [], priceOverrides: {} }; return acc; }, {}) });
type Persisted = { selectedBranchId: string | null; cart: CartItem[]; favorites: string[]; orders: Order[]; bookings: Booking[]; user: User | null; adminUser: AdminUser | null; customerAccounts: CustomerAccount[]; branchesState: Branch[]; dishesState: Dish[]; availability: Record<string, Record<string, boolean>>; reviews: Review[]; branchMenu: Record<string, BranchMenu> };
const load = (): Persisted => { const base = initial(); if (typeof window === "undefined") return base; try { const raw = window.localStorage.getItem(KEY); if (!raw) return base; const parsed = JSON.parse(raw) as Partial<Persisted>; return { selectedBranchId: parsed.selectedBranchId ?? base.selectedBranchId, cart: parsed.cart ?? base.cart, favorites: parsed.favorites ?? base.favorites, orders: parsed.orders ?? base.orders, bookings: parsed.bookings ?? base.bookings, user: parsed.user ?? base.user, adminUser: parsed.adminUser ?? base.adminUser, customerAccounts: parsed.customerAccounts ?? base.customerAccounts, branchesState: parsed.branchesState?.length ? parsed.branchesState : base.branchesState, dishesState: parsed.dishesState?.length ? parsed.dishesState : base.dishesState, availability: parsed.availability ?? base.availability, reviews: parsed.reviews ?? base.reviews, branchMenu: parsed.branchMenu ?? base.branchMenu }; } catch { return base; } };

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Persisted>(() => initial());
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { setState(load()); setHydrated(true); }, []);
  useEffect(() => { if (hydrated) window.localStorage.setItem(KEY, JSON.stringify(state)); }, [state, hydrated]);
  const dishMap = useMemo(() => new Map<string, Dish>(state.dishesState.map((d) => [d.id, d])), [state.dishesState]);

  const value: Store = useMemo(() => {
    const patch = (p: Partial<Persisted>) => setState((prev) => ({ ...prev, ...p }));
    const cartSubtotal = state.cart.reduce((sum, it) => sum + (dishMap.get(it.dishId)?.price ?? 0) * it.qty, 0);
    const currentRole: AuthRole | null = state.adminUser?.role ?? (state.user ? "customer" : null);
    return {
      selectedBranchId: state.selectedBranchId, selectBranch: (branchId) => setState((p) => ({ ...p, selectedBranchId: branchId })), clearSelectedBranch: () => patch({ selectedBranchId: null }),
      cart: state.cart, addToCart: (dishId, qty = 1) => setState((p) => { const existing = p.cart.find((i) => i.dishId === dishId); return { ...p, cart: existing ? p.cart.map((i) => i.dishId === dishId ? { ...i, qty: i.qty + qty } : i) : [...p.cart, { dishId, qty }] }; }),
      removeFromCart: (dishId) => setState((p) => ({ ...p, cart: p.cart.filter((i) => i.dishId !== dishId) })), setQty: (dishId, qty) => setState((p) => ({ ...p, cart: qty <= 0 ? p.cart.filter((i) => i.dishId !== dishId) : p.cart.map((i) => i.dishId === dishId ? { ...i, qty } : i) })), clearCart: () => patch({ cart: [] }),
      cartCount: state.cart.reduce((s, i) => s + i.qty, 0), cartSubtotal,
      favorites: state.favorites, toggleFavorite: (dishId) => setState((p) => ({ ...p, favorites: p.favorites.includes(dishId) ? p.favorites.filter((x) => x !== dishId) : [...p.favorites, dishId] })), isFavorite: (dishId) => state.favorites.includes(dishId),
      orders: state.orders,
      placeOrder: (o) => {
        const order: Order = { ...o, id: `EO-${Date.now().toString(36).toUpperCase()}`, createdAt: new Date().toISOString(), status: "placed" };
        setState((prev) => ({ ...prev, orders: [order, ...prev.orders], bookings: order.bookingId ? prev.bookings.map((b) => b.id === order.bookingId ? { ...b, linkedOrderIds: [...b.linkedOrderIds, order.id] } : b) : prev.bookings }));
        return order;
      },
      cancelOrder: (id) => setState((p) => ({ ...p, orders: p.orders.map((o) => o.id === id && (o.status === "placed" || o.status === "preparing") ? { ...o, status: "cancelled" } : o) })),
      updateOrderStatus: (id, status) => setState((p) => ({ ...p, orders: p.orders.map((o) => o.id === id ? { ...o, status } : o) })),
      bookings: state.bookings, createBooking: (b) => { const booking: Booking = { ...b, id: `BK-${Date.now().toString(36).toUpperCase()}`, createdAt: new Date().toISOString(), status: "confirmed", linkedOrderIds: [] }; setState((p) => ({ ...p, bookings: [booking, ...p.bookings] })); return booking; },
      cancelBooking: (id) => setState((p) => ({ ...p, bookings: p.bookings.map((b) => b.id === id && b.status === "confirmed" ? { ...b, status: "cancelled", depositHeld: 0 } : b) })), updateBookingStatus: (id, status) => setState((p) => ({ ...p, bookings: p.bookings.map((b) => b.id === id ? { ...b, status } : b) })),
      user: state.user, currentRole, isAuthenticated: Boolean(state.user || state.adminUser),
      authenticate: async (identifier, password) => { const customer = CUSTOMER_CREDENTIALS.find((a) => a.username === identifier.trim().toLowerCase() && a.password === password); if (customer) { const user = { id: customer.username, name: `Customer ${customer.branchId.slice(-1)}`, email: customer.username, phone: "", branchId: customer.branchId }; patch({ adminUser: null, user, selectedBranchId: customer.branchId }); return "customer"; } const staff = STAFF_CREDENTIALS.find((a) => a.username === identifier.trim() && a.password === password); if (staff) { patch({ user: null, adminUser: { name: staff.name, role: staff.role, branchId: staff.branchId } }); return staff.role; } const response = await fetch("http://127.0.0.1:8000/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: identifier, password }) }); const data = await response.json(); if (!data.success) throw new Error(data.message || "Login failed"); const u = data.user; if (u.role === "main_admin" || u.role === "branch_manager") { patch({ user: null, adminUser: { name: u.name, role: u.role, branchId: u.branchId } }); return u.role; } patch({ adminUser: null, user: { id: u._id, name: u.name, email: u.username, phone: u.phone } }); return "customer"; },
      signUpCustomer: ({ name, email, phone, password }) => { const normalizedEmail = email.trim().toLowerCase(); if (state.customerAccounts.some((e) => e.email.toLowerCase() === normalizedEmail)) throw new Error("An account with this email already exists."); const account: CustomerAccount = { id: `cust-${Date.now().toString(36)}`, name: name.trim(), email: normalizedEmail, phone: phone.trim(), password, role: "customer" }; const nextUser: User = { id: account.id, name: account.name, email: account.email, phone: account.phone }; setState((p) => ({ ...p, adminUser: null, user: nextUser, customerAccounts: [...p.customerAccounts, account] })); return nextUser; },
      login: (email, name) => patch({ adminUser: null, user: { id: `u-${email}`, email, name: name ?? email.split("@")[0] } }), logout: () => patch({ user: null, adminUser: null }), logoutAll: () => patch({ user: null, adminUser: null }), updateProfile: (u) => setState((p) => ({ ...p, user: p.user ? { ...p.user, ...u } : p.user })),
      adminUser: state.adminUser, loginAdmin: (u) => patch({ user: null, adminUser: u }), logoutAdmin: () => patch({ user: null, adminUser: null }),
      branchesState: state.branchesState, addBranch: (b) => setState((p) => ({ ...p, branchesState: [...p.branchesState, { ...b, id: b.id ?? `br-${Date.now().toString(36)}` }] })), updateBranch: (id, p) => setState((s) => ({ ...s, branchesState: s.branchesState.map((b) => b.id === id ? { ...b, ...p } : b) })), deleteBranch: (id) => setState((p) => ({ ...p, branchesState: p.branchesState.filter((b) => b.id !== id) })),
      dishesState: state.dishesState, addDish: (d) => setState((p) => ({ ...p, dishesState: [...p.dishesState, d] })), updateDish: (id, p) => setState((s) => ({ ...s, dishesState: s.dishesState.map((d) => d.id === id ? { ...d, ...p } : d) })), deleteDish: (id) => setState((p) => ({ ...p, dishesState: p.dishesState.filter((d) => d.id !== id) })),
      availability: state.availability, isAvailable: (branchId, dishId) => state.availability[branchId]?.[dishId] !== false, toggleAvailability: (branchId, dishId) => setState((p) => { const b = p.availability[branchId] ?? {}; return { ...p, availability: { ...p.availability, [branchId]: { ...b, [dishId]: b[dishId] === false } } }; }),
      reviews: state.reviews, submitReview: (r) => { const review: Review = { ...r, id: `RV-${Date.now().toString(36).toUpperCase()}`, createdAt: new Date().toISOString(), approved: false, sentiment: r.rating >= 4 ? "positive" : r.rating <= 2 ? "negative" : "neutral" }; setState((p) => ({ ...p, reviews: [review, ...p.reviews] })); return review; }, moderateReview: (id, p) => setState((s) => ({ ...s, reviews: s.reviews.map((r) => r.id === id ? { ...r, ...p } : r) })), replyToReview: (id, reply) => setState((s) => ({ ...s, reviews: s.reviews.map((r) => r.id === id ? { ...r, reply, repliedAt: new Date().toISOString(), approved: true } : r) })),
      branchMenu: state.branchMenu,
      addBranchSpecial: (branchId, d) => setState((p) => { const bm = p.branchMenu[branchId] ?? { specials: [], hiddenChain: [], priceOverrides: {} }; return { ...p, branchMenu: { ...p.branchMenu, [branchId]: { ...bm, specials: [...bm.specials, { ...d, id: d.id ?? `sp-${Date.now().toString(36)}` } as Dish] } } }; }),
      updateBranchSpecial: (branchId, id, p) => setState((s) => { const bm = s.branchMenu[branchId]; return bm ? { ...s, branchMenu: { ...s.branchMenu, [branchId]: { ...bm, specials: bm.specials.map((x) => x.id === id ? { ...x, ...p } : x) } } } : s; }),
      deleteBranchSpecial: (branchId, id) => setState((s) => { const bm = s.branchMenu[branchId]; return bm ? { ...s, branchMenu: { ...s.branchMenu, [branchId]: { ...bm, specials: bm.specials.filter((x) => x.id !== id) } } } : s; }),
      hideChainDish: (branchId, dishId) => setState((p) => { const bm = p.branchMenu[branchId] ?? { specials: [], hiddenChain: [], priceOverrides: {} }; return bm.hiddenChain.includes(dishId) ? p : { ...p, branchMenu: { ...p.branchMenu, [branchId]: { ...bm, hiddenChain: [...bm.hiddenChain, dishId] } } }; }),
      unhideChainDish: (branchId, dishId) => setState((p) => { const bm = p.branchMenu[branchId]; return bm ? { ...p, branchMenu: { ...p.branchMenu, [branchId]: { ...bm, hiddenChain: bm.hiddenChain.filter((x) => x !== dishId) } } } : p; }),
      overridePrice: (branchId, dishId, price) => setState((p) => { const bm = p.branchMenu[branchId] ?? { specials: [], hiddenChain: [], priceOverrides: {} }; return { ...p, branchMenu: { ...p.branchMenu, [branchId]: { ...bm, priceOverrides: { ...bm.priceOverrides, [dishId]: price } } } }; }),
    };
  }, [state, dishMap]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() { const context = useContext(StoreContext); if (!context) throw new Error("useStore must be used within StoreProvider"); return context; }
