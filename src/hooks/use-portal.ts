import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole, Instance, Payment, Profile } from "@/lib/portal";

export function useCurrentUser() {
  return useQuery({
    queryKey: ["current-user"],
    queryFn: async () => (await supabase.auth.getUser()).data.user,
    staleTime: 60_000,
  });
}

export function useProfile() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useRole() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["roles", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<AppRole> => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", user!.id);
      if (error) throw error;
      let roles = (data ?? []).map((r) => r.role as string);
      if (!roles.some((r) => r !== "client")) {
        const { data: claimed } = await supabase.rpc("claim_staff_invite");
        if (claimed) roles = [...roles, claimed];
      }
      if (roles.includes("owner")) return "owner";
      if (roles.includes("partner") || roles.includes("admin")) return "partner";
      if (roles.includes("verifier")) return "verifier";
      return "client";
    },
  });
}

export function useInstances() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["instances", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Instance[]> => {
      const { data, error } = await supabase
        .from("automation_instances")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useMyPayments() {
  const { data: user } = useCurrentUser();
  return useQuery({
    queryKey: ["my-payments", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from("payment_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
