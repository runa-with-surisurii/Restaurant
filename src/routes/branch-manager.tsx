import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useStore } from "@/lib/store";
import { BranchShellProvider } from "@/components/branch-admin/BranchShell";
import { getUnauthorizedRedirect } from "@/lib/auth";

export const Route = createFileRoute("/branch-manager")({
  head: () => ({
    meta: [
      { title: "Branch Manager — Ember & Oak" },
      { name: "description", content: "Branch operations console for Ember & Oak restaurant managers." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BranchManagerLayout,
});

function BranchManagerLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { adminUser, currentRole } = useStore();
  const navigate = useNavigate();

  const isLogin = pathname === "/branch-manager/login";

  useEffect(() => {
    if (isLogin) return;
    const redirect = getUnauthorizedRedirect(currentRole, pathname);
    if (redirect === "/login") {
      navigate({ to: redirect, replace: true });
    }
  }, [isLogin, adminUser, currentRole, navigate, pathname]);

  if (isLogin) {
    return <Outlet />;
  }

  if (!adminUser) {
    return (
      <div className="grid min-h-screen place-items-center bg-muted/30 text-sm text-muted-foreground">
        Redirecting to portal…
      </div>
    );
  }

  return (
    <BranchShellProvider>
      <Outlet />
    </BranchShellProvider>
  );
}
