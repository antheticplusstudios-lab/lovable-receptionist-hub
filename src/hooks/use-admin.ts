import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  createGroqKey,
  deleteGroqKey,
  inviteStaff,
  listGroqKeys,
  provisionAutomation,
  reviewPayment,
  revokeStaff,
  runLifecycle,
  updateGroqKey,
} from "@/lib/admin.functions";

type LooseResult = { data: unknown[] | null; error: { message: string } | null };
type LooseQuery = PromiseLike<LooseResult> & {
  order: (column: string, options: { ascending: boolean }) => LooseQuery;
};

// Generic table reads: the generated client only accepts literal table names at type level.
const db = supabase as unknown as {
  from: (table: string) => { select: (columns: string) => LooseQuery };
};

async function rows<T>(table: string, order?: string, ascending = false): Promise<T[]> {
  let query: LooseQuery = db.from(table).select("*");
  if (order) query = query.order(order, { ascending });
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export const useAllInstances = () =>
  useQuery({ queryKey: ["admin", "instances"], queryFn: () => rows<any>("automation_instances", "created_at") });

export const useAllPayments = () =>
  useQuery({ queryKey: ["admin", "payments"], queryFn: () => rows<any>("payment_submissions", "submitted_at") });

export const useAllProfiles = () =>
  useQuery({ queryKey: ["admin", "profiles"], queryFn: () => rows<any>("profiles", "created_at") });

export const useTags = () => useQuery({ queryKey: ["admin", "tags"], queryFn: () => rows<any>("client_tags") });

export const useAuditLog = () => useQuery({ queryKey: ["admin", "audit"], queryFn: () => rows<any>("audit_log") });

export const usePricing = () =>
  useQuery({ queryKey: ["admin", "pricing"], queryFn: () => rows<any>("pricing_plans", "monthly_price", true) });

export const usePromos = () => useQuery({ queryKey: ["admin", "promos"], queryFn: () => rows<any>("promo_codes") });

export const usePrompts = () => useQuery({ queryKey: ["admin", "prompts"], queryFn: () => rows<any>("global_prompts", "key", true) });

export const useFailoverLog = () =>
  useQuery({ queryKey: ["admin", "failover"], queryFn: () => rows<any>("groq_failover_log") });

export const useUsage = () => useQuery({ queryKey: ["admin", "usage"], queryFn: () => rows<any>("usage_logs") });

export const useTranscripts = () => useQuery({ queryKey: ["admin", "transcripts"], queryFn: () => rows<any>("transcripts") });

export const useRoles = () => useQuery({ queryKey: ["admin", "roles"], queryFn: () => rows<any>("user_roles") });

export const useInvites = () => useQuery({ queryKey: ["admin", "invites"], queryFn: () => rows<any>("staff_invites") });

export const useGroqKeys = () => useQuery({ queryKey: ["admin", "groq-keys"], queryFn: () => listGroqKeys() });

/** Every privileged action funnels through one helper so failures always surface to the operator. */
function useAction<TArgs>(fn: (...args: any[]) => Promise<any>, verb: string) {
  const queryClient = useQueryClient();
  const call = useServerFn(fn as any);
  return useMutation({
    mutationFn: (args: TArgs) => call({ data: args } as any),
    onSuccess: () => {
      toast.success(verb);
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Action failed"),
  });
}

export const useReviewPayment = () => {
  const queryClient = useQueryClient();
  const call = useServerFn(reviewPayment as any);
  return useMutation({
    mutationFn: (args: { paymentId: string; approve: boolean; reason: string }) => call({ data: args } as any),
    onSuccess: (res: any, args) => {
      if (args.approve) {
        toast.success("Approved & deployed", {
          description: `Automation activated, expiry extended, script compiled${res?.crawled ? ", website crawled" : " (website crawl couldn't reach the site)"}.`,
        });
      } else toast.success("Payment rejected");
      void queryClient.invalidateQueries();
    },
    onError: (error: Error) => toast.error(error.message || "Action failed"),
  });
};
export const useProvisionAutomation = () =>
  useAction<{ automationId: string }>(provisionAutomation, "Automation deployed");
export const useRunLifecycle = () => useAction<Record<string, never>>(runLifecycle, "Lifecycle check complete");
export const useCreateGroqKey = () =>
  useAction<{ label: string; keyValue: string; isPrimary: boolean }>(createGroqKey, "Key added to the pool");
export const useUpdateGroqKey = () =>
  useAction<{ id: string; enabled?: boolean; makePrimary?: boolean; clearCooldown?: boolean }>(
    updateGroqKey,
    "Key updated",
  );
export const useDeleteGroqKey = () => useAction<{ id: string }>(deleteGroqKey, "Key removed");
export const useInviteStaff = () => useAction<{ email: string; role: "partner" | "verifier" | "admin" }>(inviteStaff, "Invite created");
export const useRevokeStaff = () =>
  useAction<{ userId: string; role: "owner" | "partner" | "admin" | "verifier" | "client" }>(revokeStaff, "Access revoked");
