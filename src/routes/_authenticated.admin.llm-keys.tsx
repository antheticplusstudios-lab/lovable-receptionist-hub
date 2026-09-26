import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { AdminPage, DataTable, Panel, StatusPill, timeAgo } from "@/components/admin-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/llm-keys")({
  head: () => ({ meta: [{ title: "AI Key Pool — AntheticPlus" }] }),
  component: KeysPage,
});

function KeysPage() {
  const qc = useQueryClient();
  const [n, setN] = useState({ provider: "openrouter", label: "", api_key: "" });
  const list = useQuery({
    queryKey: ["llm-keys"],
    queryFn: async () => {
      const { data, error } = await supabase.from("llm_api_keys").select("id, provider, label, api_key, is_active, cooldown_until, error_count, request_count, created_at").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ["llm-keys"] });
  async function add() {
    const { error } = await supabase.from("llm_api_keys").insert(n);
    if (error) { toast.error(error.message); return; }
    setN({ ...n, label: "", api_key: "" });
    refresh();
  }
  async function patch(id: string, p: Record<string, unknown>) {
    const { error } = await supabase.from("llm_api_keys").update(p as never).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  }
  async function del(id: string) {
    const { error } = await supabase.from("llm_api_keys").delete().eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  }
  return (
    <AdminPage title="AI Key Pool" subtitle="Free OpenRouter and Groq keys your server rotates through when one hits a limit. Owner only.">
      <Panel title="Add key" className="mb-6">
        <div className="flex flex-wrap gap-2">
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={n.provider} onChange={(e) => setN({ ...n, provider: e.target.value })}>
            <option value="openrouter">OpenRouter</option>
            <option value="groq">Groq</option>
          </select>
          <Input className="w-40" placeholder="Label" value={n.label} onChange={(e) => setN({ ...n, label: e.target.value })} />
          <Input className="flex-1" type="password" placeholder="API key" value={n.api_key} onChange={(e) => setN({ ...n, api_key: e.target.value })} />
          <Button disabled={n.api_key.length < 10} onClick={() => void add()}>Add</Button>
        </div>
      </Panel>
      <Panel>
        <DataTable
          head={["Provider", "Label", "Key", "Requests", "Errors", "Status", "Added", ""]}
          empty="No keys yet."
          rows={(list.data ?? []).map((k) => [
            k.provider,
            k.label || "—",
            <span className="font-mono text-xs">…{k.api_key.slice(-4)}</span>,
            k.request_count,
            k.error_count,
            k.cooldown_until && new Date(k.cooldown_until) > new Date() ? <StatusPill status="cooling down" /> : <Switch checked={k.is_active} onCheckedChange={(v) => void patch(k.id, { is_active: v })} />,
            timeAgo(k.created_at),
            <Button size="icon" variant="ghost" onClick={() => void del(k.id)}><Trash2 className="h-4 w-4" /></Button>,
          ])}
        />
      </Panel>
    </AdminPage>
  );
}
