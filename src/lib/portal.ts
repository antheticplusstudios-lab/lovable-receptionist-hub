import type { Tables } from "@/integrations/supabase/types";

export type Profile = Tables<"profiles">;
export type Instance = Tables<"automation_instances">;
export type Payment = Tables<"payment_submissions">;
export type AppRole = "client" | "verifier" | "partner" | "owner";

export const WIDGET_CDN = "https://cdn.antheticplus.ai/widget.js";

export function scriptTag(instance: Pick<Instance, "script_token" | "client_id">) {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `<script src="${base}/api/public/widget/script?token=${instance.script_token}" data-client-id="${instance.client_id ?? ""}" defer></script>`;
}

export function daysRemaining(expiresAt: string | null) {
  if (!expiresAt) return 0;
  const ms = new Date(expiresAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function isLive(instance: Instance) {
  return (instance.status === "paid" || instance.status === "active") && !instance.killed && daysRemaining(instance.expires_at) > 0;
}

export const statusLabels: Record<string, string> = {
  paid: "Paid · Awaiting setup",
  active: "Active",
  pending_payment: "Pending Verification",
  stopped: "Stopped",
  revoked: "Revoked",
  suspended: "Suspended",
  pending: "Pending Verification",
  approved: "Approved",
  rejected: "Rejected",
};

export function statusClass(status: string) {
  switch (status) {
    case "paid":
    case "active":
    case "approved":
      return "bg-success/12 text-success";
    case "pending_payment":
    case "pending":
      return "bg-foreground/12 text-foreground";
    case "rejected":
    case "revoked":
    case "suspended":
      return "bg-destructive/12 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export const paymentMethods = ["Crypto (USDT / BTC)", "Bank transfer", "Mobile money"] as const;

export function hostFromUrl(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0]!
    .toLowerCase();
}
