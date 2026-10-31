import { CreditCard, Landmark } from "lucide-react";
import { siPaypal, siVenmo, siCashapp, siPix, siAlipay, siWechat, siBitcoin } from "simple-icons";
import { cn } from "@/lib/utils";

const brands = { paypal: siPaypal, venmo: siVenmo, cashapp: siCashapp, pix: siPix, alipay: siAlipay, wechat: siWechat, crypto: siBitcoin };
const names: Record<string, string> = { bancontact: "Bancontact", payconiq: "Payconiq", iban: "SEPA / EPC credit transfer", wero: "Wero" };

/** Bundled CC0 Simple Icons, with local Lucide fallback. No visitor CDN requests. */
export function PaymentBrandIcon({ id, className }: { id: string; className?: string }) {
  const brand = brands[id as keyof typeof brands];
  const name = brand?.title ?? names[id] ?? "Betaling";
  return (
    <span className={cn("rounded-xl overflow-hidden flex items-center justify-center shrink-0 border border-border/60 bg-secondary text-foreground", className)} role="img" aria-label={name}>
      {brand ? (
        <svg viewBox="0 0 24 24" className="h-[70%] w-[70%] fill-current" aria-hidden="true"><path d={brand.path} /></svg>
      ) : id === "iban" ? <Landmark className="h-[62%] w-[62%]" aria-hidden="true" />
        : id === "wero" ? <span className="text-xs font-bold">WERO</span>
        : <CreditCard className="h-[70%] w-[70%]" aria-hidden="true" />}
    </span>
  );
}