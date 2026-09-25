import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AdminPage, DataTable, Loading, Panel, StatusPill, shortDate } from "@/components/admin-ui";
import { useAllInstances, useRunLifecycle } from "@/hooks/use-admin";
import { daysRemaining } from "@/lib/portal";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/admin/lifecycle")({ component: LifecyclePage });

type Instance = {
  id: string;
  user_id: string;
  status: string;
  billing_plan: string;
  expires_at: string | null;
  grace_days: number;
  warning_sent: boolean;
};

function ExtendControl({ instance }: { instance: Instance }) {
  const queryClient = useQueryClient();
  const [grace, setGrace] = useState(instance.grace_days);

  const incrementGrace = async () => {
    const next = grace + 1;
    const { error } = await supabase.from("automation_instances").update({ grace_days: next }).eq("id", instance.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setGrace(next);
    toast.success("Grace period extended by 1 day");
    void queryClient.invalidateQueries({ queryKey: ["admin", "instances"] });
  };

  const pushExpiry = async () => {
    const base = instance.expires_at ? new Date(instance.expires_at) : new Date();
    base.setDate(base.getDate() + 7);
    const { error } = await supabase
      .from("automation_instances")
      .update({ expires_at: base.toISOString() })
      .eq("id", instance.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Expiry pushed out by 7 days");
    void queryClient.invalidateQueries({ queryKey: ["admin", "instances"] });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="tabular-nums text-xs text-muted-foreground">Grace: {grace}d</span>
      <Button size="sm" variant="outline" onClick={() => void incrementGrace()}>
        +1 grace
      </Button>
      <Button size="sm" onClick={() => void pushExpiry()}>
        +7 days
      </Button>
    </div>
  );
}

function LifecyclePage() {
  const { data: instances, isLoading } = useAllInstances();
  const runLifecycle = useRunLifecycle();

  if (isLoading) return <Loading />;
  const rows = (instances ?? []) as Instance[];

  return (
    <AdminPage
      title="Subscription Lifecycle Controller"
      subtitle="How a subscription ages from healthy to stopped, and the manual controls admins keep over it."
      actions={
        <Button onClick={() => runLifecycle.mutate({})} disabled={runLifecycle.isPending}>
          {runLifecycle.isPending ? "Running…" : "Run lifecycle check now"}
        </Button>
      }
    >
      <Panel title="Lifecycle rules">
        <ol className="grid gap-3 sm:grid-cols-3">
          <li className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Step 1 · Day 25</p>
            <p className="mt-1 text-sm">A renewal warning is sent to the client.</p>
          </li>
          <li className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Step 2 · Day 30</p>
            <p className="mt-1 text-sm">Status becomes Pending Payment.</p>
          </li>
          <li className="rounded-xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Step 3 · Day 31 + grace</p>
            <p className="mt-1 text-sm">After the grace period, status becomes Stopped.</p>
          </li>
        </ol>
        <p className="mt-3 text-xs text-muted-foreground">
          Admins can extend the grace period per instance below, buying a client extra days before automatic stop.
        </p>
      </Panel>

      <Panel title={`Instances (${rows.length})`}>
        <DataTable
          head={["Client", "Status", "Plan", "Expires", "Days left", "Grace days", "Warning sent", "Extend"]}
          empty="No automation instances yet."
          rows={rows.map((i) => {
            const left = daysRemaining(i.expires_at);
            const tone = left < 5 ? "text-destructive" : left < 10 ? "text-foreground" : "text-foreground";
            return [
              i.user_id.slice(0, 8),
              <StatusPill status={i.status} key="status" />,
              i.billing_plan,
              shortDate(i.expires_at),
              <span className={cn("tabular-nums font-bold", tone)} key="days">{left}</span>,
              <span className="tabular-nums" key="grace">{i.grace_days}</span>,
              i.warning_sent ? "Sent" : "Not yet",
              <ExtendControl instance={i} key="extend" />,
            ];
          })}
        />
      </Panel>
    </AdminPage>
  );
}
