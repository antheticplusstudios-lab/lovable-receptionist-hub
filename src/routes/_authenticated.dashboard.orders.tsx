import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { StatusPill, money, shortDate } from "@/components/admin-ui";
import { supabase } from "@/integrations/supabase/client";
import { AUTOMATION_LABEL } from "@/lib/catalog-v2";

export const Route = createFileRoute("/_authenticated/dashboard/orders")({
  head: () => ({ meta: [{ title: "My Orders — AntheticPlus" }] }),
  component: OrdersPage,
});

const STATUS_TEXT: Record<string, string> = {
  pending_verification: "Pending Payment Verification",
  approved: "Approved",
  rejected: "Rejected",
};

function OrdersPage() {
  const orders = useQuery({
    queryKey: ["my-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const autos = useQuery({
    queryKey: ["my-client-automations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_automations").select("id, order_id");
      if (error) throw error;
      return data;
    },
  });
  const autoByOrder = new Map((autos.data ?? []).map((a) => [a.order_id, a.id]));

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">My Orders</h1>
          <p className="text-sm text-muted-foreground">Track payment verification and open your live automations.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link to="/order/$product" params={{ product: "messaging_ai" }}>Order Messaging AI</Link></Button>
          <Button asChild><Link to="/order/$product" params={{ product: "ai_receptionist" }}>Order AI Receptionist</Link></Button>
        </div>
      </div>
      <div className="grid gap-3">
        {(orders.data ?? []).map((o) => {
          const aid = autoByOrder.get(o.order_id);
          return (
            <div key={o.id} className="flex flex-wrap items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <div className="flex-1">
                <div className="font-bold">{AUTOMATION_LABEL[o.automation_type]} <span className="text-xs text-muted-foreground">{o.order_id}</span></div>
                <div className="text-sm text-muted-foreground">{o.target_domain_url} · {money(o.total_amount)}/mo · {shortDate(o.created_at)}</div>
                {o.rejection_reason && <div className="mt-1 text-sm text-destructive">Reason: {o.rejection_reason}</div>}
              </div>
              <StatusPill status={STATUS_TEXT[o.status] ?? o.status} />
              {aid && <Button asChild size="sm"><Link to="/dashboard/portal/$id" params={{ id: aid }}>Open</Link></Button>}
            </div>
          );
        })}
        {orders.data?.length === 0 && <p className="rounded-2xl border border-dashed border-border p-8 text-center text-muted-foreground">No orders yet.</p>}
      </div>
    </div>
  );
}
