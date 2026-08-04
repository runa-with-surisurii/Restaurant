import type { AuthRole } from "@/lib/store";

export const AUTH_ENTRY_ROUTES = ["/login", "/register", "/portal", "/admin/login"] as const;

export function isAuthEntryRoute(pathname: string) {
  return AUTH_ENTRY_ROUTES.includes(pathname as (typeof AUTH_ENTRY_ROUTES)[number]);
}

export function defaultRouteForRole(role: AuthRole | null) {
  if (role === "main_admin") return "/admin" as const;
  if (role === "branch_manager") return "/branch-dashboard" as const;
  return "/" as const;
}

export function getUnauthorizedRedirect(role: AuthRole | null, pathname: string) {
  if (!role) return "/login" as const;

  const isAdminRoute = pathname.startsWith("/admin");
  const isBranchRoute =
    pathname.startsWith("/branch-manager") || pathname.startsWith("/branch-dashboard");

  if (role === "customer" && (isAdminRoute || isBranchRoute)) {
    return "/login" as const;
  }

  if (role === "branch_manager" && isAdminRoute) {
    return "/branch-dashboard" as const;
  }

  return null;
}
