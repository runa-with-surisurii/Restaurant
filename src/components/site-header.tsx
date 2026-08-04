import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { Flame, ShoppingBag, Heart, User, Menu as MenuIcon, X, Building2, LogOut, Shield } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const customerNav = [
  { to: "/", label: "Home" },
  { to: "/menu", label: "Menu" },
  { to: "/cart", label: "Cart" },
  { to: "/orders", label: "Orders" },
  { to: "/profile", label: "Profile" },
] as const;

const staffNav = [
  { to: "/admin", label: "Admin Console", roles: ["main_admin"] as const },
  { to: "/branch-manager", label: "Branch Manager", roles: ["main_admin", "branch_manager"] as const },
] as const;

export function SiteHeader() {
  const { cartCount, user, adminUser, logoutAll } = useStore();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const isStaffSession = Boolean(adminUser && !user);
  const nav = isStaffSession ? [] : customerNav;
  const hasAnyStaffAccess = adminUser !== null;
  const showCustomerActions = !isStaffSession;
  const staffHome = adminUser?.role === "main_admin" ? "/admin" : "/branch-dashboard";

  const visibleStaffNav = staffNav.filter((s) =>
    adminUser ? s.roles.includes(adminUser.role as any) : false,
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-gradient-ember shadow-ember">
            <Flame className="size-5 text-primary-foreground" />
          </span>
          <span className="font-display text-2xl tracking-wide">Ember &amp; Oak</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors hover:text-primary",
                  active ? "text-primary" : "text-foreground/70",
                )}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-1">
          {showCustomerActions ? (
            <>
              <Button asChild variant="ghost" size="icon" aria-label="Favorites">
                <Link to="/favorites"><Heart className="size-5" /></Link>
              </Button>
              <Button asChild variant="ghost" size="icon" className="relative" aria-label="Cart">
                <Link to="/cart">
                  <ShoppingBag className="size-5" />
                  {cartCount > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {cartCount}
                    </span>
                  )}
                </Link>
              </Button>
            </>
          ) : null}

          {isStaffSession ? (
            <Button asChild size="sm" variant="outline" className="hidden rounded-full md:inline-flex">
              <Link to={staffHome}>Back to Portal</Link>
            </Button>
          ) : null}

          {hasAnyStaffAccess && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative" aria-label="Staff menu">
                  <Shield className="size-5 text-primary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{adminUser?.name ?? "Staff"}</div>
                  <div className="text-xs text-muted-foreground">
                    {adminUser?.role === "main_admin" ? "Main Admin" : "Branch Manager"}
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {visibleStaffNav.map((s) => (
                  <DropdownMenuItem
                    key={s.to}
                    onSelect={() => navigate({ to: s.to as any })}
                  >
                    {s.to === "/admin" ? <Building2 className="mr-2 size-4" /> : <Shield className="mr-2 size-4" />}
                    <span>{s.label}</span>
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => {
                    logoutAll();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Staff sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Profile">
                  <User className="size-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => navigate({ to: "/profile" })}>
                  <User className="mr-2 size-4" />
                  My profile
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: "/orders" })}>
                  <ShoppingBag className="mr-2 size-4" />
                  My orders
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => navigate({ to: "/favorites" })}>
                  <Heart className="mr-2 size-4" />
                  Favorites
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                  onSelect={() => {
                    logoutAll();
                    navigate({ to: "/login" });
                  }}
                >
                  <LogOut className="mr-2 size-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild size="sm" className="hidden bg-gradient-ember text-primary-foreground hover:opacity-90 md:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
          >
            {open ? <X className="size-5" /> : <MenuIcon className="size-5" />}
          </Button>
        </div>
      </div>

      {open && (
        <div className="border-t border-border/60 bg-background md:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
            {nav.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {n.label}
              </Link>
            ))}
            {isStaffSession ? (
              <Link
                to={staffHome}
                onClick={() => setOpen(false)}
                className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
              >
                Back to Portal
              </Link>
            ) : null}
            {hasAnyStaffAccess && (
              <>
                <div className="mt-2 border-t border-border pt-2">
                  <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                    Staff
                  </div>
                  {visibleStaffNav.map((s) => (
                    <Link
                      key={s.to}
                      to={s.to}
                      onClick={() => setOpen(false)}
                      className="rounded-md px-3 py-2 text-sm font-medium text-primary hover:bg-muted"
                    >
                      {s.label}
                    </Link>
                  ))}
                  <button
                    onClick={() => {
                      logoutAll();
                      setOpen(false);
                      navigate({ to: "/login" });
                    }}
                    className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-muted"
                  >
                    Staff sign out
                  </button>
                </div>
              </>
            )}
            {!user && !hasAnyStaffAccess && (
              <Link to="/login" onClick={() => setOpen(false)} className="rounded-md px-3 py-2 text-sm font-medium text-primary">
                Sign in
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
