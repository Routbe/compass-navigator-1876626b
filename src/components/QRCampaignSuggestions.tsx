import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestQrCampaignFn } from "@/lib/qr-ai.functions";
import { qrCampaignSchema } from "@/lib/qr-ai-schema";

export function QRCampaignSuggestions({ destination, onApply }: { destination: string; onApply: (url: string, label: string, cta: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState(""); const [goal, setGoal] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{ label: string; callToAction: string; destination: string } | null>(null);
  const suggest = useServerFn(suggestQrCampaignFn);
  async function generate() {
    const parsed = qrCampaignSchema.safeParse({ destination: url || destination, goal });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Controleer de invoer."); return; }
    setBusy(true); setError(""); setSuggestion(null);
    try { const result = await suggest({ data: parsed.data }); if (result.ok) setSuggestion({ ...result, destination: parsed.data.destination }); else setError(result.error); }
    catch { setError("Het AI-voorstel kon niet worden gemaakt."); } finally { setBusy(false); }
  }
  return <details open={open} onToggle={e => setOpen(e.currentTarget.open)} className="border-b border-border pb-5 mb-5">
    <summary className="cursor-pointer flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4" />Campagne · Lovable AI</summary>
    <div className="space-y-3 pt-4">
      <div className="space-y-1.5"><Label htmlFor="ai-qr-url">Bestemming</Label><Input id="ai-qr-url" type="url" value={url || destination} onChange={e => setUrl(e.target.value)} placeholder="https://…" maxLength={2048} disabled={busy} /></div>
      <div className="space-y-1.5"><Label htmlFor="ai-qr-goal">Campagnedoel</Label><Input id="ai-qr-goal" value={goal} onChange={e => setGoal(e.target.value)} placeholder="Meer inschrijvingen voor ons evenement" maxLength={500} disabled={busy} /></div>
      <Button onClick={generate} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? "Voorstel maken…" : "Maak een voorstel"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {suggestion && <div className="space-y-3 border-t border-border pt-3" aria-live="polite"><div><p className="text-xs text-muted-foreground">Label</p><p className="text-sm break-words">{suggestion.label}</p></div><div><p className="text-xs text-muted-foreground">Oproep tot actie</p><p className="text-sm break-words">{suggestion.callToAction}</p></div><Button variant="outline" className="w-full" onClick={() => onApply(suggestion.destination, suggestion.label, suggestion.callToAction)}><Check className="h-4 w-4" />Gebruik voorstel</Button></div>}
    </div>
  </details>;
}