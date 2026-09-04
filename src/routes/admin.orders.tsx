import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatILS } from "@/lib/cart";
import { refundCardcomOrder } from "@/lib/cardcom.functions";
import {
  listOrdersPaged,
  exportOrdersCsv,
  markOrderShipped,
  listCustomerNotes,
  addCustomerNote,
  updateOrderStatus,
  markOrderPreparing,
  resendOrderConfirmation,
  resendOrderTelegramAlert,
} from "@/lib/admin-crm.functions";
import { waThankYou, waShipped, waFollowUpUnpaid } from "@/lib/wa-templates";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Phone, Mail, MessageCircle, User, RefreshCw } from "lucide-react";
import { orderItemImageUrl } from "@/lib/order-item-photo";

export const Route = createFileRoute("/admin/orders")({
  // Deep-linkable filters: the dashboard KPIs/chips and the customer card link
  // here with concrete filter states.
  validateSearch: (
    s: Record<string, unknown>,
  ): { q?: string; status?: string; payment?: string; days?: number } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    status: typeof s.status === "string" ? s.status : undefined,
    payment: typeof s.payment === "string" ? s.payment : undefined,
    days:
      typeof s.days === "number"
        ? s.days
        : typeof s.days === "string" && s.days !== ""
          ? Number(s.days)
          : undefined,
  }),
  component: AdminOrders,
});

const STATUSES = ["pending", "processing", "shipped", "completed", "cancelled", "refunded"];
const STATUS_HE: Record<string, string> = {
  pending: "ממתינה",
  processing: "בטיפול",
  shipped: "נשלחה",
  completed: "הושלמה",
  cancelled: "בוטלה",
  refunded: "זוכתה",
};
// `failed` and `pending_charge` are both statuses the CardCom webhook can write.
// Without them here they rendered as raw English tokens, and with no matching filter
// option the owner could not even LIST a blocked order — so a charge that was taken
// and refused would sit unnoticed. A block nobody can see is a block nobody fixes.
const PAYMENT_HE: Record<string, string> = {
  paid: "שולם",
  unpaid: "לא שולם",
  refunded: "זוכה",
  failed: "נכשל",
  pending_charge: "ממתין לחיוב",
};

/** Israeli local number -> wa.me international format. Also used by the
 * abandoned-carts screen (admin.abandoned.tsx). */
export function waLink(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

/** Pick a context-appropriate pre-filled WhatsApp message for an order, so the
 * per-order action opens a ready-to-send Hebrew draft instead of an empty chat:
 * unpaid -> gentle follow-up, shipped/completed -> shipped-with-tracking,
 * otherwise (a fresh paid order) -> a warm thank-you. The template helpers read
 * the order's snake_case fields (name/phone/order_number/tracking) directly and
 * return null when there is no usable phone, in which case we fall back to the
 * bare wa.me link so the anchor keeps its existing behavior. */
function waForOrder(o: any): string {
  // A cancelled/refunded order must NOT get a "thank you, preparing it" draft —
  // open an empty chat so the owner writes the right message himself.
  if (["cancelled", "refunded"].includes(o?.status) || o?.payment_status === "refunded") {
    return waLink(o?.customer_phone);
  }
  const templated =
    o?.payment_status === "unpaid"
      ? waFollowUpUnpaid(o)
      : o?.status === "shipped" || o?.status === "completed" || o?.shipped_at
        ? waShipped(o)
        : waThankYou(o);
  return templated ?? waLink(o?.customer_phone);
}

function PaymentBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "refunded"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${cls}`}>
      {PAYMENT_HE[status] ?? status}
    </span>
  );
}

function AdminOrders() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [refunding, setRefunding] = useState(false);
  const refundOrder = useServerFn(refundCardcomOrder);
  const listOrders = useServerFn(listOrdersPaged);
  const exportCsv = useServerFn(exportOrdersCsv);
  const shipOrder = useServerFn(markOrderShipped);
  const setOrderStatus = useServerFn(updateOrderStatus);
  const setPreparingFn = useServerFn(markOrderPreparing);
  const resendConfirmation = useServerFn(resendOrderConfirmation);
  const resendTelegram = useServerFn(resendOrderTelegramAlert);
  const custNotesFn = useServerFn(listCustomerNotes);
  const addNoteFn = useServerFn(addCustomerNote);

  // Filters — seeded from the URL so deep links land on a real filter state.
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(search.q ?? "");
  const [status, setStatus] = useState(search.status ?? "");
  const [payment, setPayment] = useState(search.payment ?? "");
  const [days, setDays] = useState(search.days ?? 0);
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debouncedQ, status, payment, days]);

  // Shipping form state (inside details dialog)
  const [tracking, setTracking] = useState("");
  const [carrier, setCarrier] = useState("");
  const [shipping, setShipping] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [resending, setResending] = useState(false);
  // Which Telegram alert is currently being (re)sent, if any — "created" or
  // "paid" — so the two resend buttons can show independent loading states.
  const [resendingTelegram, setResendingTelegram] = useState<"created" | "paid" | null>(null);
  const [noteText, setNoteText] = useState("");
  useEffect(() => {
    setTracking(selected?.tracking_number ?? "");
    setCarrier(selected?.shipping_carrier ?? "");
    setNoteText("");
  }, [selected?.id]);

  // CRM notes inside the details dialog — the owner sees customer history
  // ("ביקש חריטה מיוחדת") without leaving the order.
  const { data: custNotes } = useQuery({
    queryKey: ["order-cust-notes", selected?.customer_email],
    enabled: !!selected?.customer_email,
    queryFn: () => custNotesFn({ data: { email: selected!.customer_email } }),
  });
  const noteMutation = useMutation({
    mutationFn: (note: string) => addNoteFn({ data: { email: selected.customer_email, note } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["order-cust-notes", selected?.customer_email] });
      // The customer card (admin.customers.tsx) caches notes under this key.
      qc.invalidateQueries({ queryKey: ["admin-customer"] });
      setNoteText("");
      toast.success("ההערה נשמרה");
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בשמירת ההערה"),
  });
  const submitNote = () => {
    const note = noteText.trim();
    if (note && !noteMutation.isPending) noteMutation.mutate(note);
  };

  const filters = {
    q: debouncedQ || undefined,
    status: status || undefined,
    payment: payment || undefined,
    days: days || undefined,
    page,
  };

  // The owner keeps this screen open while packing parcels, but the app-wide
  // refetchOnWindowFocus is false (src/router.tsx) and this query had no
  // refetchInterval — so the list was fetched once at mount and then never
  // again, and a new order stayed invisible until a hard reload (which also
  // wipes the filters). A paged 25-row read is cheap enough to poll. Polling
  // pauses while the details dialog is open so a background re-render can't
  // disturb a native <select> mid-interaction.
  const { data, isFetching, isPlaceholderData, refetch, dataUpdatedAt } = useQuery({
    queryKey: ["admin-orders", filters],
    placeholderData: keepPreviousData,
    queryFn: () => listOrders({ data: filters }),
    refetchInterval: selected ? false : 60_000,
    refetchOnWindowFocus: true,
  });
  const orders = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-orders"] });

  const updateStatus = async (o: any, st: string) => {
    // A terminal transition — cancelled/refunded — restores reserved stock and
    // flips payment semantics server-side, so a single mis-tap on the inline
    // select must never commit it silently. Gate ONLY those two transitions
    // behind a Hebrew confirm that names the order and target status. Declining
    // returns before the mutation runs; because the <select> is controlled by
    // o.status (server truth), React snaps it back to its current value on its
    // own — no manual revert needed. Non-destructive transitions are unchanged.
    if ((st === "cancelled" || st === "refunded") && st !== o.status) {
      const ok = window.confirm(
        `לשנות את סטטוס הזמנה ${o.order_number} ל"${STATUS_HE[st] ?? st}"? פעולה זו עלולה להחזיר מלאי ולשנות את מצב התשלום.`,
      );
      if (!ok) return;
    }
    // Routed through the server fn (not a direct client update) so that setting a
    // terminal status — cancelled/refunded — restores reserved stock server-side.
    try {
      await setOrderStatus({ data: { order_id: o.id, status: st } });
      toast.success("עודכן");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון הסטטוס");
    }
  };

  const doRefund = async (orderId: string) => {
    if (!window.confirm("לבצע זיכוי מלא להזמנה זו? הפעולה אינה הפיכה.")) return;
    setRefunding(true);
    try {
      const r = await refundOrder({ data: { order_id: orderId } });
      toast.success(
        `הזיכוי בוצע בהצלחה${r.newTransactionId ? ` — עסקת זיכוי מס׳ ${r.newTransactionId}` : ""}`,
      );
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "הזיכוי נכשל");
    } finally {
      setRefunding(false);
    }
  };

  const doShip = async () => {
    setShipping(true);
    try {
      const r = await shipOrder({
        data: {
          order_id: selected.id,
          tracking_number: tracking || undefined,
          carrier: carrier || undefined,
        },
      });
      toast.success(
        r.emailSent ? "סומנה כנשלחה ומייל נשלח ללקוח 📦" : "סומנה כנשלחה (מייל כבר נשלח בעבר)",
      );
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון המשלוח");
    } finally {
      setShipping(false);
    }
  };

  const doPreparing = async () => {
    setPreparing(true);
    try {
      await setPreparingFn({ data: { order_id: selected.id } });
      toast.success("סומנה כבהכנה — הלקוח רואה זאת במעקב ובחשבון");
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון מצב ההכנה");
    } finally {
      setPreparing(false);
    }
  };

  const doResendConfirmation = async () => {
    setResending(true);
    try {
      await resendConfirmation({ data: { order_id: selected.id } });
      toast.success("אישור ההזמנה נשלח שוב ללקוח ✉️");
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שליחת האישור נכשלה");
    } finally {
      setResending(false);
    }
  };

  const doResendTelegram = async (paid: boolean) => {
    setResendingTelegram(paid ? "paid" : "created");
    try {
      await resendTelegram({ data: { order_id: selected.id, paid } });
      toast.success("התראת הטלגרם נשלחה שוב 📲");
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שליחת ההתראה נכשלה");
    } finally {
      setResendingTelegram(null);
    }
  };

  const doExport = async () => {
    try {
      const { csv, count } = await exportCsv({ data: { ...filters, page: 0 } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`יוצאו ${count} הזמנות`);
    } catch (e: any) {
      toast.error(e?.message ?? "הייצוא נכשל");
    }
  };

  const isNew = (o: any) => Date.now() - new Date(o.created_at).getTime() < 24 * 60 * 60 * 1000;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="font-display text-2xl font-bold">הזמנות ({total})</h1>
          {/* Absolute clock time, not "לפני X" — no ticker interval, and it can
              never go stale on screen. dataUpdatedAt is 0 until the first fetch
              resolves, which would otherwise render the Unix epoch (02:00). */}
          <span className="text-xs text-muted-foreground">
            {dataUpdatedAt
              ? `עודכן ב-${new Date(dataUpdatedAt).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}`
              : "טוען..."}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ml-1 ${isFetching ? "animate-spin" : ""}`} />
            {isFetching ? "מרענן..." : "רענון"}
          </Button>
          <Button size="sm" variant="outline" onClick={doExport}>
            <Download className="h-4 w-4 ml-1" /> ייצוא CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="חיפוש: מס׳ הזמנה / שם / טלפון / אימייל"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">כל הסטטוסים</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_HE[s]}
            </option>
          ))}
        </select>
        <select
          value={payment}
          onChange={(e) => setPayment(e.target.value)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="">כל התשלומים</option>
          <option value="paid">שולם</option>
          <option value="unpaid">לא שולם</option>
          <option value="refunded">זוכה</option>
          <option value="failed">נכשל</option>
        </select>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value={0}>כל הזמן</option>
          <option value={7}>7 ימים</option>
          <option value={30}>30 יום</option>
          <option value={90}>90 יום</option>
        </select>
      </div>

      {/* isPlaceholderData, not isFetching: this dim marks "you're looking at the
          PREVIOUS page/filter while the new one loads". Keyed on isFetching it
          would now strobe the whole table once a minute on every background
          poll. */}
      {/* isPlaceholderData (not isFetching) marks "you're looking at the PREVIOUS
          page/filter while the new one loads" — keyed on isFetching it would
          strobe the whole table once a minute on every background poll. The
          !dataUpdatedAt clause keeps the very first mount dimmed, so an empty
          table never reads as an authoritative "אין הזמנות תואמות". */}
      <div
        className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out ${isPlaceholderData || !dataUpdatedAt ? "opacity-60" : ""}`}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="p-3">מס׳</th>
              <th className="p-3">לקוח</th>
              <th className="p-3">תאריך</th>
              <th className="p-3">סכום</th>
              <th className="p-3">תשלום</th>
              <th className="p-3">סטטוס</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-muted-foreground">
                  אין הזמנות תואמות.
                </td>
              </tr>
            )}
            {orders.map((o: any) => (
              <tr key={o.id} className={`border-t ${isNew(o) ? "bg-primary/5" : ""}`}>
                <td className="p-3 font-mono text-xs">
                  {o.order_number}
                  {o.is_gift && (
                    <span className="mr-1" title="מתנה — יש לארוז ולהדפיס הקדשה">
                      🎁
                    </span>
                  )}
                  {isNew(o) && (
                    <span className="mr-1 text-[10px] text-primary font-sans font-semibold">
                      חדש
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div>{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground">{o.customer_phone}</div>
                </td>
                <td className="p-3 text-xs">
                  {new Date(o.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-3 font-bold">{formatILS(Number(o.total))}</td>
                <td className="p-3">
                  <PaymentBadge status={o.payment_status} />
                </td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o, e.target.value)}
                    className="rounded border bg-background px-2 py-1 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_HE[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => setSelected(o)}>
                    פרטים
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            הקודם
          </Button>
          <span>
            עמוד {page + 1} מתוך {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            הבא
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>הזמנה {selected.order_number}</DialogTitle>
                  <Link
                    to="/admin/customers"
                    search={{ q: selected.customer_email }}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                    title="כרטיס לקוח"
                  >
                    <User className="h-3 w-3" /> כרטיס לקוח
                  </Link>
                </div>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{selected.customer_name}</strong>
                  <a
                    href={`tel:${selected.customer_phone}`}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                    title="חיוג"
                  >
                    <Phone className="h-3 w-3" /> {selected.customer_phone}
                  </a>
                  <a
                    href={waForOrder(selected)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted text-emerald-700"
                    title="WhatsApp — הודעה מוכנה לפי סטטוס ההזמנה"
                  >
                    <MessageCircle className="h-3 w-3" /> וואטסאפ
                  </a>
                  <a
                    href={`mailto:${selected.customer_email}`}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                    title="אימייל"
                  >
                    <Mail className="h-3 w-3" /> {selected.customer_email}
                  </a>
                </div>
                <div>
                  {selected.customer_address}
                  {selected.customer_city ? `, ${selected.customer_city}` : ""}
                </div>
                {selected.notes && (
                  <div className="text-muted-foreground">הערות: {selected.notes}</div>
                )}

                {selected.is_gift && (
                  <div className="rounded-md hairline-gold bg-card px-3 py-2">
                    <div className="font-semibold text-accent">🎁 הזמנה זו היא מתנה</div>
                    <div className="mt-1">
                      {selected.gift_wrap ? "עטיפת מתנה חגיגית" : "ללא עטיפה"}
                    </div>
                    {selected.gift_note && (
                      <div className="mt-1">
                        הקדשה להדפסה:
                        <div className="mt-1 whitespace-pre-wrap rounded border border-dashed border-gold bg-secondary px-2 py-1">
                          {selected.gift_note}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Internal CRM notes — same store as the customer card. */}
                <div className="border-t pt-3 space-y-2">
                  <div className="font-semibold">הערות פנימיות</div>
                  <div className="space-y-1.5">
                    {(custNotes ?? []).map((n: any) => (
                      <div key={n.id} className="rounded-md bg-muted/40 px-3 py-2">
                        <div>{n.note}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {new Date(n.created_at).toLocaleString("he-IL")}
                        </div>
                      </div>
                    ))}
                    {(custNotes ?? []).length === 0 && (
                      <div className="text-xs text-muted-foreground">אין הערות ללקוח זה עדיין.</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="הוספת הערה פנימית..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && submitNote()}
                    />
                    <Button
                      size="sm"
                      disabled={noteMutation.isPending || !noteText.trim()}
                      onClick={submitNote}
                    >
                      {noteMutation.isPending ? "שומר..." : "שמור"}
                    </Button>
                  </div>
                </div>
                {/* Each line carries its photograph. A thirteen-item order came
                    in at ₪2,001 and the names alone could not answer "what did
                    they actually buy" — two challah covers at ₪197 and ₪243 read
                    as nearly the same string, and the picture separates them at
                    a glance. Same resolver as the confirmation email, so the two
                    can never disagree about which image belongs to a line.
                    56px matches the email's thumbnail; the placeholder keeps the
                    price column on one axis when a product has no photo. */}
                <div className="border-t pt-3 space-y-2">
                  {selected.order_items.map((it: any) => {
                    // "" — a ROOT-RELATIVE path, not an absolute one, and not
                    // window.location.origin: this component is server-rendered
                    // and `window` does not exist there. The browser resolves
                    // "/groom-sets/…" against the page it is already on, which
                    // is exactly right here. Only the email needs an absolute
                    // origin, because a mail client has no page to resolve from.
                    const img = orderItemImageUrl(it, "", 112);
                    return (
                      <div key={it.id} className="flex items-start gap-3">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            width={56}
                            height={56}
                            loading="lazy"
                            className="h-14 w-14 shrink-0 rounded-md border border-border object-contain bg-secondary"
                          />
                        ) : (
                          <div
                            aria-hidden="true"
                            className="h-14 w-14 shrink-0 rounded-md border border-dashed border-border bg-muted"
                          />
                        )}
                        <span className="min-w-0 flex-1">
                          {it.product_name} × {it.quantity}
                          {it.variant_label && (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              · {it.variant_label}
                            </span>
                          )}
                          {it.custom_text && (
                            <span className="text-xs text-primary"> · ✦ {it.custom_text}</span>
                          )}
                        </span>
                        <span className="font-medium whitespace-nowrap">
                          {formatILS(Number(it.line_total))}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-lg border-t pt-3 font-bold">
                  <span>סך הכל</span>
                  <span className="text-primary">{formatILS(Number(selected.total))}</span>
                </div>

                {/* Confirmation receipt — the §14ג(ב) written confirmation.
                    Rendered because the send can now FAIL without throwing:
                    cardcom-settle claims confirmation_email_sent_at before
                    dispatch and releases it when the transport reports failure,
                    so a NULL stamp on a paid order means the buyer has no
                    receipt. That used to be invisible here while the log said
                    "order confirmation sent". */}
                {selected.payment_status === "paid" && (
                  <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      {selected.confirmation_email_sent_at ? (
                        <span className="text-emerald-700">
                          ✓ אישור הזמנה נשלח ללקוח ב-
                          {new Date(selected.confirmation_email_sent_at).toLocaleString("he-IL")}
                        </span>
                      ) : (
                        <span className="text-destructive">
                          ⚠ אישור ההזמנה טרם נשלח ללקוח — שלחו אותו ידנית.
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resending}
                      onClick={doResendConfirmation}
                    >
                      {resending
                        ? "שולח..."
                        : selected.confirmation_email_sent_at
                          ? "שלח אישור שוב ✉️"
                          : "שלח אישור ללקוח ✉️"}
                    </Button>
                  </div>
                )}

                {/* Telegram alerts to the owner — the phone channel, and the one
                    most likely to be checked first. sendOrderTelegramAlert fails
                    silently into the Worker log (bad/revoked token, bot removed
                    from its chat, a network blip), so telegram_*_alert_sent_at is
                    the same kind of latch confirmation_email_sent_at is above:
                    NULL means the owner's alert did not actually go out. The
                    "created" alert applies to every order; the "paid" one only
                    once payment_status is actually paid. */}
                <div className="border-t pt-3 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs">
                      {selected.telegram_created_alert_sent_at ? (
                        <span className="text-emerald-700">
                          ✓ התראת טלגרם (הזמנה נוצרה) נשלחה ב-
                          {new Date(selected.telegram_created_alert_sent_at).toLocaleString(
                            "he-IL",
                          )}
                        </span>
                      ) : (
                        <span className="text-destructive">
                          ⚠ התראת טלגרם על יצירת ההזמנה לא נשלחה.
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resendingTelegram === "created"}
                      onClick={() => doResendTelegram(false)}
                    >
                      {resendingTelegram === "created" ? "שולח..." : "שלח שוב 📲"}
                    </Button>
                  </div>
                  {selected.payment_status === "paid" && (
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs">
                        {selected.telegram_paid_alert_sent_at ? (
                          <span className="text-emerald-700">
                            ✓ התראת טלגרם (שולם) נשלחה ב-
                            {new Date(selected.telegram_paid_alert_sent_at).toLocaleString("he-IL")}
                          </span>
                        ) : (
                          <span className="text-destructive">
                            ⚠ התראת טלגרם על התשלום לא נשלחה.
                          </span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={resendingTelegram === "paid"}
                        onClick={() => doResendTelegram(true)}
                      >
                        {resendingTelegram === "paid" ? "שולח..." : "שלח שוב 📲"}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Shipping */}
                <div className="border-t pt-3 space-y-2">
                  <div className="font-semibold">משלוח</div>
                  {selected.shipped_at && (
                    <div className="text-xs text-emerald-700">
                      ✓ סומנה כנשלחה ללקוח ב-
                      {new Date(selected.shipped_at).toLocaleDateString("he-IL")}
                    </div>
                  )}
                  {/* "בהכנה" — the write that makes orders.shipping_status
                      ='preparing' reachable at all. Without it a paid buyer read
                      "ממתין לטיפול" on /account for the whole fulfilment window,
                      which is what a forgotten order looks like. Offered only
                      before the order ships and only once paid. */}
                  {selected.payment_status === "paid" && !selected.shipped_at && (
                    <div className="flex flex-wrap items-center gap-2">
                      {selected.shipping_status === "preparing" ? (
                        <span className="text-xs text-emerald-700">
                          ✓ מסומנת כבהכנה — הלקוח רואה זאת במעקב
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={preparing}
                          onClick={doPreparing}
                        >
                          {preparing ? "מעדכן..." : "סמן כבהכנה 🛠"}
                        </Button>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Input
                      placeholder="מספר מעקב"
                      value={tracking}
                      onChange={(e) => setTracking(e.target.value)}
                      className="max-w-[180px]"
                    />
                    <Input
                      placeholder="חברת שילוח"
                      value={carrier}
                      onChange={(e) => setCarrier(e.target.value)}
                      className="max-w-[150px]"
                    />
                    <Button size="sm" disabled={shipping} onClick={doShip}>
                      {shipping
                        ? "שולח..."
                        : selected.shipped_at
                          ? "עדכן משלוח"
                          : "סמן כנשלחה ושלח מייל ללקוח 📦"}
                    </Button>
                  </div>
                </div>

                {selected.payment_status === "paid" && (
                  <div className="border-t pt-3 flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      שולם בכרטיס אשראי
                      {selected.cardcom_document_number
                        ? ` · מסמך ${selected.cardcom_document_type ?? ""} מס׳ ${selected.cardcom_document_number}`
                        : ""}
                      {!Number(selected.cardcom_tranzaction_id) && (
                        <span className="block text-destructive">
                          אין מזהה עסקה מקארדקום — זיכוי אוטומטי אינו זמין. בצעו זיכוי ידני בממשק
                          קארדקום.
                        </span>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={refunding || !Number(selected.cardcom_tranzaction_id)}
                      onClick={() => doRefund(selected.id)}
                    >
                      {refunding ? "מבצע זיכוי..." : "זיכוי מלא"}
                    </Button>
                  </div>
                )}
                {selected.payment_status === "refunded" && (
                  <div className="border-t pt-3 text-xs font-semibold text-destructive">
                    הזמנה זו זוכתה
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
