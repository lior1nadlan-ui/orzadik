// The checkout's coupon code box. It sits just above the pay button, whose
// amount it changes — on a phone the summary column is far below the form, so
// the button is where the shopper sees the new total. Collapsed behind a link
// until wanted: an open, empty code box sends shoppers away hunting for a code.
import { useState } from "react";
import { TicketPercent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatILS } from "@/lib/cart";
import { describeCoupon, minimumHint, type CouponTerms } from "@/lib/coupons";

export function CouponField({
  coupon,
  applied,
  saved,
  busy,
  error,
  disabled,
  onApply,
  onRemove,
}: {
  /** The code in use, or null. */
  coupon: CouponTerms | null;
  /** Whether the cart reaches the code's minimum (it gives nothing otherwise). */
  applied: boolean;
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
              · {describeCoupon(coupon)}
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
          <p className="mt-1 text-meta text-muted-foreground">{minimumHint(coupon)}</p>
        )}
      </div>
    );
  }

  // An error (a code from a link that has expired, say) opens the box so the
  // shopper sees why no discount appears.
  if (!open && !error) {
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
          aria-describedby={error ? "coupon-code-error" : undefined}
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
      {error && (
        <p id="coupon-code-error" role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
