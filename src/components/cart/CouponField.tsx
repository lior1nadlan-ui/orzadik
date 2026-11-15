// The checkout's coupon code box. It sits just above the pay button, whose
// amount it changes — on a phone the summary column is far below the form, so
// the button is where the shopper sees the new total. Collapsed behind a link
// until wanted: an open, empty code box sends shoppers away hunting for a code.
import { useEffect, useState } from "react";
import { TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatILS } from "@/lib/cart";
import { minimumHint, noEligibleHint, offerText, type CouponTerms } from "@/lib/coupons";

/**
 * A code that is good but not usable yet — a personal one waiting for its
 * customer's email, or one refused only by the per-IP cap. It sits in the box,
 * ready, with a line on what it waits for.
 */
export type PendingCoupon = { code: string; note: string };

export function CouponField({
  coupon,
  pending,
  applied,
  issue,
  visible = true,
  saved,
  busy,
  error,
  disabled,
  onApply,
  onRemove,
}: {
  /** The code in use, or null. */
  coupon: CouponTerms | null;
  /** A code waiting on the shopper (shown when no code is in use). */
  pending?: PendingCoupon | null;
  /** Whether the code gives something on this cart. */
  applied: boolean;
  /** Why it does not (computeOrderTotals' couponIssue). */
  issue?: "min_order" | "no_eligible_items" | null;
  /**
   * Whether to offer the box at all (coupons on and one live). A code already
   * in play, or an error to explain, shows regardless.
   */
  visible?: boolean;
  /** Shekels the code saves on this order: items discount plus waived shipping. */
  saved: number;
  busy: boolean;
  error: string | null;
  disabled?: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  // A waiting code is put in the box, so applying it is one press away.
  const pendingCode = pending?.code ?? "";
  useEffect(() => {
    if (pendingCode) setText(pendingCode);
  }, [pendingCode]);

  if (coupon) {
    return (
      <div className="rounded-xl hairline bg-accent/5 px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <TicketPercent className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="min-w-0">
              קופון{" "}
              <bdi dir="ltr" className="font-semibold">
                {coupon.code}
              </bdi>{" "}
              · {offerText(coupon)}
            </span>
          </span>
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            className="shrink-0 text-xs text-muted-foreground underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
          >
            הסרה
          </button>
        </div>
        {applied ? (
          saved > 0 && <p className="mt-1 text-meta text-argaman">חוסכים {formatILS(saved)}</p>
        ) : (
          <p className="mt-1 text-meta text-muted-foreground">
            {issue === "no_eligible_items" ? noEligibleHint(coupon) : minimumHint(coupon)}
          </p>
        )}
      </div>
    );
  }

  // No code to be had anywhere: no box (it would only send shoppers hunting).
  if (!visible && !error && !pending) return null;

  // An error (a code from a link that has expired, say) or a waiting code
  // opens the box, so the shopper sees why no discount appears yet.
  if (!open && !error && !pending) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-accent underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
      >
        יש לך קוד קופון?
      </button>
    );
  }

  const submit = () => {
    if (text.trim()) onApply(text);
  };
  return (
    <div className="space-y-1.5">
      <Label htmlFor="coupon-code">קוד קופון</Label>
      <div className="flex gap-2">
        <Input
          id="coupon-code"
          dir="ltr"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={60}
          value={text}
          onChange={(e) => setText(e.target.value)}
          // Enter here applies the code; it must not submit the whole order.
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          aria-invalid={!!error}
          aria-describedby={error ? "coupon-code-error" : pending ? "coupon-code-note" : undefined}
          disabled={disabled}
        />
        <Button
          type="button"
          variant="outline"
          onClick={submit}
          disabled={disabled || busy || !text.trim()}
          aria-busy={busy}
          className="shrink-0"
        >
          {busy ? "בודקים…" : "החלה"}
        </Button>
      </div>
      {error ? (
        <p id="coupon-code-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : (
        pending && (
          <p id="coupon-code-note" role="status" className="text-xs text-muted-foreground">
            {pending.note}
          </p>
        )
      )}
    </div>
  );
}
