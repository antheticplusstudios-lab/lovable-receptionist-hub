import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SettingsMap = Record<string, Record<string, unknown>>;

export type BannerSetting = { enabled?: boolean; message?: string; tone?: string };
export type MaintenanceSetting = { enabled?: boolean; message?: string };

export const systemSettingsQueryOptions = {
  queryKey: ["system-settings-public"] as const,
  queryFn: async (): Promise<SettingsMap> => {
    const { data, error } = await supabase.from("system_settings").select("key, value");
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { key: string; value: unknown }[];
    return Object.fromEntries(
      rows.map((row) => [row.key, (row.value ?? {}) as Record<string, unknown>]),
    );
  },
  staleTime: 30_000,
};

export function useSystemSettings() {
  return useQuery(systemSettingsQueryOptions);
}

export function useBanner(): BannerSetting {
  const { data } = useSystemSettings();
  return (data?.["banner"] ?? {}) as BannerSetting;
}

export function useMaintenance(): MaintenanceSetting {
  const { data } = useSystemSettings();
  return (data?.["maintenance"] ?? {}) as MaintenanceSetting;
}

/** Feature switches default to ON so a missing row never hides working features. */
export function useFeatureFlag(key: string): boolean {
  const { data } = useSystemSettings();
  const flags = (data?.["feature_flags"] ?? {}) as Record<string, unknown>;
  return flags[key] !== false;
}
