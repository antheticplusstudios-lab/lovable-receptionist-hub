import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AdminPage, Loading, Panel, money } from "@/components/admin-ui";
import { useAllInstances, useAllPayments, useAllProfiles, useTags } from "@/hooks/use-admin";
import { isLive } from "@/lib/portal";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/crm")({ component: CrmPage });

const QUICK_TAGS = ["VIP", "Late-Payer", "Onboarding", "Renewal risk", "Enterprise"];

type Profile = {
  id: string;
  user_id: string;
  company_name: string;
  company_email: string;
  website_url: string;
  category: string;
};

type Instance = { user_id: string; status: string; expires_at: string | null; killed: boolean };
type Payment = { user_id: string; status: string; amount: number };
type Tag = { id: string; user_id: string; tag: string };

function ClientCard({
  profile,
  revenue,
  automationsCount,
  liveCount,
  tags,
}: {
  profile: Profile;
  revenue: number;
  automationsCount: number;
  liveCount: number;
  tags: Tag[];
}) {
  const queryClient = useQueryClient();
  const [tagInput, setTagInput] = useState("");

  const addTag = async (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const exists = tags.some((t) => t.tag.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      toast.error("That tag already exists for this client.");
      return;
    }
    const { error } = await supabase.from("client_tags").insert({ user_id: profile.user_id, tag: trimmed });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tag added");
    setTagInput("");
    void queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
  };

  const removeTag = async (id: string) => {
    const { error } = await supabase.from("client_tags").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Tag removed");
    void queryClient.invalidateQueries({ queryKey: ["admin", "tags"] });
  };

  return (
    <div className="grid gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <p className="text-base font-extrabold">{profile.company_name || profile.company_email}</p>
        {profile.website_url && <p className="text-xs text-muted-foreground">{profile.website_url}</p>}
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{profile.category || "Uncategorized"}</p>
        <p className="text-xs text-muted-foreground">{profile.company_email}</p>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xl font-extrabold tabular-nums">{money(revenue)}</p>
        <p className="text-xs text-muted-foreground">{automationsCount} automations · {liveCount} live</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t.id}
            className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground"
          >
            {t.tag}
            <button onClick={() => void removeTag(t.id)} aria-label={`Remove ${t.tag}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {tags.length === 0 && <span className="text-xs text-muted-foreground">No tags yet.</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_TAGS.map((qt) => (
          <button
            key={qt}
            onClick={() => setTagInput(qt)}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] font-semibold text-muted-foreground hover:bg-accent"
          >
            {qt}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Add tag…"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void addTag(tagInput);
          }}
        />
        <Button onClick={() => void addTag(tagInput)}>Add</Button>
      </div>
    </div>
  );
}

function CrmPage() {
  const { data: profiles, isLoading: loadingProfiles } = useAllProfiles();
  const { data: instances, isLoading: loadingInstances } = useAllInstances();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: tags, isLoading: loadingTags } = useTags();
  const [search, setSearch] = useState("");

  const isLoading = loadingProfiles || loadingInstances || loadingPayments || loadingTags;

  const joined = useMemo(() => {
    const profileRows = (profiles ?? []) as Profile[];
    const instanceRows = (instances ?? []) as Instance[];
    const paymentRows = (payments ?? []) as Payment[];
    const tagRows = (tags ?? []) as Tag[];

    return profileRows.map((profile) => {
      const clientInstances = instanceRows.filter((i) => i.user_id === profile.user_id);
      const clientPayments = paymentRows.filter((p) => p.user_id === profile.user_id && p.status === "approved");
      const clientTags = tagRows.filter((t) => t.user_id === profile.user_id);
      const revenue = clientPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const liveCount = clientInstances.filter((i) => isLive(i as any)).length;
      return { profile, revenue, automationsCount: clientInstances.length, liveCount, tags: clientTags };
    });
  }, [profiles, instances, payments, tags]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return joined;
    return joined.filter(({ profile }) =>
      `${profile.company_name} ${profile.website_url} ${profile.company_email}`.toLowerCase().includes(q),
    );
  }, [joined, search]);

  if (isLoading) return <Loading />;

  return (
    <AdminPage
      title="Client CRM & Tags"
      subtitle="One record per client with lifetime revenue, automation count and operational tags."
    >
      <Panel title="Search">
        <Input
          placeholder="Search company name, website or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Panel>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No clients match this search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(({ profile, revenue, automationsCount, liveCount, tags: clientTags }) => (
            <ClientCard
              key={profile.id}
              profile={profile}
              revenue={revenue}
              automationsCount={automationsCount}
              liveCount={liveCount}
              tags={clientTags}
            />
          ))}
        </div>
      )}
    </AdminPage>
  );
}
