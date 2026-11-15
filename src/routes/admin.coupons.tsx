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
import {
  Copy,
  CopyPlus,
  Download,
  Link2,
  MessageCircle,
  Plus,
  Shuffle,
  TicketPercent,
  Trash2,
  Users,
} from "lucide-react";
import {
  listCoupons,
  listCouponOrders,
  saveCoupon,
  setCouponActive,
  addCouponPayout,
  createPartnerLink,
  deleteCoupon,
  deleteCouponPayout,
  getCouponSettings,
  setCouponsEnabled,
  getWelcomeCouponAdmin,
  setWelcomeCoupon,
  listCouponPayouts,
  removePartnerLink,
  type CouponListItem,
  type CouponOrder,
} from "@/lib/admin-coupons.functions";
import {
  COUPON_FIXED_MAX,
  COUPON_PERCENT_MAX,
  COUPON_STATUS_HE,
  generateCouponCode,
  influencerKitMessage,
  offerText,
  whatsappLink,
  COUPON_FIXED_HIGH,
  COUPON_PERCENT_HIGH,
  couponScopeOf,
  couponScopeText,
  isHighCouponDiscount,
  commissionOwed,
  couponDiscount,
  couponInputErrors,
  describeCoupon,
  normalizeCouponCode,
  visitConversion,
  type CouponInput,
  type CouponStatus,
} from "@/lib/coupons";
import { isWelcomeCode, WELCOME_DAYS_MAX, WELCOME_PERCENT_MAX } from "@/lib/welcome-coupon";
import { toLocalInput, fromLocalInput } from "@/lib/admin-promotions";
import { formatILS } from "@/lib/cart";
import { downloadCsv, toCsv } from "@/lib/csv";
import { BUSINESS } from "@/lib/business";
import { AdminSheet, AdminSheetContent } from "@/components/admin/AdminSheet";
import { CouponScopePicker } from "@/components/admin/CouponScopePicker";
import { Switch } from "@/components/ui/switch";
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
  commission_percent: null,
  scope: "all",
  category_ids: [],
  product_ids: [],
  apply_to_sale_items: true,
  confirm_high: false,
  allowed_email: null,
  influencer_phone: null,
  max_discount: null,
  new_customers_only: false,
});

/** The form for a coupon — to edit it, or (duplicate) as a new one with an empty code. */
function formFromCoupon(c: CouponListItem, duplicate = false): FormState {
  const scope = couponScopeOf(c);
  const f: FormState = {
    code: duplicate ? "" : c.code,
    influencer_name: c.influencer_name ?? "",
    notes: c.notes ?? "",
    discount_type: c.discount_type === "fixed" ? "fixed" : "percent",
    discount_value: Number(c.discount_value),
    free_shipping: c.free_shipping,
    min_order: c.min_order == null ? null : Number(c.min_order),
    starts_at: duplicate ? null : c.starts_at,
    ends_at: c.ends_at,
    max_uses: c.max_uses,
    once_per_customer: c.once_per_customer,
    commission_percent: c.commission_percent == null ? null : Number(c.commission_percent),
    scope,
    category_ids: scope === "categories" ? (c.category_ids ?? []) : [],
    product_ids: scope === "products" ? (c.product_ids ?? []) : [],
    apply_to_sale_items: c.apply_to_sale_items !== false,
    // An existing high discount was confirmed when it was saved.
    confirm_high: isHighCouponDiscount({
      discount_type: c.discount_type === "fixed" ? "fixed" : "percent",
      discount_value: Number(c.discount_value),
    }),
    // A duplicate of a personal coupon is a fresh, open coupon.
    allowed_email: duplicate ? null : (c.allowed_email ?? null),
    influencer_phone: c.influencer_phone ?? null,
    max_discount: c.max_discount == null ? null : Number(c.max_discount),
    new_customers_only: !!c.new_customers_only,
  };
  return duplicate ? f : { ...f, id: c.id };
}

const dateIL = (iso: string) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(iso));

/** The link an influencer shares: any page with ?coupon= applies the code at checkout. */
/** The influencer's private report page. */
const partnerLink = (token: string) => `${BUSINESS.site}/partner/${token}`;

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
  const [payoutsOf, setPayoutsOf] = useState<CouponListItem | null>(null);
  const [linksOf, setLinksOf] = useState<CouponListItem | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "off" | "personal">("all");
  const [sort, setSort] = useState<"new" | "sales" | "code">("new");

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

  // Search (code, name, personal email), a status filter and the order.
  const needle = q.trim().toLowerCase();
  const shown = coupons
    .filter((c) => {
      if (filter === "active" && c.status !== "active") return false;
      if (filter === "off" && c.status === "active") return false;
      if (filter === "personal" && !c.allowed_email) return false;
      if (!needle) return true;
      return [c.code, c.influencer_name, c.allowed_email, c.notes].some((v) =>
        String(v ?? "")
          .toLowerCase()
          .includes(needle),
      );
    })
    .sort((a, b) =>
      sort === "sales"
        ? b.sales - a.sales || b.paid_orders - a.paid_orders
        : sort === "code"
          ? a.code.localeCompare(b.code, "he")
          : b.created_at.localeCompare(a.created_at),
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

      <CouponsSwitch />
      <WelcomeCouponCard />

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
        <>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש לפי קוד, שם או אימייל…"
              aria-label="חיפוש קופון"
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-1" role="group" aria-label="סינון">
              {(
                [
                  ["all", "הכל"],
                  ["active", "פעילים"],
                  ["off", "לא פעילים"],
                  ["personal", "אישיים"],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  aria-pressed={filter === v}
                  onClick={() => setFilter(v)}
                  className={`rounded-full border px-3 py-1 text-xs ${filter === v ? "border-primary bg-primary/10 font-semibold" : "hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              aria-label="מיון"
              className="min-h-9 rounded-md border bg-background px-2 text-xs"
            >
              <option value="new">החדשים קודם</option>
              <option value="sales">המוכרים ביותר</option>
              <option value="code">לפי קוד</option>
            </select>
          </div>
          {shown.length === 0 && (
            <p className="text-sm text-muted-foreground">אין קופונים שמתאימים לחיפוש.</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => (
              <CouponCard
                key={c.id}
                c={c}
                onEdit={() => setEditing(formFromCoupon(c))}
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
                onPayouts={() => setPayoutsOf(c)}
                onLinks={() => setLinksOf(c)}
              />
            ))}
          </div>
        </>
      )}

      {editing && (
        <CouponDialog
          // A fresh dialog for a duplicate, not the edited coupon's state.
          key={editing.id ?? `new-${editing.code}-${editing.influencer_name}`}
          initial={editing}
          existing={editing.id ? coupons.find((x) => x.id === editing.id) : undefined}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["admin-coupons"] });
          }}
          onDuplicate={(c) => setEditing(formFromCoupon(c, true))}
        />
      )}

      <AdminSheet open={!!usersOf} onOpenChange={(v) => !v && setUsersOf(null)}>
        {usersOf && <CouponOrdersSheet c={usersOf} />}
      </AdminSheet>

      {payoutsOf && (
        <PayoutsDialog
          // The list reloads after each change; read the fresh row by id.
          c={coupons.find((x) => x.id === payoutsOf.id) ?? payoutsOf}
          onClose={() => setPayoutsOf(null)}
          onChanged={() => void qc.invalidateQueries({ queryKey: ["admin-coupons"] })}
        />
      )}
      {linksOf && (
        <LinksDialog
          c={coupons.find((x) => x.id === linksOf.id) ?? linksOf}
          onClose={() => setLinksOf(null)}
          onChanged={() => void qc.invalidateQueries({ queryKey: ["admin-coupons"] })}
        />
      )}
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
  if (c.new_customers_only) out.push("ללקוחות חדשים בלבד");
  return out;
}

function CouponCard({
  c,
  onEdit,
  onToggle,
  toggling,
  onUsers,
  onPayouts,
  onLinks,
}: {
  c: CouponListItem;
  onEdit: () => void;
  onToggle: () => void;
  toggling: boolean;
  onUsers: () => void;
  onPayouts: () => void;
  onLinks: () => void;
}) {
  const terms = {
    discountType: c.discount_type === "fixed" ? ("fixed" as const) : ("percent" as const),
    discountValue: Number(c.discount_value),
    freeShipping: c.free_shipping,
    maxDiscount: c.max_discount == null ? null : Number(c.max_discount),
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
          {c.allowed_email && (
            <div className="mt-0.5 text-[11px] text-sky-800">
              {isWelcomeCode(c.code) ? "קופון הצטרפות" : "קופון אישי"} ·{" "}
              <bdi dir="ltr">{c.allowed_email}</bdi>
            </div>
          )}
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[c.status]}`}
        >
          {COUPON_STATUS_HE[c.status]}
        </span>
      </div>

      <div className="mt-2 text-sm font-semibold text-accent">{describeCoupon(terms)}</div>
      <div className="text-xs text-muted-foreground">
        {couponScopeText(
          { scope: couponScopeOf(c), applyToSaleItems: c.apply_to_sale_items !== false },
          { categories: c.category_ids?.length, products: c.product_ids?.length },
        )}
      </div>
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
      {c.visits > 0 && (
        <div className="mt-1.5 text-center text-xs text-muted-foreground">
          {c.visits === 1 ? "כניסה אחת מהקישור" : `${c.visits} כניסות מהקישור`}
          {visitConversion(c.paid_orders, c.visits) != null &&
            ` · ${visitConversion(c.paid_orders, c.visits)}% מהן הזמינו`}
        </div>
      )}
      {c.commission_percent != null && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <div className="flex items-center justify-between">
            <span>עמלה למפורסם ({Number(c.commission_percent)}%)</span>
            <span className="font-bold">{formatILS(c.commission)}</span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-2 text-xs">
            <span>
              שולם {formatILS(c.paid_out)} ·{" "}
              {c.balance > 0 ? (
                <strong>יתרה לתשלום {formatILS(c.balance)}</strong>
              ) : c.balance < 0 ? (
                `שולם מראש ${formatILS(-c.balance)}`
              ) : (
                "הכול שולם"
              )}
            </span>
            <button
              type="button"
              onClick={onPayouts}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              תשלומים
            </button>
          </div>
        </div>
      )}
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
          onClick={onLinks}
          title="קישור לקנייה עם הקוד, ודוח אישי למפורסם"
        >
          <Link2 className="ms-1 h-4 w-4" /> קישורים
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

/**
 * The coupon's report for the person behind it: paid orders only, with the
 * sale, the discount and the commission per order. Deliberately without any
 * customer's name, phone or email (privacy — they bought from the shop, not
 * from the influencer).
 */
function downloadInfluencerReport(c: CouponListItem, orders: CouponOrder[]) {
  const paid = orders.filter((o) => o.payment_status === "paid");
  const pct = c.commission_percent == null ? null : Number(c.commission_percent);
  const header = ["תאריך", "מספר הזמנה", "סכום מכירה (ללא משלוח)", "הנחת קופון"];
  if (pct != null) header.push(`עמלה (${pct}%)`);
  const rows = paid.map((o) => {
    const row: unknown[] = [dateIL(o.created_at), o.order_number, o.subtotal, o.coupon_discount];
    // Exact to the agora per order; the total below is rounded once, like the card.
    if (pct != null) row.push(Math.round(o.subtotal * pct) / 100);
    return row;
  });
  const sales = paid.reduce((s, o) => s + o.subtotal, 0);
  const totalRow: unknown[] = [
    "סה״כ",
    paid.length === 1 ? "הזמנה אחת" : `${paid.length} הזמנות`,
    sales,
    paid.reduce((s, o) => s + o.coupon_discount, 0),
  ];
  if (pct != null) totalRow.push(commissionOwed(sales, pct));
  rows.push(totalRow);
  downloadCsv(toCsv(header, rows), `coupon-${c.code}-${new Date().toISOString().slice(0, 10)}.csv`);
}

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
          {c.commission_percent != null && ` · עמלה ${formatILS(c.commission)}`}
        </p>
      }
      footer={
        <div className="flex flex-wrap items-center gap-2">
          {/* For settling with the influencer: dates, order numbers and
              amounts only — never the customers' names or contact details,
              which are not the influencer's to have. */}
          <Button
            variant="outline"
            disabled={orders.length === 0}
            onClick={() => downloadInfluencerReport(c, orders)}
          >
            <Download className="ms-1 h-4 w-4" /> דוח למפורסם (CSV)
          </Button>
          <Button asChild variant="ghost">
            <Link to="/admin/orders" search={{ q: c.code }}>
              כל ההזמנות עם הקוד
            </Link>
          </Button>
        </div>
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
  existing,
  onClose,
  onSaved,
  onDuplicate,
}: {
  initial: FormState;
  /** The coupon being edited, for duplicate and delete. */
  existing?: CouponListItem;
  onClose: () => void;
  onSaved: () => void;
  onDuplicate: (c: CouponListItem) => void;
}) {
  const save = useServerFn(saveCoupon);
  const remove = useServerFn(deleteCoupon);
  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("הקופון נמחק.");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  // Only a code nobody used can go; one with history is turned off instead.
  const deletable =
    !!existing && existing.paid_orders + existing.unpaid_orders === 0 && existing.paid_out === 0;
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
    maxDiscount: form.discount_type === "percent" ? form.max_discount : null,
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
              <div className="flex gap-1.5">
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
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="קוד אקראי"
                  aria-label="קוד אקראי"
                  onClick={() => set("code", generateCouponCode())}
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              </div>
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
            <div className="sm:col-span-2">
              <Label htmlFor="cp-phone">טלפון של המפורסם (לשליחה בוואטסאפ)</Label>
              <Input
                id="cp-phone"
                dir="ltr"
                type="tel"
                inputMode="tel"
                maxLength={30}
                placeholder="050-0000000"
                value={form.influencer_phone ?? ""}
                onChange={(e) => set("influencer_phone", e.target.value || null)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="cp-commission">עמלה למפורסם (%)</Label>
            <Input
              id="cp-commission"
              type="number"
              inputMode="decimal"
              min={0}
              max={100}
              step="any"
              placeholder="ללא"
              value={form.commission_percent ?? ""}
              onChange={(e) => set("commission_percent", num(e.target.value))}
              className="w-28"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              לא משנה את המחיר ללקוח — רק מחשב כמה מגיע למפורסם מהמכירות עם הקוד.
            </p>
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
            {form.discount_type === "percent" && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Label htmlFor="cp-max-discount" className="shrink-0">
                  הנחה מרבית להזמנה
                </Label>
                <Input
                  id="cp-max-discount"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={COUPON_FIXED_MAX}
                  placeholder="בלי תקרה"
                  value={form.max_discount ?? ""}
                  onChange={(e) => set("max_discount", num(e.target.value))}
                  className="w-28"
                />
                <span className="text-sm text-muted-foreground">₪ (לא חובה)</span>
              </div>
            )}
            {exampleOff > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                לדוגמה: בהזמנה של {formatILS(example)} הלקוח יקבל {formatILS(exampleOff)} הנחה
                {form.free_shipping ? " ומשלוח חינם" : ""}.
              </p>
            )}
            {isHighCouponDiscount(form) && (
              <label className="mt-2 flex cursor-pointer items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                <Checkbox
                  checked={form.confirm_high}
                  onCheckedChange={(v) => set("confirm_high", v === true)}
                  className="mt-0.5"
                />
                <span>
                  זו הנחה גבוהה (מעל{" "}
                  {form.discount_type === "fixed"
                    ? formatILS(COUPON_FIXED_HIGH)
                    : `${COUPON_PERCENT_HIGH}%`}
                  ). אני מאשר/ת שזה הסכום הנכון.
                </span>
              </label>
            )}
          </fieldset>

          <fieldset className="space-y-2">
            <legend className="mb-1.5 text-sm font-medium">על מה הקופון חל</legend>
            <CouponScopePicker
              scope={form.scope}
              categoryIds={form.category_ids}
              productIds={form.product_ids}
              onChange={(n) =>
                setForm((f) => ({
                  ...f,
                  ...(n.scope ? { scope: n.scope } : {}),
                  ...(n.categoryIds ? { category_ids: n.categoryIds } : {}),
                  ...(n.productIds ? { product_ids: n.productIds } : {}),
                }))
              }
            />
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={form.apply_to_sale_items}
                onCheckedChange={(v) => set("apply_to_sale_items", v === true)}
              />
              חל גם על מוצרים שכבר במבצע
            </label>
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
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={!!form.new_customers_only}
                onCheckedChange={(v) => set("new_customers_only", v === true)}
              />
              רק ללקוחות חדשים (בלי הזמנה קודמת ששולמה)
            </label>
            <div>
              <Label htmlFor="cp-allowed">קופון אישי — רק לאימייל הזה</Label>
              <Input
                id="cp-allowed"
                dir="ltr"
                type="email"
                placeholder="ריק = לכל לקוח"
                value={form.allowed_email ?? ""}
                onChange={(e) => set("allowed_email", e.target.value || null)}
              />
            </div>
          </fieldset>

          <div>
            <Label htmlFor="cp-notes">הערות פנימיות</Label>
            <Textarea
              id="cp-notes"
              rows={2}
              maxLength={1000}
              placeholder="למשל: איך ליצור קשר, מתי משלמים את העמלה"
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

          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            {existing ? (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDuplicate(existing)}
                >
                  <CopyPlus className="ms-1 h-4 w-4" /> שכפול
                </Button>
                {deletable && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    disabled={removeMut.isPending}
                    onClick={() => {
                      if (window.confirm(`למחוק את הקופון ${existing.code}? אי אפשר לבטל.`))
                        removeMut.mutate(existing.id);
                    }}
                  >
                    <Trash2 className="ms-1 h-4 w-4" /> מחיקה
                  </Button>
                )}
              </div>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={onClose}>
                ביטול
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "שומרים…" : isNew ? "יצירת הקופון" : "שמירה"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Today in Israel, "YYYY-MM-DD" — the default date of a payment. */
const todayIL = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

/**
 * "תשלומים": what the influencer has been paid. Owed (commission on paid
 * sales) − paid = balance; each payment can be removed if recorded by mistake.
 */
function PayoutsDialog({
  c,
  onClose,
  onChanged,
}: {
  c: CouponListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const load = useServerFn(listCouponPayouts);
  const add = useServerFn(addCouponPayout);
  const del = useServerFn(deleteCouponPayout);
  const qc = useQueryClient();
  const key = ["admin-coupon-payouts", c.id];
  const { data: payouts = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: () => load({ data: { coupon_id: c.id } }),
  });
  const [amount, setAmount] = useState(c.balance > 0 ? String(c.balance) : "");
  const [date, setDate] = useState(todayIL());
  const [note, setNote] = useState("");
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: key });
    onChanged();
  };
  const addMut = useMutation({
    mutationFn: () =>
      add({
        data: { coupon_id: c.id, amount: Number(amount), paid_at: date, note: note.trim() || null },
      }),
    onSuccess: () => {
      toast.success("התשלום נרשם.");
      setAmount("");
      setNote("");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("התשלום נמחק.");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const valid = Number.isFinite(Number(amount)) && Number(amount) > 0 && !!date;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            תשלומי עמלה — {c.influencer_name || <bdi dir="ltr">{c.code}</bdi>}
          </DialogTitle>
          <DialogDescription>
            העמלה מחושבת מהמכירות ששולמו עם הקוד ({Number(c.commission_percent ?? 0)}% מסכום
            המוצרים, בלי משלוח). כאן רושמים מה כבר הועבר למפורסם.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-2 rounded-lg bg-muted/40 p-2 text-center text-sm">
          <div>
            <div className="font-bold">{formatILS(c.commission)}</div>
            <div className="text-[11px] text-muted-foreground">מגיע</div>
          </div>
          <div>
            <div className="font-bold">{formatILS(c.paid_out)}</div>
            <div className="text-[11px] text-muted-foreground">שולם</div>
          </div>
          <div>
            <div className={`font-bold ${c.balance > 0 ? "text-amber-800" : ""}`}>
              {formatILS(c.balance)}
            </div>
            <div className="text-[11px] text-muted-foreground">יתרה</div>
          </div>
        </div>

        <form
          className="space-y-2 rounded-lg border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) addMut.mutate();
          }}
        >
          <div className="text-sm font-medium">רישום תשלום</div>
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="סכום ששולם"
              type="number"
              inputMode="decimal"
              min={0}
              step="any"
              placeholder="סכום ₪"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28"
            />
            <Input
              aria-label="תאריך התשלום"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-40"
            />
          </div>
          <Input
            aria-label="הערה"
            maxLength={500}
            placeholder="הערה (למשל: העברה בנקאית)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!valid || addMut.isPending}>
            {addMut.isPending ? "רושמים…" : "רישום התשלום"}
          </Button>
        </form>

        <div>
          <div className="mb-1 text-sm font-medium">היסטוריה</div>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">טוען…</p>
          ) : payouts.length === 0 ? (
            <p className="text-sm text-muted-foreground">עוד לא נרשמו תשלומים.</p>
          ) : (
            <ul className="divide-y text-sm">
              {payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <span className="font-semibold">{formatILS(p.amount)}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {new Intl.DateTimeFormat("he-IL").format(new Date(`${p.paid_at}T12:00:00`))}
                    </span>
                    {p.note && (
                      <div className="truncate text-xs text-muted-foreground">{p.note}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`למחוק את התשלום של ${formatILS(p.amount)}?`))
                        delMut.mutate(p.id);
                    }}
                    disabled={delMut.isPending}
                    aria-label={`מחיקת התשלום של ${formatILS(p.amount)}`}
                    className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "קישורים": the shopping link that applies the code, and the influencer's own
 * report — a private page with their numbers and no customer details.
 */
function LinksDialog({
  c,
  onClose,
  onChanged,
}: {
  c: CouponListItem;
  onClose: () => void;
  onChanged: () => void;
}) {
  const create = useServerFn(createPartnerLink);
  const remove = useServerFn(removePartnerLink);
  const createMut = useMutation({
    mutationFn: () => create({ data: { coupon_id: c.id } }),
    onSuccess: ({ token }) => {
      void copy(partnerLink(token), "הקישור לדוח נוצר והועתק");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const removeMut = useMutation({
    mutationFn: () => remove({ data: { coupon_id: c.id } }),
    onSuccess: () => {
      toast.success("הקישור לדוח בוטל.");
      onChanged();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const shop = couponLink(c.code);
  const report = c.partner_token ? partnerLink(c.partner_token) : null;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            קישורים לקוד <bdi dir="ltr">{c.code}</bdi>
          </DialogTitle>
        </DialogHeader>

        <section className="space-y-1.5">
          <div className="text-sm font-medium">קישור לקנייה</div>
          <p className="text-xs text-muted-foreground">
            למפורסם לשתף: מי שנכנס דרכו רואה הודעה שהקוד יוחל, והקוד מוחל בקופה בעצמו.
          </p>
          <div className="flex gap-2">
            <Input readOnly dir="ltr" value={shop} onFocus={(e) => e.currentTarget.select()} />
            <Button type="button" variant="outline" onClick={() => copy(shop, "הקישור הועתק")}>
              העתקה
            </Button>
          </div>
        </section>

        <section className="space-y-1.5 border-t pt-3">
          <div className="text-sm font-medium">דוח אישי למפורסם</div>
          <p className="text-xs text-muted-foreground">
            עמוד פרטי שבו המפורסם רואה את הנתונים שלו: הזמנות, מכירות, עמלה ותשלומים — בלי שום פרט
            על הלקוחות. כל מי שמחזיק בקישור יכול לפתוח אותו, אז שולחים רק למפורסם.
          </p>
          {report ? (
            <>
              <div className="flex gap-2">
                <Input
                  readOnly
                  dir="ltr"
                  value={report}
                  onFocus={(e) => e.currentTarget.select()}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => copy(report, "הקישור לדוח הועתק")}
                >
                  העתקה
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={createMut.isPending}
                  onClick={() => {
                    if (window.confirm("ליצור קישור חדש? הקישור הקודם יפסיק לעבוד."))
                      createMut.mutate();
                  }}
                >
                  החלפת הקישור
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="text-destructive"
                  disabled={removeMut.isPending}
                  onClick={() => {
                    if (window.confirm("לבטל את הקישור לדוח?")) removeMut.mutate();
                  }}
                >
                  ביטול הקישור
                </Button>
              </div>
            </>
          ) : (
            <Button type="button" disabled={createMut.isPending} onClick={() => createMut.mutate()}>
              {createMut.isPending ? "יוצרים…" : "יצירת קישור לדוח"}
            </Button>
          )}
        </section>

        <section className="space-y-1.5 border-t pt-3">
          <div className="text-sm font-medium">ערכה למפורסם בוואטסאפ</div>
          <p className="text-xs text-muted-foreground">
            הודעה אחת עם הקוד, מה הוא נותן, קישור הקנייה
            {report ? " והקישור לדוח" : ""}.
            {c.influencer_phone ? "" : " אין טלפון בקופון — וואטסאפ יבקש לבחור איש קשר."}
          </p>
          <Button asChild className="bg-emerald-700 text-white hover:bg-emerald-800">
            <a
              href={whatsappLink(
                c.influencer_phone,
                influencerKitMessage({
                  name: c.influencer_name,
                  code: c.code,
                  offer: offerText({
                    discountType: c.discount_type === "fixed" ? "fixed" : "percent",
                    discountValue: Number(c.discount_value),
                    freeShipping: c.free_shipping,
                    scope: couponScopeOf(c),
                    applyToSaleItems: c.apply_to_sale_items !== false,
                  }),
                  shopLink: shop,
                  reportLink: report,
                }),
              )}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle className="ms-1 h-4 w-4" /> שליחה בוואטסאפ
            </a>
          </Button>
        </section>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "קופונים באתר": one switch for every coupon on the site. Off = the checkout
 * box disappears and codes are refused (a link's code too); each coupon keeps
 * its own settings and comes back as it was when the switch is turned on.
 */
function CouponsSwitch() {
  const qc = useQueryClient();
  const load = useServerFn(getCouponSettings);
  const save = useServerFn(setCouponsEnabled);
  const { data } = useQuery({ queryKey: ["admin-coupon-settings"], queryFn: () => load() });
  const mut = useMutation({
    mutationFn: (enabled: boolean) => save({ data: { enabled } }),
    onSuccess: ({ enabled }) => {
      toast.success(enabled ? "הקופונים הופעלו באתר." : "כל הקופונים הושבתו באתר.");
      void qc.invalidateQueries({ queryKey: ["admin-coupon-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return null;
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm ${
        data.enabled ? "bg-card" : "border-destructive/40 bg-destructive/5"
      }`}
    >
      <div>
        <div className="font-semibold">קופונים באתר: {data.enabled ? "פעילים" : "מושבתים"}</div>
        <div className="text-xs text-muted-foreground">
          {data.enabled
            ? "שדה הקופון מופיע בקופה כשיש לפחות קופון פעיל אחד."
            : "שדה הקופון מוסתר והקודים לא מתקבלים — גם מקישורים. ההגדרות של כל קופון נשמרות."}
        </div>
      </div>
      <Switch
        checked={data.enabled}
        disabled={mut.isPending}
        onCheckedChange={(v) => {
          if (!v && !window.confirm("להשבית את כל הקופונים באתר?")) return;
          mut.mutate(v);
        }}
        aria-label="קופונים באתר"
      />
    </div>
  );
}

/**
 * "קופון הצטרפות לניוזלטר": each new subscriber gets a personal, single-use
 * code by email (welcome-coupon.ts). Off until the owner turns it on; the
 * signup forms on the site promise it only while it is on.
 */
function WelcomeCouponCard() {
  const qc = useQueryClient();
  const load = useServerFn(getWelcomeCouponAdmin);
  const save = useServerFn(setWelcomeCoupon);
  const { data } = useQuery({ queryKey: ["admin-welcome-coupon"], queryFn: () => load() });
  const [percent, setPercent] = useState<string | null>(null);
  const [days, setDays] = useState<string | null>(null);
  const mut = useMutation({
    mutationFn: (v: { enabled: boolean; percent: number; days: number }) => save({ data: v }),
    onSuccess: (v) => {
      toast.success(
        v.enabled
          ? `קופון ההצטרפות פעיל: ${v.percent}% הנחה, בתוקף ${v.days} ימים.`
          : "קופון ההצטרפות כובה.",
      );
      setPercent(null);
      setDays(null);
      void qc.invalidateQueries({ queryKey: ["admin-welcome-coupon"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  if (!data) return null;
  const p = percent ?? String(data.percent);
  const d = days ?? String(data.days);
  const dirty = percent !== null || days !== null;
  const submit = (enabled: boolean) =>
    mut.mutate({ enabled, percent: Number(p), days: Math.round(Number(d)) });
  return (
    <div className="space-y-2 rounded-lg border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-semibold">
            קופון הצטרפות לניוזלטר: {data.enabled ? `פעיל, ${data.percent}%` : "כבוי"}
          </div>
          <div className="text-xs text-muted-foreground">
            מי שנרשם לרשימת התפוצה מקבל במייל קוד אישי לשימוש אחד, שלא חל על מוצרים במבצע.
            {data.issued > 0 && ` נשלחו ${data.issued} קודים, נוצלו ${data.redeemed}.`}
          </div>
        </div>
        <Switch
          checked={data.enabled}
          disabled={mut.isPending}
          onCheckedChange={(v) => submit(v)}
          aria-label="קופון הצטרפות לניוזלטר"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="welcome-percent">הנחה</Label>
        <Input
          id="welcome-percent"
          type="number"
          inputMode="numeric"
          min={1}
          max={WELCOME_PERCENT_MAX}
          value={p}
          onChange={(e) => setPercent(e.target.value)}
          className="w-20"
        />
        <span className="text-muted-foreground">%</span>
        <Label htmlFor="welcome-days" className="ms-2">
          תוקף
        </Label>
        <Input
          id="welcome-days"
          type="number"
          inputMode="numeric"
          min={1}
          max={WELCOME_DAYS_MAX}
          value={d}
          onChange={(e) => setDays(e.target.value)}
          className="w-20"
        />
        <span className="text-muted-foreground">ימים</span>
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            disabled={mut.isPending}
            onClick={() => submit(data.enabled)}
          >
            שמירה
          </Button>
        )}
      </div>
    </div>
  );
}
