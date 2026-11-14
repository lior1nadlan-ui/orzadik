// CRM → קופונים. Codes a shopper types at checkout — typically one per
// influencer ("קופון למפורסמים") — and, per code, who bought with it.
//
// The owner flow: "קופון חדש" → code, whose it is, the discount (percent or
// shekels, optionally free shipping), optional conditions (minimum, dates,
// number of uses, once per customer) → save. Each card shows the code's paid
// orders, sales and the discount it gave; "מי השתמש" lists the orders with the
// customers' details. Rules: src/lib/coupons.ts; table:
// supabase/migrations/20261114120000_coupons.sql.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Link2, Plus, TicketPercent, Users } from "lucide-react";
import {
  listCoupons,
  listCouponOrders,
  saveCoupon,
  setCouponActive,
  type CouponListItem,
} from "@/lib/admin-coupons.functions";
import {
  COUPON_FIXED_MAX,
  COUPON_PERCENT_MAX,
  COUPON_STATUS_HE,
  couponDiscount,
  couponInputErrors,
  describeCoupon,
  normalizeCouponCode,
  type CouponInput,
  type CouponStatus,
} from "@/lib/coupons";
import { toLocalInput, fromLocalInput } from "@/lib/admin-promotions";
import { formatILS } from "@/lib/cart";
import { BUSINESS } from "@/lib/business";
import { AdminSheet, AdminSheetContent } from "@/components/admin/AdminSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/coupons")({ component: AdminCoupons });

const STATUS_CLS: Record<CouponStatus, string> = {
  active: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-amber-100 text-amber-900",
  expired: "bg-muted text-muted-foreground",
  used_up: "bg-muted text-muted-foreground",
  disabled: "bg-destructive/10 text-destructive",
};

type FormState = CouponInput & { id?: string };

const emptyForm = (): FormState => ({
  code: "",
  influencer_name: "",
  notes: "",
  discount_type: "percent",
  discount_value: 10,
  free_shipping: false,
  min_order: null,
  starts_at: null,
  ends_at: null,
  max_uses: null,
  once_per_customer: false,
});

const dateIL = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(iso));

/** The link an influencer shares: any page with ?coupon= applies the code at checkout. */
const couponLink = (code: string) => `${BUSINESS.site}/?coupon=${encodeURIComponent(code)}`;

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("לא ניתן להעתיק — סמנו והעתיקו ידנית.");
  }
}

function AdminCoupons() {
  const qc = useQueryClient();
  const load = useServerFn(listCoupons);
  const toggle = useServerFn(setCouponActive);

  const { data: coupons = [], isLoading } = useQuery({
    queryKey: ["admin-coupons"],
    queryFn: () => load(),
  });
  const [editing, setEditing] = useState<FormState | null>(null);
  const [usersOf, setUsersOf] = useState<CouponListItem | null>(null);

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => toggle({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.active ? "הקופון הופעל." : "הקופון כובה — הוא מפסיק לעבוד באתר מיד.");
      void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totals = coupons.reduce(
    (t, c) => ({ orders: t.orders + c.paid_orders, sales: t.sales + c.sales }),
    { orders: 0, sales: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">קופונים</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            קוד הנחה שהלקוח מקליד בקופה — למשל קוד אישי לכל מפורסם. כל הזמנה עם קוד נרשמת כאן, כך
            שרואים מי קנה דרך מי.
          </p>
        </div>
        <Button onClick={() => setEditing(emptyForm())}>
          <Plus className="ms-1 h-4 w-4" /> קופון חדש
        </Button>
      </div>

      {totals.orders > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <TicketPercent className="me-1 inline h-4 w-4" />
          {totals.orders === 1 ? "הזמנה אחת ששולמה" : `${totals.orders} הזמנות ששולמו`} עם קופונים ·
          מכירות {formatILS(totals.sales)}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען…</p>
      ) : coupons.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          עוד לא נוצרו קופונים. לחצו על "קופון חדש" כדי ליצור קוד ראשון.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {coupons.map((c) => (
            <CouponCard
              key={c.id}
              c={c}
              onEdit={() =>
                setEditing({
                  id: c.id,
                  code: c.code,
                  influencer_name: c.influencer_name ?? "",
                  notes: c.notes ?? "",
                  discount_type: c.discount_type === "fixed" ? "fixed" : "percent",
                  discount_value: Number(c.discount_value),
                  free_shipping: c.free_shipping,
                  min_order: c.min_order == null ? null : Number(c.min_order),
                  starts_at: c.starts_at,
                  ends_at: c.ends_at,
                  max_uses: c.max_uses,
                  once_per_customer: c.once_per_customer,
                })
              }
              onToggle={() => {
                if (
                  c.is_active &&
                  !window.confirm(`לכבות את הקופון ${c.code}? הוא יפסיק לעבוד באתר מיד.`)
                )
                  return;
                toggleMut.mutate({ id: c.id, active: !c.is_active });
              }}
              toggling={toggleMut.isPending && toggleMut.variables?.id === c.id}
              onUsers={() => setUsersOf(c)}
            />
          ))}
        </div>
      )}

      {editing && (
        <CouponDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
          }}
        />
      )}

      <AdminSheet open={!!usersOf} onOpenChange={(v) => !v && setUsersOf(null)}>
        {usersOf && <CouponOrdersSheet c={usersOf} />}
      </AdminSheet>
    </div>
  );
}

function conditions(c: CouponListItem): string[] {
  const out: string[] = [];
  if (c.min_order != null) out.push(`בקנייה מ-${formatILS(Number(c.min_order))}`);
  if (c.ends_at) out.push(`עד ${dateIL(c.ends_at)}`);
  if (new Date(c.starts_at).getTime() > Date.now()) out.push(`מ-${dateIL(c.starts_at)}`);
  if (c.max_uses != null) out.push(`עד ${c.max_uses} שימושים`);
  if (c.once_per_customer) out.push("פעם אחת לכל לקוח");
  return out;
}

function CouponCard({
  c,
  onEdit,
  onToggle,
  toggling,
  onUsers,
}: {
  c: CouponListItem;
  onEdit: () => void;
  onToggle: () => void;
  toggling: boolean;
  onUsers: () => void;
}) {
  const terms = {
    discountType: c.discount_type === "fixed" ? ("fixed" as const) : ("percent" as const),
    discountValue: Number(c.discount_value),
    freeShipping: c.free_shipping,
  };
  const conds = conditions(c);
  return (
    <div className="flex flex-col rounded-xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => copy(c.code, `הקוד ${c.code} הועתק`)}
            title="העתקת הקוד"
            className={`flex items-center gap-1.5 text-xl font-bold ${/^[A-Z0-9_-]+$/.test(c.code) ? "font-mono tracking-wide" : ""}`}
            dir="ltr"
          >
            {c.code}
            <Copy className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
          </button>
          {c.influencer_name && (
            <div className="mt-0.5 text-sm font-medium">{c.influencer_name}</div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[c.status]}`}
        >
          {COUPON_STATUS_HE[c.status]}
        </span>
      </div>

      <div className="mt-2 text-sm font-semibold text-accent">{describeCoupon(terms)}</div>
      {conds.length > 0 && (
        <div className="mt-0.5 text-xs text-muted-foreground">{conds.join(" · ")}</div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center">
        <div>
          <div className="text-base font-bold">{c.paid_orders}</div>
          <div className="text-[11px] text-muted-foreground">הזמנות ששולמו</div>
        </div>
        <div>
          <div className="text-base font-bold">{formatILS(c.sales)}</div>
          <div className="text-[11px] text-muted-foreground">מכירות</div>
        </div>
        <div>
          <div className="text-base font-bold">{formatILS(c.discount)}</div>
          <div className="text-[11px] text-muted-foreground">הנחה שניתנה</div>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-muted-foreground">
        {c.customers === 0
          ? "עוד לא השתמשו בקוד"
          : c.customers === 1
            ? "לקוח אחד"
            : `${c.customers} לקוחות`}
        {c.unpaid_orders === 1 && " · הזמנה אחת שטרם שולמה"}
        {c.unpaid_orders > 1 && ` · ${c.unpaid_orders} הזמנות שטרם שולמו`}
        {c.last_order_at && ` · שימוש אחרון ${dateIL(c.last_order_at)}`}
      </div>
      {c.notes && (
        <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{c.notes}</p>
      )}

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        <Button
          size="sm"
          variant="outline"
          onClick={onUsers}
          disabled={c.paid_orders + c.unpaid_orders === 0}
        >
          <Users className="ms-1 h-4 w-4" /> מי השתמש
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          עריכה
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            copy(couponLink(c.code), "הקישור הועתק — מי שנכנס דרכו מקבל את הקוד בקופה")
          }
          title="קישור לאתר שמחיל את הקוד בקופה"
        >
          <Link2 className="ms-1 h-4 w-4" /> קישור
        </Button>
        <Button
          size="sm"
          variant={c.is_active ? "ghost" : "default"}
          onClick={onToggle}
          disabled={toggling}
          className={c.is_active ? "text-destructive" : undefined}
        >
          {c.is_active ? "כיבוי" : "הפעלה"}
        </Button>
      </div>
    </div>
  );
}

const PAYMENT_HE: Record<string, string> = {
  paid: "שולם",
  unpaid: "לא שולם",
  failed: "התשלום נכשל",
  refunded: "זוכה",
};

function CouponOrdersSheet({ c }: { c: CouponListItem }) {
  const load = useServerFn(listCouponOrders);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["admin-coupon-orders", c.id],
    queryFn: () => load({ data: { id: c.id } }),
  });
  return (
    <AdminSheetContent
      title={
        <>
          מי השתמש בקופון <bdi className="font-mono">{c.code}</bdi>
        </>
      }
      headerExtra={
        <p className="text-xs text-muted-foreground">
          {c.influencer_name ? `${c.influencer_name} · ` : ""}
          {c.paid_orders} הזמנות ששולמו · מכירות {formatILS(c.sales)} · הנחה {formatILS(c.discount)}
        </p>
      }
    >
      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען…</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-muted-foreground">אין עדיין הזמנות עם הקוד הזה.</p>
      ) : (
        <ul className="divide-y">
          {orders.map((o) => (
            <li key={o.id} className="py-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link
                    to="/admin/customers"
                    search={{ q: o.customer_email }}
                    className="font-semibold underline-offset-2 hover:underline"
                  >
                    {o.customer_name}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    <bdi dir="ltr">{o.customer_phone}</bdi> ·{" "}
                    <bdi dir="ltr">{o.customer_email}</bdi>
                  </div>
                </div>
                <div className="shrink-0 text-end">
                  <div className="font-bold">{formatILS(o.total)}</div>
                  <div className="text-xs text-muted-foreground">
                    הנחה {formatILS(o.coupon_discount)}
                  </div>
                </div>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <Link
                  to="/admin/orders"
                  search={{ q: o.order_number, open: "1" }}
                  className="font-mono text-accent underline underline-offset-2"
                >
                  {o.order_number}
                </Link>
                <span>{dateIL(o.created_at)}</span>
                <span
                  className={
                    o.payment_status === "paid" ? "font-medium text-emerald-700" : "text-amber-700"
                  }
                >
                  {PAYMENT_HE[o.payment_status] ?? o.payment_status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminSheetContent>
  );
}

function CouponDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: FormState;
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(saveCoupon);
  const [form, setForm] = useState<FormState>(initial);
  const set = <K extends keyof FormState>(k: K, v: FormState[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const isNew = !form.id;
  const errors = couponInputErrors(form);
  const [showErrors, setShowErrors] = useState(false);

  const mut = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...form,
          code: normalizeCouponCode(form.code),
          influencer_name: form.influencer_name?.trim() || null,
          notes: form.notes?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(isNew ? "הקופון נוצר ופעיל באתר." : "הקופון עודכן.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const num = (v: string): number | null => (v.trim() === "" ? null : Number(v));
  // A worked example, so the owner sees what the shopper will get.
  const example = 300;
  const exampleOff = couponDiscount(example, {
    discountType: form.discount_type,
    discountValue: Number(form.discount_value) || 0,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "קופון חדש" : `עריכת הקופון ${initial.code}`}</DialogTitle>
          <DialogDescription>
            הלקוח מקליד את הקוד בעמוד התשלום. ההנחה יורדת מסכום המוצרים (אחרי מבצעים והטבת מועדון),
            לא מהמשלוח.
          </DialogDescription>
        </DialogHeader>

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (errors.length) {
              setShowErrors(true);
              return;
            }
            mut.mutate();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="cp-code">קוד הקופון</Label>
              <Input
                id="cp-code"
                dir="ltr"
                autoComplete="off"
                spellCheck={false}
                maxLength={30}
                placeholder="DANA10"
                value={form.code}
                onChange={(e) => set("code", e.target.value)}
                onBlur={(e) => set("code", normalizeCouponCode(e.target.value))}
                className="font-mono"
              />
            </div>
            <div>
              <Label htmlFor="cp-name">שם המפורסם / למי שייך</Label>
              <Input
                id="cp-name"
                maxLength={120}
                placeholder="למשל דנה כהן"
                value={form.influencer_name ?? ""}
                onChange={(e) => set("influencer_name", e.target.value)}
              />
            </div>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">ההנחה</legend>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border p-0.5" role="radiogroup">
                {(
                  [
                    ["percent", "אחוזים"],
                    ["fixed", "סכום קבוע ₪"],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={form.discount_type === v}
                    onClick={() => set("discount_type", v)}
                    className={`rounded-md px-3 py-1.5 text-sm ${
                      form.discount_type === v ? "bg-primary text-primary-foreground" : ""
                    }`}
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
                max={form.discount_type === "percent" ? COUPON_PERCENT_MAX : COUPON_FIXED_MAX}
                step="any"
                value={Number.isFinite(form.discount_value) ? form.discount_value : ""}
                onChange={(e) => set("discount_value", Number(e.target.value))}
                className="w-28"
              />
              <span className="text-sm text-muted-foreground">
                {form.discount_type === "percent" ? "%" : "₪"}
              </span>
            </div>
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.free_shipping}
                onCheckedChange={(v) => set("free_shipping", v === true)}
              />
              גם משלוח חינם
            </label>
            {exampleOff > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                לדוגמה: בהזמנה של {formatILS(example)} הלקוח יקבל {formatILS(exampleOff)} הנחה
                {form.free_shipping ? " ומשלוח חינם" : ""}.
              </p>
            )}
          </fieldset>

          <fieldset className="space-y-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">תנאים (לא חובה)</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="cp-min">מינימום הזמנה ₪</Label>
                <Input
                  id="cp-min"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  placeholder="ללא"
                  value={form.min_order ?? ""}
                  onChange={(e) => set("min_order", num(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="cp-max">מספר שימושים מרבי</Label>
                <Input
                  id="cp-max"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  placeholder="ללא הגבלה"
                  value={form.max_uses ?? ""}
                  onChange={(e) => set("max_uses", num(e.target.value))}
                />
              </div>
              <div>
                <Label htmlFor="cp-start">בתוקף מ-</Label>
                <Input
                  id="cp-start"
                  type="datetime-local"
                  value={form.starts_at ? toLocalInput(form.starts_at) : ""}
                  onChange={(e) => set("starts_at", fromLocalInput(e.target.value) || null)}
                />
              </div>
              <div>
                <Label htmlFor="cp-end">בתוקף עד</Label>
                <Input
                  id="cp-end"
                  type="datetime-local"
                  value={form.ends_at ? toLocalInput(form.ends_at) : ""}
                  onChange={(e) => set("ends_at", fromLocalInput(e.target.value) || null)}
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.once_per_customer}
                onCheckedChange={(v) => set("once_per_customer", v === true)}
              />
              פעם אחת לכל לקוח (לפי אימייל או טלפון)
            </label>
          </fieldset>

          <div>
            <Label htmlFor="cp-notes">הערות פנימיות</Label>
            <Textarea
              id="cp-notes"
              rows={2}
              maxLength={1000}
              placeholder="למשל: עמלה של 10% על כל מכירה"
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
            />
          </div>

          {showErrors && errors.length > 0 && (
            <ul
              role="alert"
              className="space-y-1 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              ביטול
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "שומרים…" : isNew ? "יצירת הקופון" : "שמירה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
