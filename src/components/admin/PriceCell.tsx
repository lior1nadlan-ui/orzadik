// The price column of the admin products table, editable in place.
//
// Type the price the CUSTOMER pays and press Enter (or click away) — no
// dialog. The catalog price (stored; the site takes SITE_DISCOUNT off it) is
// computed and shown under the box, with the struck-through former price when
// one is shown. Escape puts the old value back.

import { useEffect, useRef, useState } from "react";
import { isSharpPriceChange, parsePriceInput, priceBreakdown } from "@/lib/admin-pricing";
import { catalogFromCustomerPrice, getEffectivePrice } from "@/lib/pricing";

function focusNextPrice(from: HTMLInputElement) {
  // Only boxes actually on screen: the table and the phone cards both render.
  const boxes = Array.from(
    document.querySelectorAll<HTMLInputElement>("input[data-price-cell]"),
  ).filter((el) => el.offsetParent !== null);
  const next = boxes[boxes.indexOf(from) + 1];
  if (next) {
    next.focus();
    next.scrollIntoView({ block: "center", behavior: "smooth" });
  } else {
    from.blur();
  }
}

export function PriceCell({
  price,
  salePrice,
  label,
  onSave,
}: {
  price: number;
  salePrice: number | null;
  /** Product name, for the input's accessible label. */
  label: string;
  /** Persist the new CATALOG price. Rejects to keep the box open for a retry. */
  onSave: (next: number) => Promise<void>;
}) {
  const customer = getEffectivePrice(Number(price));
  const [draft, setDraft] = useState(String(customer));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // A visible "saved" on the box itself — on a phone the toast can be off
  // screen or under the keyboard.
  const [justSaved, setJustSaved] = useState(false);
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 2500);
    return () => clearTimeout(t);
  }, [justSaved]);
  // A sharp change (likely an extra/missing digit) waits for a second Enter.
  const [confirmFor, setConfirmFor] = useState<number | null>(null);
  const skipBlur = useRef(false);
  // The value just saved, until the refetched price arrives — so the blur that
  // follows an Enter does not save the same price a second time.
  const lastSaved = useRef<number | null>(null);

  // A save elsewhere (bulk action, undo, refetch) replaces the shown value.
  useEffect(() => {
    setDraft(String(getEffectivePrice(Number(price))));
    setError(null);
    setConfirmFor(null);
    lastSaved.current = null;
  }, [price]);

  const parsed = parsePriceInput(draft);
  const nextCatalog = parsed.ok
    ? catalogFromCustomerPrice(parsed.value, Number(price))
    : Number(price);
  const shown = priceBreakdown(nextCatalog, salePrice);

  /** Resolves true when the box holds a saved price (or nothing changed). */
  const commit = async (): Promise<boolean> => {
    if (saving) return false;
    if (!parsed.ok) {
      setError(parsed.error);
      return false;
    }
    if (nextCatalog === Number(price)) {
      setError(null);
      setDraft(String(customer));
      return true;
    }
    if (nextCatalog === lastSaved.current) return true;
    if (isSharpPriceChange(customer, parsed.value) && confirmFor !== parsed.value) {
      setConfirmFor(parsed.value);
      return false;
    }
    setConfirmFor(null);
    setSaving(true);
    try {
      await onSave(nextCatalog);
      lastSaved.current = nextCatalog;
      setError(null);
      setJustSaved(true);
      return true;
    } catch {
      // The caller already told the owner why; keep the typed value to retry.
      return false;
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-w-[96px]">
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 start-2 grid place-content-center text-xs text-muted-foreground">
          ₪
        </span>
        <input
          dir="ltr"
          data-price-cell=""
          inputMode="decimal"
          enterKeyHint="done"
          aria-label={`מחיר ללקוח: ${label}`}
          aria-invalid={!!error}
          title={error ?? "המחיר שהלקוח משלם — Enter לשמירה, Esc לביטול"}
          value={draft}
          disabled={saving}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
            setConfirmFor(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              skipBlur.current = true;
              const box = e.currentTarget;
              void commit()
                .then((saved) => {
                  // Saved (or nothing to save) → straight on to the next
                  // product's price, so a run of updates needs no tapping.
                  if (saved) focusNextPrice(box);
                })
                .finally(() => (skipBlur.current = false));
            } else if (e.key === "Escape") {
              skipBlur.current = true;
              setDraft(String(customer));
              setError(null);
              setConfirmFor(null);
              e.currentTarget.blur();
              skipBlur.current = false;
            }
          }}
          onBlur={() => {
            if (!skipBlur.current) void commit();
          }}
          // 16px text on phones: iOS zooms the page into any smaller input.
          className={`h-11 w-28 rounded-md border bg-background ps-6 pe-2 text-base tabular-nums transition-opacity sm:h-9 sm:w-24 sm:text-sm ${
            justSaved ? "border-green-600 ring-1 ring-green-600" : ""
          } ${confirmFor !== null ? "border-amber-500 ring-1 ring-amber-500" : ""} ${
            error ? "border-destructive ring-1 ring-destructive" : ""
          } ${saving ? "opacity-50" : ""}`}
        />
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      ) : confirmFor !== null ? (
        <p className="mt-1 text-[11px] font-medium text-amber-700" role="alert">
          ₪{customer} → ₪{confirmFor}? שוב Enter / לחיצה לאישור
        </p>
      ) : justSaved ? (
        <p className="mt-1 text-[11px] font-medium text-green-700" role="status">
          נשמר ✓
        </p>
      ) : (
        <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">
          קטלוג ₪{nextCatalog}
          {shown.struck !== null && (
            <span className="ms-1 line-through opacity-70">₪{shown.struck}</span>
          )}
        </p>
      )}
    </div>
  );
}
