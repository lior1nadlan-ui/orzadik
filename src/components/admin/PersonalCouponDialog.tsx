// "קופון אישי" from a customer's CRM card: a one-time code that only this
// customer's email can use (an apology, a thank-you, a birthday), created in a
// click and sent straight away on WhatsApp or by email. The server generates
// the code and pins it to the email (createPersonalCoupon).
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle } from "lucide-react";
import { createPersonalCoupon } from "@/lib/admin-coupons.functions";
import {
  COUPON_FIXED_HIGH,
  COUPON_PERCENT_HIGH,
  isHighCouponDiscount,
  offerText,
  personalCouponMessage,
  whatsappLink,
  type CouponDiscountType,
} from "@/lib/coupons";
import { BUSINESS } from "@/lib/business";
import { formatILS } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const dateIL = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(iso));

export function PersonalCouponDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: { email: string; name: string | null; phone: string | null };
}) {
  const qc = useQueryClient();
  const create = useServerFn(createPersonalCoupon);
  const [type, setType] = useState<CouponDiscountType>("percent");
  const [value, setValue] = useState("10");
  const [freeShipping, setFreeShipping] = useState(false);
  const [days, setDays] = useState("30");
  const [confirmHigh, setConfirmHigh] = useState(false);
  const [created, setCreated] = useState<{ code: string; ends_at: string } | null>(null);

  const terms = {
    discountType: type,
    discountValue: Number(value) || 0,
    freeShipping,
  };
  const high = isHighCouponDiscount({ discount_type: type, discount_value: Number(value) || 0 });

  const mut = useMutation({
    mutationFn: () =>
      create({
        data: {
          email: customer.email,
          name: customer.name,
          discount_type: type,
          discount_value: Number(value),
          free_shipping: freeShipping,
          days: Math.round(Number(days)),
          confirm_high: confirmHigh,
        },
      }),
    onSuccess: (r) => {
      setCreated(r);
      void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
      toast.success(`נוצר קופון אישי ${r.code}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const message = created
    ? personalCouponMessage({
        name: customer.name ?? "",
        code: created.code,
        offer: offerText(terms),
        until: dateIL(created.ends_at),
        shopLink: `${BUSINESS.site}/?coupon=${encodeURIComponent(created.code)}`,
      })
    : "";

  const close = (o: boolean) => {
    if (!o) {
      setCreated(null);
      setConfirmHigh(false);
    }
    onOpenChange(o);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>קופון אישי ל{customer.name || customer.email}</DialogTitle>
          <DialogDescription>
            קוד לשימוש אחד, רק עם האימייל של הלקוח (<bdi dir="ltr">{customer.email}</bdi>).
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-3">
            <div className="rounded-lg border bg-muted/40 p-3 text-center">
              <button
                type="button"
                dir="ltr"
                className="inline-flex items-center gap-1.5 font-mono text-2xl font-bold"
                onClick={() =>
                  navigator.clipboard
                    .writeText(created.code)
                    .then(() => toast.success("הקוד הועתק"))
                    .catch(() => toast.error("לא ניתן להעתיק"))
                }
                title="העתקת הקוד"
              >
                {created.code}
                <Copy className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
              </button>
              <div className="text-sm text-accent">{offerText(terms)}</div>
              <div className="text-xs text-muted-foreground">
                בתוקף עד {dateIL(created.ends_at)}
              </div>
            </div>
            <pre className="whitespace-pre-wrap rounded-md border bg-card p-2 font-sans text-xs text-muted-foreground">
              {message}
            </pre>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
                <a href={whatsappLink(customer.phone, message)} target="_blank" rel="noreferrer">
                  <MessageCircle className="ms-1 h-4 w-4" /> שליחה בוואטסאפ
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`mailto:${customer.email}?subject=${encodeURIComponent(
                    "קופון אישי מאור זרוע לצדיק",
                  )}&body=${encodeURIComponent(message)}`}
                >
                  <Mail className="ms-1 h-4 w-4" /> שליחה במייל
                </a>
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  navigator.clipboard
                    .writeText(message)
                    .then(() => toast.success("ההודעה הועתקה"))
                    .catch(() => toast.error("לא ניתן להעתיק"))
                }
              >
                העתקת ההודעה
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              mut.mutate();
            }}
          >
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border p-0.5" role="radiogroup">
                {(
                  [
                    ["percent", "אחוזים"],
                    ["fixed", "סכום ₪"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={type === v}
                    onClick={() => setType(v)}
                    className={`rounded-md px-3 py-1.5 text-sm ${type === v ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <Input
                aria-label="גובה ההנחה"
                type="number"
                inputMode="decimal"
                min={0}
                step="any"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">
                {type === "percent" ? "%" : "₪"}
              </span>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={freeShipping}
                onCheckedChange={(v) => setFreeShipping(v === true)}
              />
              גם משלוח חינם
            </label>
            <div className="flex items-center gap-2">
              <Label htmlFor="pc-days">בתוקף</Label>
              <Input
                id="pc-days"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={days}
                onChange={(e) => setDays(e.target.value)}
                className="w-20"
              />
              <span className="text-sm text-muted-foreground">ימים</span>
            </div>
            {high && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                <Checkbox
                  checked={confirmHigh}
                  onCheckedChange={(v) => setConfirmHigh(v === true)}
                  className="mt-0.5"
                />
                <span>
                  הנחה גבוהה (מעל{" "}
                  {type === "fixed" ? formatILS(COUPON_FIXED_HIGH) : `${COUPON_PERCENT_HIGH}%`}).
                  אני מאשר/ת.
                </span>
              </label>
            )}
            <Button
              type="submit"
              disabled={
                mut.isPending ||
                !(Number(value) > 0 || freeShipping) ||
                !(Number(days) >= 1) ||
                (high && !confirmHigh)
              }
            >
              {mut.isPending ? "יוצרים…" : "יצירת הקופון"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
