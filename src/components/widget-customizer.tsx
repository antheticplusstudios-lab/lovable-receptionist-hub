import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

export type WidgetConfig = {
  orb_color_primary: string;
  orb_color_secondary: string;
  orb_color_accent: string;
  animation_speed: number;
  waveform_amplitude: number;
  position: "bottom-right" | "bottom-left";
  enable_waveforms: boolean;
  greeting_text: string;
  font_style: string;
};

const DEFAULTS: WidgetConfig = {
  orb_color_primary: "#6366f1",
  orb_color_secondary: "#a855f7",
  orb_color_accent: "#22d3ee",
  animation_speed: 1,
  waveform_amplitude: 0.6,
  position: "bottom-right",
  enable_waveforms: true,
  greeting_text: "Hello! How can I assist you today?",
  font_style: "sans",
};

export function WidgetCustomizer({
  automationId,
  initial,
  onSaved,
}: {
  automationId: string;
  initial: unknown;
  onSaved?: () => void;
}) {
  const [c, setC] = useState<WidgetConfig>({ ...DEFAULTS, ...(initial as Partial<WidgetConfig>) });
  const [saving, setSaving] = useState(false);
  useEffect(() => setC({ ...DEFAULTS, ...(initial as Partial<WidgetConfig>) }), [initial]);

  async function save() {
    setSaving(true);
    const { error } = await supabase.from("client_automations").update({ widget_config: c }).eq("id", automationId);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Widget saved");
    onSaved?.();
  }

  // Preview colors come from the client's chosen brand values, so inline styles are intentional here.
  const speed = `${2.4 / Math.max(0.2, c.animation_speed)}s`;
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div className="grid gap-3">
        {(["orb_color_primary", "orb_color_secondary", "orb_color_accent"] as const).map((k) => (
          <div key={k} className="flex items-center justify-between gap-3">
            <Label className="capitalize">{k.replace("orb_color_", "")} orb color</Label>
            <input type="color" value={c[k]} onChange={(e) => setC({ ...c, [k]: e.target.value })} />
          </div>
        ))}
        <Label>Animation speed ({c.animation_speed.toFixed(1)}x)</Label>
        <input type="range" min={0.2} max={3} step={0.1} value={c.animation_speed} onChange={(e) => setC({ ...c, animation_speed: Number(e.target.value) })} />
        <Label>Waveform amplitude ({Math.round(c.waveform_amplitude * 100)}%)</Label>
        <input type="range" min={0} max={1} step={0.05} value={c.waveform_amplitude} onChange={(e) => setC({ ...c, waveform_amplitude: Number(e.target.value) })} />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={c.enable_waveforms} onChange={(e) => setC({ ...c, enable_waveforms: e.target.checked })} /> Show waveform
        </label>
        <Label>Greeting</Label>
        <Input value={c.greeting_text} onChange={(e) => setC({ ...c, greeting_text: e.target.value })} />
        <Label>Font style</Label>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={c.font_style} onChange={(e) => setC({ ...c, font_style: e.target.value })}>
          <option value="sans">Sans</option>
          <option value="serif">Serif</option>
          <option value="mono">Mono</option>
        </select>
        <Label>Position</Label>
        <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={c.position} onChange={(e) => setC({ ...c, position: e.target.value as WidgetConfig["position"] })}>
          <option value="bottom-right">Bottom right</option>
          <option value="bottom-left">Bottom left</option>
        </select>
        <Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save widget"}</Button>
      </div>
      <div className="relative min-h-80 overflow-hidden rounded-2xl border border-border bg-muted/40">
        <div className={`absolute bottom-4 w-64 rounded-2xl border border-border bg-card p-4 shadow-lg ${c.position === "bottom-left" ? "left-4" : "right-4"}`}>
          <div className="mx-auto h-20 w-20 animate-pulse rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${c.orb_color_accent}, ${c.orb_color_primary} 55%, ${c.orb_color_secondary})`, animationDuration: speed }} />
          {c.enable_waveforms && (
            <div className="mt-3 flex h-8 items-center justify-center gap-1">
              {Array.from({ length: 14 }).map((_, i) => (
                <span key={i} className="w-1 animate-pulse rounded-full" style={{ background: c.orb_color_primary, height: `${20 + Math.abs(Math.sin(i)) * 80 * c.waveform_amplitude}%`, animationDelay: `${i * 60}ms`, animationDuration: speed }} />
              ))}
            </div>
          )}
          <div className="mt-2 rounded-full bg-muted px-3 py-1 text-center text-[11px]">⚡ Checking Google Calendar…</div>
          <p className={`mt-2 text-sm font-${c.font_style}`}>{c.greeting_text}</p>
        </div>
      </div>
    </div>
  );
}
