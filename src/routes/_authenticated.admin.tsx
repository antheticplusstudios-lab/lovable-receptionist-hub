import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { AdminShell } from "@/components/admin-shell";
import { Loading } from "@/components/admin-ui";
import { useCurrentUser, useRole } from "@/hooks/use-portal";

/**
 * Access matrix:
 *  - owner / partner  → every control-center page
 *  - verifier         → the verification queue only (no keys, scripts, pricing or team data)
 *  - client           → never; bounced to the client dashboard
 * The database enforces the same matrix through row-level security, so this gate is
 * a convenience layer rather than the security boundary.
 */
function AdminGate() {
  const { data: user } = useCurrentUser();
  const { data: role, isLoading } = useRole();
  const path = useRouterState({ select: (state) => state.location.pathname });
  const navigate = useNavigate();

  // During SSR there is no session yet, so hold on "checking access" until the
  // browser has the user and the role query has settled. Navigating earlier
  // bounces every signed-in owner straight back to the dashboard.
  const ready = !!user && !isLoading;
  const isStaff = role === "owner" || role === "partner" || role === "verifier";
  const isVerifier = role === "verifier";
  const onQueue = path.startsWith("/admin/verification");
  const offLimits = isVerifier && !onQueue;

  useEffect(() => {
    if (!ready) return;
    if (!isStaff) void navigate({ to: "/dashboard", replace: true });
    else if (offLimits) void navigate({ to: "/admin/verification", replace: true });
  }, [ready, isStaff, offLimits, navigate]);

  if (!ready || offLimits) return <Loading label="Checking your access" />;

  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  );
}

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminGate,
});
