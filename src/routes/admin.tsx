import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { BranchShellProvider } from "@/components/branch-admin/BranchShell";
import { getUnauthorizedRedirect } from "@/lib/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Main Admin — Ember & Oak" },
      { name: "description", content: "HQ operations console for Ember & Oak restaurant chain." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminLayout,
});

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { adminUser, currentRole } = useStore();
  const navigate = useNavigate();

  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (isLogin) return;
    const redirect = getUnauthorizedRedirect(currentRole, pathname);
    if (redirect && redirect !== pathname) {
      navigate({ to: redirect, replace: true });
    }
  }, [isLogin, adminUser, currentRole, navigate, pathname]);

  if (isLogin) {
    return <Outlet />;
  }

  if (!adminUser || adminUser.role === "branch_manager") {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 text-sm text-muted-foreground">
        Redirecting…
      </div>
    );
  }

  return (
    <BranchShellProvider>
      <Outlet />
    </BranchShellProvider>
  );
}
