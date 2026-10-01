// "הזמנה טלפונית" — open an order for a customer who called or wrote on
// WhatsApp, then hand them the payment link. Prices shown here are a preview;
// the server prices the order itself (createPhoneOrder → priceOrderLines), so
// a promotion or a member discount is applied exactly as on the site.

import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Plus, Minus, Trash2, MessageCircle, Copy } from "lucide-react";
import { createPhoneOrder, searchOrderProducts } from "@/lib/admin-orders.functions";
import { waMessage } from "@/lib/wa-templates";
import { formatILS } from "@/lib/cart";
import { getShipping, type Fulfillment } from "@/lib/pricing";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

type Found = Awaited<ReturnType<typeof searchOrderProducts>>[number];
type Line = {
  key: string;
  productId: string;
  variantId: string | null;
  name: string;
  price: number;
  quantity: number;
  customText: string;
};
type Created = { id: string; orderNumber: string; total: number; payUrl: string };

const EMPTY = { name: "", email: "", phone: "", city: "", address: "", notes: "" };

export function PhoneOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const searchFn = useServerFn(searchOrderProducts);
  const createFn = useServerFn(createPhoneOrder);
  const [form, setForm] = useState(EMPTY);
  const [fulfillment, setFulfillment] = useState<Fulfillment>("delivery");
  // Unticked: the owner ticks it only after actually asking the customer.
  const [consent, setConsent] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Found[]>([]);
  // "idle" | "searching" | "done" | "error" — so an empty result says so.
  const [searchState, setSearchState] = useState<"idle" | "searching" | "done" | "error">("idle");
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);

  useEffect(() => {
    if (!open) {
      setForm(EMPTY);
      setFulfillment("delivery");
      setConsent(false);
      setQ("");
      setResults([]);
      setLines([]);
      setCreated(null);
    }
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setSearchState("idle");
      return;
    }
    let cancelled = false;
    setSearchState("searching");
    const t = setTimeout(async () => {
      try {
        const r = await searchFn({ data: { q: term } });
        if (!cancelled) {
          setResults(r);
          setSearchState("done");
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setSearchState("error");
        }
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [q, searchFn]);

  const add = (p: Found, v?: Found["variants"][number]) => {
    const key = `${p.id}:${v?.id ?? ""}`;
    setLines((ls) =>
      ls.some((l) => l.key === key)
        ? ls.map((l) => (l.key === key ? { ...l, quantity: l.quantity + 1 } : l))
        : [
            ...ls,
            {
              key,
              productId: p.id,
              variantId: v?.id ?? null,
              name: v ? `${p.name} — ${v.label}` : p.name,
              price: v?.price ?? p.price,
              quantity: 1,
              customText: "",
            },
          ],
    );
    setQ("");
    setResults([]);
  };

  const setQty = (key: string, d: number) =>
    setLines((ls) =>
      ls
        .map((l) => (l.key === key ? { ...l, quantity: l.quantity + d } : l))
        .filter((l) => l.quantity > 0),
    );

  const itemsTotal = lines.reduce((s, l) => s + l.price * l.quantity, 0);
  const shipping = getShipping(itemsTotal, fulfillment);
  const pickup = fulfillment === "pickup";

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      toast.error("יש למלא שם, אימייל וטלפון");
      return;
    }
    // Same checks as /checkout, so a typo gets a Hebrew message here instead
    // of the server's validation error.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast.error("כתובת האימייל אינה תקינה");
      return;
    }
    if (form.phone.replace(/\D/g, "").length < 9) {
      toast.error("מספר הטלפון אינו תקין");
      return;
    }
    if (!pickup && !form.address.trim()) {
      toast.error("יש להזין כתובת למשלוח, או לבחור איסוף עצמי");
      return;
    }
    if (lines.length === 0) {
      toast.error("יש להוסיף לפחות מוצר אחד");
      return;
    }
    setBusy(true);
    try {
      const r = await createFn({
        data: {
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          fulfillment,
          customer_address: pickup ? null : form.address,
          customer_city: pickup ? null : form.city || null,
          notes: form.notes || null,
          contact_consent: consent,
          items: lines.map((l) => ({
            product_id: l.productId,
            variant_id: l.variantId,
            quantity: l.quantity,
            custom_text: l.customText || null,
          })),
        },
      });
      setCreated(r);
      onCreated();
      toast.success(`הזמנה ${r.orderNumber} נוצרה`);
    } catch (e: any) {
      toast.error(e?.message ?? "יצירת ההזמנה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const waText = created
    ? `שלום ${form.name}, כאן מאור זרוע לצדיק 🙏\nפתחנו עבורך את הזמנה ${created.orderNumber} על סך ${formatILS(created.total)}.\nלתשלום מאובטח בכרטיס אשראי: ${created.payUrl}\nתודה!`
    : "";
  const wa = created ? waMessage(form.phone, waText) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl max-h-[90dvh] overflow-y-auto"
        dir="rtl"
        // A tap outside must not wipe a half-built order.
        onInteractOutside={(e) => {
          if (!created && (lines.length > 0 || form.name.trim())) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>הזמנה טלפונית</DialogTitle>
        </DialogHeader>

        {created ? (
          <div className="space-y-4 text-sm">
            <p>
              הזמנה <strong>{created.orderNumber}</strong> נוצרה על סך{" "}
              <strong>{formatILS(created.total)}</strong> וממתינה לתשלום. שלחו ללקוח את הקישור — הוא
              משלם בעמוד מאובטח של חברת האשראי, וההזמנה תסומן כשולמה אוטומטית.
            </p>
            <div className="rounded-md bg-muted p-2 font-mono text-xs break-all" dir="ltr">
              {created.payUrl}
            </div>
            <div className="flex flex-wrap gap-2">
              {wa && (
                <Button asChild>
                  <a href={wa} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="h-4 w-4" /> שליחה בוואטסאפ
                  </a>
                </Button>
              )}
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(waText);
                    toast.success("ההודעה עם הקישור הועתקה");
                  } catch {
                    toast.error("ההעתקה נכשלה");
                  }
                }}
              >
                <Copy className="h-4 w-4" /> העתקת הודעה
              </Button>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                סגירה
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="po-name">שם *</Label>
                <Input
                  id="po-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="po-phone">טלפון *</Label>
                <Input
                  id="po-phone"
                  type="tel"
                  dir="ltr"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="po-email">אימייל * (לאישור ההזמנה והקבלה)</Label>
                <Input
                  id="po-email"
                  type="email"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 font-medium">קבלת ההזמנה</legend>
              {/* Same option cards as the checkout, so both read the same. */}
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    ["delivery", "משלוח"],
                    ["pickup", "איסוף עצמי מהחנות"],
                  ] as const
                ).map(([v, label]) => (
                  <label
                    key={v}
                    className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border p-3 ${
                      fulfillment === v ? "border-accent bg-accent/5" : "border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      name="po-fulfillment"
                      checked={fulfillment === v}
                      onChange={() => setFulfillment(v)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            {!pickup && (
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label htmlFor="po-city">עיר</Label>
                  <Input
                    id="po-city"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="po-address">כתובת *</Label>
                  <Input
                    id="po-address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            )}

            <div>
              <Label htmlFor="po-search">הוספת מוצר</Label>
              <Input
                id="po-search"
                placeholder="שם מוצר או מק״ט"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              {searchState === "searching" && (
                <p className="mt-1 text-xs text-muted-foreground" role="status">
                  מחפש…
                </p>
              )}
              {searchState === "done" && results.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground" role="status">
                  לא נמצאו מוצרים ל-"{q.trim()}"
                </p>
              )}
              {searchState === "error" && (
                <p className="mt-1 text-xs text-destructive" role="status">
                  החיפוש נכשל — נסו שוב.
                </p>
              )}
              {results.length > 0 && (
                <ul className="mt-1 max-h-60 overflow-y-auto rounded-md border divide-y">
                  {results.map((p) => (
                    <li key={p.id} className="p-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className={p.outOfStock ? "text-muted-foreground line-through" : ""}>
                          {p.name}
                          {p.sku ? (
                            <span className="text-xs text-muted-foreground"> · {p.sku}</span>
                          ) : null}
                        </span>
                        {p.variants.length === 0 && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={p.outOfStock}
                            onClick={() => add(p)}
                          >
                            {formatILS(p.price)} +
                          </Button>
                        )}
                      </div>
                      {p.variants.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {p.variants.map((v) => (
                            <Button
                              key={v.id}
                              size="sm"
                              variant="outline"
                              disabled={!v.inStock || p.outOfStock}
                              onClick={() => add(p, v)}
                            >
                              {v.label} · {formatILS(v.price ?? p.price)}
                            </Button>
                          ))}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {lines.length > 0 && (
              <ul className="space-y-2">
                {lines.map((l) => (
                  <li key={l.key} className="rounded-md border p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{l.name}</span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="הפחתה"
                          onClick={() => setQty(l.key, -1)}
                        >
                          {l.quantity === 1 ? (
                            <Trash2 className="h-4 w-4" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                        </Button>
                        <span className="w-6 text-center">{l.quantity}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label="הוספה"
                          onClick={() => setQty(l.key, 1)}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                        <span className="w-20 text-end">{formatILS(l.price * l.quantity)}</span>
                      </div>
                    </div>
                    <Input
                      placeholder="כיתוב / הקדשה (לא חובה)"
                      aria-label={`כיתוב או הקדשה ל${l.name}`}
                      maxLength={120}
                      value={l.customText}
                      onChange={(e) =>
                        setLines((ls) =>
                          ls.map((x) =>
                            x.key === l.key ? { ...x, customText: e.target.value } : x,
                          ),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
            )}

            <div>
              <Label htmlFor="po-notes">הערות</Label>
              <Textarea
                id="po-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <label className="flex items-start gap-2 cursor-pointer">
              <Checkbox
                checked={consent}
                onCheckedChange={(v) => setConsent(v === true)}
                className="mt-0.5"
              />
              <span className="text-xs">
                הלקוח הסכים שניצור איתו קשר בנושא ההזמנה (תזכורת תשלום ובקשת חוות דעת)
              </span>
            </label>

            <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-between gap-2 border-t bg-background px-6 pb-2 pt-3">
              <div className="text-xs text-muted-foreground">
                פריטים {formatILS(itemsTotal)} ·{" "}
                {pickup ? "איסוף עצמי" : `משלוח ${formatILS(shipping)}`}
                <span className="block">
                  הסכום הסופי נקבע בשרת (מבצעים והנחת חבר מועדון חלים אוטומטית)
                </span>
              </div>
              <Button onClick={submit} disabled={busy} className="w-full sm:w-auto">
                {busy ? "יוצר..." : `יצירת הזמנה · ${formatILS(itemsTotal + shipping)}`}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
