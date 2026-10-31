import { useState, useId } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { suggestQrCampaignFn } from "@/lib/qr-ai.functions";
import { qrCampaignSchema } from "@/lib/qr-ai-schema";

export function QRCampaignSuggestions({ destination, onApply }: { destination: string; onApply: (url: string, label: string, cta: string) => void }) {
  const [url, setUrl] = useState<string | null>(null); const [goal, setGoal] = useState("");
  const id = useId();
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [suggestion, setSuggestion] = useState<{ label: string; callToAction: string; destination: string } | null>(null);
  const suggest = useServerFn(suggestQrCampaignFn);
  async function generate() {
    const parsed = qrCampaignSchema.safeParse({ destination: url ?? destination, goal });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Controleer de invoer."); return; }
    setBusy(true); setError(""); setSuggestion(null);
    try { const result = await suggest({ data: parsed.data }); if (result.ok) setSuggestion({ ...result, destination: parsed.data.destination }); else setError(result.error); }
    catch { setError("Het AI-voorstel kon niet worden gemaakt."); } finally { setBusy(false); }
  }
  return <section className="border-b border-border pb-5 mb-5" aria-label="QR campagne">
    <h2 className="flex items-center gap-2 text-sm font-medium"><Sparkles aria-hidden="true" className="h-4 w-4" />QR Smart Labels</h2>
    <div className="space-y-3 pt-4">
      <div className="space-y-1.5"><Label htmlFor={`${id}-url`}>Bestemming</Label><Input id={`${id}-url`} type="url" value={url ?? destination} onChange={e => { setUrl(e.target.value); setSuggestion(null); }} placeholder="https://…" maxLength={2048} disabled={busy} /></div>
      <div className="space-y-1.5"><Label htmlFor={`${id}-goal`}>Campagnedoel</Label><Input id={`${id}-goal`} value={goal} onChange={e => { setGoal(e.target.value); setSuggestion(null); }} placeholder="Meer inschrijvingen voor ons evenement" maxLength={500} disabled={busy} /></div>
      <Button onClick={generate} disabled={busy} className="w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy ? "Voorstel maken…" : "Maak een voorstel"}</Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {suggestion && <div className="space-y-3 border-t border-border pt-3" aria-live="polite"><div><Label htmlFor={`${id}-label`}>Label</Label><Input id={`${id}-label`} value={suggestion.label} maxLength={60} onChange={e => setSuggestion({ ...suggestion, label: e.target.value })} /></div><div><Label htmlFor={`${id}-cta`}>Oproep tot actie</Label><Input id={`${id}-cta`} value={suggestion.callToAction} maxLength={80} onChange={e => setSuggestion({ ...suggestion, callToAction: e.target.value })} /></div><Button variant="outline" className="w-full" disabled={!suggestion.label.trim() || !suggestion.callToAction.trim()} onClick={() => onApply(suggestion.destination, suggestion.label, suggestion.callToAction)}><Check aria-hidden="true" className="h-4 w-4" />Gebruik voorstel</Button></div>}
    </div>
  </section>;
}