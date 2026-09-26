// The price column of the admin products table, editable in place.
//
// Type a new catalog price and press Enter (or click away) — no dialog. Under
// the box the cell always says what that price means on the site: what every
// customer pays after the site-wide discount, and the struck-through former
// price when one is shown. Escape puts the old value back.

import { useEffect, useRef, useState } from "react";
import { parsePriceInput, priceBreakdown } from "@/lib/admin-pricing";

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
  /** Persist the new catalog price. Rejects to keep the box open for a retry. */
  onSave: (next: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(String(price));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const skipBlur = useRef(false);
  // The value just saved, until the refetched price arrives — so the blur that
  // follows an Enter does not save the same price a second time.
  const lastSaved = useRef<number | null>(null);

  // A save elsewhere (bulk action, undo, refetch) replaces the shown value.
  useEffect(() => {
    setDraft(String(price));
    setError(null);
    lastSaved.current = null;
  }, [price]);

  const parsed = parsePriceInput(draft);
  const shown = priceBreakdown(parsed.ok ? parsed.value : price, salePrice);

  const commit = async () => {
    if (saving) return;
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    if (parsed.value === Number(price)) {
      setError(null);
      setDraft(String(price));
      return;
    }
    if (parsed.value === lastSaved.current) return;
    setSaving(true);
    try {
      await onSave(parsed.value);
      lastSaved.current = parsed.value;
      setError(null);
    } catch {
      // The caller already told the owner why; keep the typed value to retry.
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
          inputMode="decimal"
          aria-label={`מחיר קטלוג: ${label}`}
          aria-invalid={!!error}
          title={error ?? "מחיר קטלוג — Enter לשמירה, Esc לביטול"}
          value={draft}
          disabled={saving}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              skipBlur.current = true;
              void commit().finally(() => (skipBlur.current = false));
            } else if (e.key === "Escape") {
              skipBlur.current = true;
              setDraft(String(price));
              setError(null);
              e.currentTarget.blur();
              skipBlur.current = false;
            }
          }}
          onBlur={() => {
            if (!skipBlur.current) void commit();
          }}
          className={`h-9 w-24 rounded-md border bg-background ps-6 pe-2 text-sm tabular-nums transition-opacity ${
            error ? "border-destructive ring-1 ring-destructive" : ""
          } ${saving ? "opacity-50" : ""}`}
        />
      </div>
      {error ? (
        <p className="mt-1 text-[11px] text-destructive">{error}</p>
      ) : (
        <p className="mt-1 whitespace-nowrap text-[11px] text-muted-foreground">
          ללקוח ₪{shown.customer}
          {shown.struck !== null && (
            <span className="ms-1 line-through opacity-70">₪{shown.struck}</span>
          )}
        </p>
      )}
    </div>
  );
}
