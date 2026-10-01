import { createFileRoute, Link } from "@tanstack/react-router";
import { paymentStatusHe } from "@/lib/order-labels";
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
  sendOrderPaymentReminder,
  markOrderPaidOffline,
  markOrderReadyForPickup,
  listOrderEvents,
  countOrdersToHandle,
  resendOrderTelegramAlert,
} from "@/lib/admin-crm.functions";
import { missingTelegramAlert } from "@/lib/telegram-latch";
import { cn } from "@/lib/utils";
import {
  waThankYou,
  waShipped,
  waFollowUpUnpaid,
  waReadyForPickup,
  orderPaymentUrl,
} from "@/lib/wa-templates";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { AdminSheet, AdminSheetContent } from "@/components/admin/AdminSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, Phone, Mail, MessageCircle, Printer, User, RefreshCw } from "lucide-react";
import { orderItemImageUrl } from "@/lib/order-item-photo";
import { OrderShippingPanel, type ShipRequest } from "@/components/admin/OrderShippingPanel";
import { PhoneOrderDialog } from "@/components/admin/PhoneOrderDialog";

export const Route = createFileRoute("/admin/orders")({
  // Deep-linkable filters: the dashboard KPIs/chips and the customer card link
  // here with concrete filter states.
  validateSearch: (
    s: Record<string, unknown>,
  ): {
    q?: string;
    status?: string;
    payment?: string;
    days?: number;
    open?: string;
    new?: "phone";
    view?: OrdersView;
  } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    // "phone" = open the phone-order form straight away (the home-screen
    // shortcut "הזמנה טלפונית" in /admin.webmanifest).
    new: s.new === "phone" ? "phone" : undefined,
    view: VIEWS.some((v) => v.id === s.view) ? (s.view as OrdersView) : undefined,
    // "1" = open the order's details as soon as the search finds exactly one
    // (links from the action queue, the dashboard and the leads screen).
    open: s.open === "1" || s.open === 1 ? "1" : undefined,
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

// One-tap views above the list — what the owner actually asks the screen on a
// phone. "לטיפול" is the same rule as the badge on the orders tab.
type OrdersView = "todo" | "unpaid" | "pickup";
const VIEWS: { id: OrdersView | ""; label: string }[] = [
  { id: "", label: "הכל" },
  { id: "todo", label: "לטיפול" },
  { id: "unpaid", label: "לא שולמו" },
  { id: "pickup", label: "איסוף עצמי" },
];

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
  // "failed" too: a declined or expired card used to fall through to the
  // "thank you, we're preparing it" draft below.
  const templated =
    o?.payment_status === "unpaid" || o?.payment_status === "failed"
      ? waFollowUpUnpaid(o, o?.id ? orderPaymentUrl(o.id) : undefined)
      : o?.status === "shipped" || o?.status === "completed" || o?.shipped_at
        ? waShipped(o)
        : waThankYou(o);
  return templated ?? waLink(o?.customer_phone);
}

/**
 * Fulfilment for an order collected from the shop: "מוכן לאיסוף" (emails the
 * customer once) and "נאסף" (completes the order without an email — the review
 * request a week later is the next thing they hear).
 */
function PickupPanel({
  order,
  busy,
  onReady,
  onCollected,
}: {
  order: any;
  busy: boolean;
  onReady: () => void;
  onCollected: () => void;
}) {
  if (order.payment_status !== "paid" || ["cancelled", "refunded"].includes(order.status)) {
    return null;
  }
  const collected = !!order.shipped_at;
  const ready = order.shipping_status === "ready_for_pickup";
  const wa = waReadyForPickup(order);
  return (
    <div className="border-t border-glass-line pt-4 space-y-2">
      <div className="text-sm font-semibold">איסוף עצמי מהחנות</div>
      {collected ? (
        <div className="text-xs text-emerald-700">
          נאסף ב-{new Date(order.shipped_at).toLocaleDateString("he-IL")}
        </div>
      ) : (
        <div className="grid gap-2 sm:flex sm:flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="max-sm:min-h-11"
            disabled={busy || ready}
            onClick={onReady}
          >
            {ready ? "מוכנה לאיסוף ✓" : "מוכן לאיסוף — הודע ללקוח ✉️"}
          </Button>
          {wa && (
            <Button size="sm" variant="outline" className="max-sm:min-h-11" asChild>
              <a href={wa} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-4 w-4" /> הודעת איסוף בוואטסאפ
              </a>
            </Button>
          )}
          <Button size="sm" className="max-sm:min-h-11" disabled={busy} onClick={onCollected}>
            נאסף ✓
          </Button>
        </div>
      )}
    </div>
  );
}

type OfflineMethod = "cash" | "terminal" | "bit" | "transfer";
const OFFLINE_HE: Record<OfflineMethod, string> = {
  cash: "מזומן",
  terminal: "מסוף אשראי בחנות",
  bit: "ביט",
  transfer: "העברה בנקאית",
};

function PaymentBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "refunded"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return (
    <span className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${cls}`}>
      {paymentStatusHe(status)}
    </span>
  );
}

const FILTER_SELECT =
  "min-h-11 w-full min-w-0 rounded-md border bg-background px-2 py-2 text-sm sm:min-h-10 sm:w-auto sm:px-3";

const STATUS_TONE: Record<string, string> = {
  pending: "bg-stone-100 text-stone-800",
  processing: "bg-sky-100 text-sky-900",
  shipped: "bg-indigo-100 text-indigo-900",
  completed: "bg-emerald-50 text-emerald-800",
  cancelled: "bg-muted text-muted-foreground line-through",
  refunded: "bg-red-50 text-red-800",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${STATUS_TONE[status] ?? "bg-muted"}`}
    >
      {STATUS_HE[status] ?? status}
    </span>
  );
}

function PickupBadge() {
  return (
    <span className="text-[11px] rounded-full bg-sky-100 px-2 py-0.5 font-semibold whitespace-nowrap text-sky-900">
      איסוף עצמי
    </span>
  );
}

/** One order on a phone: the whole card is the button that opens it. */
function OrderCard({
  order: o,
  isNew,
  onOpen,
}: {
  order: any;
  isNew: boolean;
  onOpen: () => void;
}) {
  const items = (o.order_items ?? []) as { product_name: string; quantity: number }[];
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`הזמנה ${o.order_number} — ${o.customer_name}, ${formatILS(Number(o.total))}`}
      className={`press block w-full rounded-xl border p-3.5 text-start transition-colors duration-160 ease-out active:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        isNew ? "border-accent/40 bg-accent/5" : "border-glass-line bg-card"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{o.customer_name}</div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
            <bdi className="font-mono">{o.order_number}</bdi>
            <span>{new Date(o.created_at).toLocaleDateString("he-IL")}</span>
            {isNew && <span className="font-semibold text-primary">חדש</span>}
            {o.is_gift && (
              <span title="מתנה — יש לארוז ולהדפיס הקדשה" aria-label="מתנה">
                🎁
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0 text-lg font-bold">{formatILS(Number(o.total))}</div>
      </div>
      {items.length > 0 && (
        <div className="mt-1.5 truncate text-xs text-muted-foreground">
          {items
            .map((it) => `${it.product_name}${it.quantity > 1 ? ` ×${it.quantity}` : ""}`)
            .join(" · ")}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <PaymentBadge status={o.payment_status} />
        <StatusBadge status={o.status} />
        {o.fulfillment === "pickup" && <PickupBadge />}
      </div>
    </button>
  );
}

/** A titled block inside the order sheet. */
function SheetSection({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2 border-t border-glass-line pt-4 first:border-t-0 first:pt-0">
      {title && <h3 className="text-sm font-semibold">{title}</h3>}
      {children}
    </section>
  );
}

const CHIP =
  "inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm sm:min-h-10 sm:text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted";

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
  const readyForPickupFn = useServerFn(markOrderReadyForPickup);
  const resendConfirmation = useServerFn(resendOrderConfirmation);
  const resendTelegramFn = useServerFn(resendOrderTelegramAlert);
  const [resendingTelegram, setResendingTelegram] = useState(false);
  const payReminderFn = useServerFn(sendOrderPaymentReminder);
  const [sendingPayLink, setSendingPayLink] = useState(false);
  const [phoneOrderOpen, setPhoneOrderOpen] = useState(false);
  const paidOfflineFn = useServerFn(markOrderPaidOffline);
  const [offlineMethod, setOfflineMethod] = useState<OfflineMethod>("cash");
  const [markingPaid, setMarkingPaid] = useState(false);
  const custNotesFn = useServerFn(listCustomerNotes);
  const addNoteFn = useServerFn(addCustomerNote);

  // Filters — seeded from the URL so deep links land on a real filter state.
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(search.q ?? "");
  const [status, setStatus] = useState(search.status ?? "");
  const [payment, setPayment] = useState(search.payment ?? "");
  const [days, setDays] = useState(search.days ?? 0);
  const [view, setView] = useState<OrdersView | "">(search.view ?? "");
  // Same query key as the tab badge in admin.tsx — one request, one number.
  const countToHandle = useServerFn(countOrdersToHandle);
  const { data: toHandle = 0 } = useQuery({
    queryKey: ["admin-orders-to-handle"],
    queryFn: () => countToHandle(),
    staleTime: 60_000,
  });
  const [page, setPage] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debouncedQ, status, payment, days, view]);

  // Shipping form state lives in OrderShippingPanel (keyed by order id).
  const [shipping, setShipping] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [resending, setResending] = useState(false);
  const [noteText, setNoteText] = useState("");
  useEffect(() => {
    setNoteText("");
  }, [selected?.id]);

  // CRM notes inside the details dialog — the owner sees customer history
  // ("ביקש חריטה מיוחדת") without leaving the order.
  const { data: custNotes } = useQuery({
    queryKey: ["order-cust-notes", selected?.customer_email],
    enabled: !!selected?.customer_email,
    queryFn: () => custNotesFn({ data: { email: selected!.customer_email } }),
  });
  // Who moved this order and when (order_events) — with two admins, the
  // question after "נשלח?" is always "מי שלח?".
  const eventsFn = useServerFn(listOrderEvents);
  const { data: orderEvents } = useQuery({
    queryKey: ["order-events", selected?.id],
    enabled: !!selected?.id,
    queryFn: () => eventsFn({ data: { order_id: selected!.id } }),
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
    view: view || undefined,
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
  // A deep link with open=1 lands IN the order, not on a one-row list.
  const autoOpened = useRef(false);
  const navigate = Route.useNavigate();
  useEffect(() => {
    if (search.new !== "phone") return;
    setPhoneOrderOpen(true);
    // Drop the flag so closing the form and refreshing doesn't reopen it.
    navigate({ search: (prev) => ({ ...prev, new: undefined }), replace: true });
  }, [search.new, navigate]);
  useEffect(() => {
    if (search.open === "1" && !autoOpened.current && !isPlaceholderData && orders.length === 1) {
      autoOpened.current = true;
      setSelected(orders[0]);
    }
  }, [search.open, orders, isPlaceholderData]);
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const doResendTelegram = async (paid: boolean) => {
    if (!selected) return;
    setResendingTelegram(true);
    try {
      await resendTelegramFn({ data: { order_id: selected.id, paid } });
      const now = new Date().toISOString();
      setSelected({
        ...selected,
        ...(paid ? { telegram_paid_alert_sent_at: now } : { telegram_created_alert_sent_at: now }),
      });
      toast.success("ההתראה נשלחה לטלגרם");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "השליחה לטלגרם נכשלה");
    } finally {
      setResendingTelegram(false);
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
    qc.invalidateQueries({ queryKey: ["order-events"] });
    qc.invalidateQueries({ queryKey: ["admin-orders-to-handle"] });
  };

  const updateStatus = async (o: any, st: string): Promise<boolean> => {
    // A terminal transition — cancelled/refunded — restores reserved stock and
    // flips payment semantics server-side, so a single mis-tap on the inline
    // select must never commit it silently. Gate ONLY those two transitions
    // behind a Hebrew confirm that names the order and target status. Declining
    // returns before the mutation runs; because the <select> is controlled by
    // o.status (server truth), React snaps it back to its current value on its
    // own — no manual revert needed. Non-destructive transitions are unchanged.
    if ((st === "cancelled" || st === "refunded") && st !== o.status) {
      const ok = window.confirm(
        `לשנות את סטטוס הזמנה ${o.order_number} ל"${STATUS_HE[st] ?? st}"? המלאי יוחזר. זה לא מחזיר כסף ללקוח — לזיכוי השתמשו ב"זיכוי מלא" בפרטי ההזמנה.`,
      );
      if (!ok) return false;
    }
    // Routed through the server fn (not a direct client update) so that setting a
    // terminal status — cancelled/refunded — restores reserved stock server-side.
    try {
      await setOrderStatus({ data: { order_id: o.id, status: st } });
      toast.success("עודכן");
      refresh();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון הסטטוס");
      return false;
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

  const doShip = async (req: ShipRequest) => {
    setShipping(true);
    try {
      const r = await shipOrder({ data: { order_id: selected.id, ...req } });
      toast.success(
        r.delivered
          ? "סומנה כנמסרה — בלי מייל ללקוח ✓"
          : r.emailSent
            ? "סומנה כנשלחה ומייל נשלח ללקוח 📦"
            : "סומנה כנשלחה (מייל כבר נשלח בעבר)",
      );
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון המשלוח");
    } finally {
      setShipping(false);
    }
  };

  const doMarkPaidOffline = async () => {
    const label = OFFLINE_HE[offlineMethod];
    if (
      !window.confirm(
        `לסמן שהזמנה ${selected.order_number} שולמה (${label})? ההזמנה תצא מהלידים ותעבור לטיפול.`,
      )
    ) {
      return;
    }
    setMarkingPaid(true);
    try {
      await paidOfflineFn({ data: { order_id: selected.id, method: offlineMethod } });
      toast.success(`סומנה כשולמה (${label})`);
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "העדכון נכשל");
    } finally {
      setMarkingPaid(false);
    }
  };

  const doReadyForPickup = async () => {
    setPreparing(true);
    try {
      const r = await readyForPickupFn({ data: { order_id: selected.id } });
      toast.success(
        r.alreadyReady
          ? "כבר מסומנת כמוכנה לאיסוף"
          : r.emailSent
            ? "סומנה כמוכנה לאיסוף ומייל נשלח ללקוח 🛍️"
            : "סומנה כמוכנה לאיסוף (המייל לא נשלח — אפשר בוואטסאפ)",
      );
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון ההזמנה");
    } finally {
      setPreparing(false);
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

  const doSendPayLink = async () => {
    setSendingPayLink(true);
    try {
      const r = await payReminderFn({ data: { id: selected.id } });
      if (r.ok) {
        toast.success(r.message);
        setSelected({ ...selected, payment_reminder_sent_at: new Date().toISOString() });
        refresh();
      } else {
        toast.error(r.message);
      }
    } catch (e: any) {
      toast.error(e?.message ?? "השליחה נכשלה");
    } finally {
      setSendingPayLink(false);
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
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
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
          <Button size="sm" onClick={() => setPhoneOrderOpen(true)} className="max-sm:min-h-11">
            <Phone className="h-4 w-4" /> הזמנה טלפונית
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="רענון"
            className="shrink-0 max-sm:min-h-11 max-sm:w-11 max-sm:px-0"
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
            <span className="max-sm:sr-only">{isFetching ? "מרענן..." : "רענון"}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={doExport}
            aria-label="ייצוא CSV"
            className="shrink-0 max-sm:min-h-11 max-sm:w-11 max-sm:px-0"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">ייצוא CSV</span>
          </Button>
        </div>
      </div>

      <PhoneOrderDialog
        open={phoneOrderOpen}
        onOpenChange={setPhoneOrderOpen}
        onCreated={() => refresh()}
      />

      {/* Quick views: one tap instead of combining two selects. "הכל" also
          clears the selects, so it is always a way back to the full list. */}
      <div
        role="group"
        aria-label="תצוגה מהירה"
        className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0"
      >
        {VIEWS.map((v) => {
          const active =
            view === v.id && (v.id !== "" || (!status && !payment && !days && !debouncedQ));
          return (
            <button
              key={v.id || "all"}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setView(v.id);
                if (v.id === "") {
                  setStatus("");
                  setPayment("");
                  setDays(0);
                  setQ("");
                }
              }}
              className={cn(
                "min-h-10 shrink-0 rounded-full border px-3.5 text-sm font-medium transition-colors duration-160 ease-out",
                active
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-glass-line bg-card/70 text-foreground active:bg-muted",
              )}
            >
              {v.label}
              {v.id === "todo" && toHandle > 0 && (
                <span
                  className={cn(
                    "ms-1.5 inline-block min-w-5 rounded-full px-1 text-[11px] font-bold leading-5",
                    active ? "bg-white/25" : "bg-amber-500 text-white",
                  )}
                >
                  {toHandle}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters — on a phone the search takes the full row and the three
          selects share the next one, instead of wrapping into a ragged stack. */}
      <div className="mb-4 grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
        <Input
          type="search"
          enterKeyHint="search"
          placeholder="חיפוש: מס׳ הזמנה / שם / טלפון / אימייל"
          aria-label="חיפוש הזמנות"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="col-span-3 min-h-11 sm:min-h-0 sm:max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="סינון לפי סטטוס"
          className={FILTER_SELECT}
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
          aria-label="סינון לפי תשלום"
          className={FILTER_SELECT}
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
          aria-label="תקופה"
          className={FILTER_SELECT}
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
      {/* Phone: one card per order — who, how much, where it stands — and the
          whole card opens the order. The table needs a sideways scroll at this
          width and hid the button that opens the order past it. */}
      <ul
        className={`space-y-2 sm:hidden transition-opacity duration-200 ease-out ${isPlaceholderData || !dataUpdatedAt ? "opacity-60" : ""}`}
      >
        {orders.length === 0 && (
          <li className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            {dataUpdatedAt ? "אין הזמנות תואמות." : "טוען..."}
          </li>
        )}
        {orders.map((o: any) => (
          <li key={o.id}>
            <OrderCard order={o} isNew={isNew(o)} onOpen={() => setSelected(o)} />
          </li>
        ))}
      </ul>

      <div
        className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out max-sm:hidden ${isPlaceholderData || !dataUpdatedAt ? "opacity-60" : ""}`}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="p-3">מס׳</th>
              <th className="p-3">לקוח</th>
              <th className="hidden p-3 sm:table-cell">תאריך</th>
              <th className="p-3">סכום</th>
              <th className="p-3">תשלום</th>
              <th className="p-3">סטטוס</th>
              <th>
                <span className="sr-only">פעולות</span>
              </th>
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
                  {/* The order number opens the order — on a phone the "פרטים"
                      column sits past a sideways scroll. */}
                  <button
                    type="button"
                    onClick={() => setSelected(o)}
                    className="min-h-10 font-semibold text-primary underline underline-offset-2"
                  >
                    {o.order_number}
                  </button>
                  {o.is_gift && (
                    <span className="ms-1" title="מתנה — יש לארוז ולהדפיס הקדשה">
                      🎁
                    </span>
                  )}
                  {isNew(o) && (
                    <span className="ms-1 text-[10px] text-primary font-sans font-semibold">
                      חדש
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <div>{o.customer_name}</div>
                  <div className="text-xs text-muted-foreground" dir="ltr">
                    {o.customer_phone}
                  </div>
                </td>
                <td className="hidden p-3 text-xs sm:table-cell">
                  {new Date(o.created_at).toLocaleDateString("he-IL")}
                </td>
                <td className="p-3 font-bold">{formatILS(Number(o.total))}</td>
                <td className="p-3">
                  <PaymentBadge status={o.payment_status} />
                  {o.fulfillment === "pickup" && (
                    <span className="mt-1 block w-fit rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-semibold text-sky-900">
                      איסוף עצמי
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <select
                    value={o.status}
                    onChange={(e) => updateStatus(o, e.target.value)}
                    aria-label={`סטטוס הזמנה ${o.order_number}`}
                    className="min-h-10 rounded border bg-background px-2 text-sm"
                  >
                    {/* "נשלחה" and "זוכתה" are not offered here: the dropdown only
                        changes the label — no shipping email, no tracking, and no
                        money back. They have their own buttons in the order. */}
                    {STATUSES.filter(
                      (s) => (s !== "shipped" && s !== "refunded") || s === o.status,
                    ).map((s) => (
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
            className="max-sm:min-h-11"
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
            className="max-sm:min-h-11"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            הבא
          </Button>
        </div>
      )}

      <AdminSheet open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        {selected && (
          <AdminSheetContent
            title={
              <>
                הזמנה <bdi className="font-mono">{selected.order_number}</bdi>
              </>
            }
            headerExtra={
              <div className="flex flex-wrap items-center gap-1.5">
                <PaymentBadge status={selected.payment_status} />
                <StatusBadge status={selected.status} />
                {selected.fulfillment === "pickup" && <PickupBadge />}
                <span className="text-xs text-muted-foreground">
                  {new Date(selected.created_at).toLocaleString("he-IL", {
                    day: "numeric",
                    month: "numeric",
                    year: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            }
            // The contact bar: the thing done most with an open order is
            // writing to the customer, so it sits under the thumb and never
            // scrolls away. WhatsApp opens a draft that fits the order's state.
            footer={
              <div className="flex items-center gap-2">
                {selected.customer_phone && (
                  <Button
                    asChild
                    className="flex-1 bg-emerald-700 text-white hover:bg-emerald-800 sm:flex-none sm:px-6"
                  >
                    <a
                      href={waForOrder(selected)}
                      target="_blank"
                      rel="noreferrer"
                      title="WhatsApp — הודעה מוכנה לפי סטטוס ההזמנה"
                    >
                      <MessageCircle className="h-4 w-4" /> וואטסאפ
                    </a>
                  </Button>
                )}
                {selected.customer_phone && (
                  <Button asChild variant="outline" size="icon" aria-label="חיוג ללקוח">
                    <a href={`tel:${selected.customer_phone}`}>
                      <Phone className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                <Button asChild variant="outline" size="icon" aria-label="כרטיס לקוח">
                  <Link to="/admin/customers" search={{ q: selected.customer_email }}>
                    <User className="h-4 w-4" />
                  </Link>
                </Button>
                {/* Opens in a new tab so the sheet — and the "נשלח" button
                    pressed after packing — is still here afterwards. */}
                <Button asChild variant="outline" size="icon" aria-label="דף אריזה להדפסה">
                  <Link
                    to="/admin/orders/$orderId/print"
                    params={{ orderId: selected.id }}
                    target="_blank"
                    title="דף אריזה להדפסה — פריטים, כיתוב אישי והקדשה, בלי מחירים"
                  >
                    <Printer className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            }
          >
            <div className="space-y-4 text-sm">
              {/* Who and where. */}
              <SheetSection>
                <div className="text-base font-semibold">{selected.customer_name}</div>
                <div className="flex flex-wrap gap-2">
                  <a href={`tel:${selected.customer_phone}`} className={CHIP} title="חיוג">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <bdi dir="ltr">{selected.customer_phone}</bdi>
                  </a>
                  <a href={`mailto:${selected.customer_email}`} className={CHIP} title="אימייל">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <bdi dir="ltr" className="truncate">
                      {selected.customer_email}
                    </bdi>
                  </a>
                </div>
                {(selected.customer_address || selected.customer_city) && (
                  <div className="flex items-start gap-2">
                    <span className="min-w-0 flex-1">
                      {selected.customer_address}
                      {selected.customer_city ? `, ${selected.customer_city}` : ""}
                    </span>
                    {/* Name, phone and address in one tap — what a courier
                        form asks for, without three long-presses on a phone. */}
                    {selected.fulfillment !== "pickup" && (
                      <button
                        type="button"
                        className={cn(CHIP, "shrink-0")}
                        onClick={async () => {
                          const text = [
                            selected.customer_name,
                            selected.customer_phone,
                            [selected.customer_address, selected.customer_city]
                              .filter(Boolean)
                              .join(", "),
                          ]
                            .filter(Boolean)
                            .join("\n");
                          try {
                            await navigator.clipboard.writeText(text);
                            toast.success("פרטי המשלוח הועתקו");
                          } catch {
                            toast.error("לא ניתן להעתיק — סמנו את הכתובת ידנית");
                          }
                        }}
                      >
                        <Copy className="h-3.5 w-3.5 shrink-0" /> העתקה לשליח
                      </button>
                    )}
                  </div>
                )}
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
              </SheetSection>

              {/* Each line carries its photograph. A thirteen-item order came
                  in at ₪2,001 and the names alone could not answer "what did
                  they actually buy" — two challah covers at ₪197 and ₪243 read
                  as nearly the same string, and the picture separates them at
                  a glance. Same resolver as the confirmation email, so the two
                  can never disagree about which image belongs to a line.
                  56px matches the email's thumbnail; the placeholder keeps the
                  price column on one axis when a product has no photo. */}
              <SheetSection title={`פריטים (${selected.order_items.length})`}>
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
                <div className="flex justify-between border-t border-glass-line pt-3 text-lg font-bold">
                  <span>סך הכל</span>
                  <span className="text-primary">{formatILS(Number(selected.total))}</span>
                </div>
              </SheetSection>

              {/* An unpaid order gets the same one-link email the hourly job
                  sends two hours after checkout: back to THIS order's payment
                  page, no new basket. The server refuses (with the reason)
                  when money was already captured, the customer paid on
                  another order, or they asked us to stop. */}
              {(selected.payment_status === "unpaid" || selected.payment_status === "failed") &&
                !["cancelled", "refunded"].includes(selected.status) && (
                  <SheetSection title="התשלום לא הושלם">
                    <div className="text-xs text-muted-foreground">
                      {selected.cardcom_description && (
                        <span className="block">{selected.cardcom_description}</span>
                      )}
                      {selected.payment_reminder_sent_at
                        ? `נשלח ללקוח קישור להשלמת התשלום ב-${new Date(
                            selected.payment_reminder_sent_at,
                          ).toLocaleString("he-IL")}`
                        : "עדיין לא נשלח ללקוח קישור להשלמת התשלום."}
                    </div>
                    <div className="grid gap-2 sm:flex sm:flex-wrap">
                      {waFollowUpUnpaid(selected, orderPaymentUrl(selected.id)) && (
                        <Button variant="outline" asChild>
                          <a
                            href={waFollowUpUnpaid(selected, orderPaymentUrl(selected.id))!}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <MessageCircle className="h-4 w-4" /> קישור לתשלום בוואטסאפ
                          </a>
                        </Button>
                      )}
                      <Button variant="outline" disabled={sendingPayLink} onClick={doSendPayLink}>
                        {sendingPayLink
                          ? "שולח..."
                          : selected.payment_reminder_sent_at
                            ? "שלח שוב קישור לתשלום ✉️"
                            : "שלח ללקוח קישור לתשלום ✉️"}
                      </Button>
                      {/* The same page the email links to; opening it mints a
                          fresh CardCom session, so it outlives the 24h expiry. */}
                      <Button
                        variant="ghost"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(orderPaymentUrl(selected.id));
                            toast.success("קישור התשלום הועתק — אפשר להדביק בוואטסאפ או ב-SMS");
                          } catch {
                            toast.error("ההעתקה נכשלה");
                          }
                        }}
                      >
                        <Copy className="h-4 w-4" /> העתק קישור לתשלום
                      </Button>
                    </div>
                    {/* Paid at the counter (cash / the shop's terminal / Bit /
                        transfer): closes the lead and opens fulfilment. */}
                    <div className="rounded-lg border border-dashed p-3">
                      <label htmlFor="offline-method" className="text-xs text-muted-foreground">
                        שולם מחוץ לאתר?
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <select
                          id="offline-method"
                          value={offlineMethod}
                          onChange={(e) => setOfflineMethod(e.target.value as OfflineMethod)}
                          className="min-h-11 min-w-0 flex-1 rounded-md border bg-background px-2 text-sm sm:min-h-10 sm:flex-none"
                        >
                          <option value="cash">מזומן</option>
                          <option value="terminal">מסוף אשראי בחנות</option>
                          <option value="bit">ביט</option>
                          <option value="transfer">העברה בנקאית</option>
                        </select>
                        <Button disabled={markingPaid} onClick={doMarkPaidOffline}>
                          {markingPaid ? "מעדכן..." : "סימון כשולם ✓"}
                        </Button>
                      </div>
                    </div>
                  </SheetSection>
                )}

              {selected.fulfillment === "pickup" ? (
                <PickupPanel
                  order={selected}
                  busy={shipping || preparing}
                  onReady={doReadyForPickup}
                  onCollected={() => {
                    if (
                      window.confirm(
                        `לסמן שהזמנה ${selected.order_number} נאספה? ההזמנה תיסגר ותישלח בקשת חוות דעת בעוד שבוע.`,
                      )
                    ) {
                      void doShip({ delivered: true, carrier: "איסוף עצמי" });
                    }
                  }}
                />
              ) : (
                <OrderShippingPanel
                  key={selected.id}
                  order={selected}
                  busy={shipping}
                  onShip={doShip}
                  preparing={preparing}
                  onPreparing={doPreparing}
                />
              )}

              {/* The owner's own Telegram alert for this order did not arrive
                  (telegram-latch.ts decides; only orders since the stamps
                  began, and only alerts that were due). Shown only when
                  something is wrong — a sheet full of green ticks is noise. */}
              {(() => {
                const missing = missingTelegramAlert(selected);
                if (!missing) return null;
                return (
                  <SheetSection>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs text-destructive">
                        {missing === "paid"
                          ? "⚠ התראת הטלגרם על התשלום לא הגיעה אליכם."
                          : "⚠ התראת הטלגרם על ההזמנה החדשה לא הגיעה אליכם."}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="max-sm:min-h-11"
                        disabled={resendingTelegram}
                        onClick={() => doResendTelegram(missing === "paid")}
                      >
                        {resendingTelegram ? "שולח..." : "שלח שוב לטלגרם"}
                      </Button>
                    </div>
                  </SheetSection>
                );
              })()}

              {/* Confirmation receipt — the §14ג(ב) written confirmation.
                  Rendered because the send can now FAIL without throwing:
                  cardcom-settle claims confirmation_email_sent_at before
                  dispatch and releases it when the transport reports failure,
                  so a NULL stamp on a paid order means the buyer has no
                  receipt. That used to be invisible here while the log said
                  "order confirmation sent". */}
              {selected.payment_status === "paid" && (
                <SheetSection>
                  <div className="flex flex-wrap items-center justify-between gap-2">
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
                      className="max-sm:min-h-11"
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
                </SheetSection>
              )}

              {/* The status, here too: on a phone the orders list is cards,
                  and the table's per-row select is not on screen. Same rules —
                  "נשלחה" and "זוכתה" have their own buttons, and cancelling
                  asks first. */}
              <SheetSection>
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="order-status" className="font-semibold">
                    סטטוס ההזמנה
                  </label>
                  <select
                    id="order-status"
                    value={selected.status}
                    onChange={async (e) => {
                      const st = e.target.value;
                      if (await updateStatus(selected, st))
                        setSelected({ ...selected, status: st });
                    }}
                    className="min-h-11 rounded-md border bg-background px-2 text-sm sm:min-h-10"
                  >
                    {STATUSES.filter(
                      (st) => (st !== "shipped" && st !== "refunded") || st === selected.status,
                    ).map((st) => (
                      <option key={st} value={st}>
                        {STATUS_HE[st]}
                      </option>
                    ))}
                  </select>
                </div>
              </SheetSection>

              {/* Internal CRM notes — same store as the customer card. */}
              <SheetSection title="הערות פנימיות">
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
                    aria-label="הוספת הערה פנימית"
                    enterKeyHint="send"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitNote()}
                    className="min-h-11 sm:min-h-10"
                  />
                  <Button
                    disabled={noteMutation.isPending || !noteText.trim()}
                    onClick={submitNote}
                  >
                    {noteMutation.isPending ? "שומר..." : "שמור"}
                  </Button>
                </div>
              </SheetSection>

              {orderEvents && orderEvents.length > 0 && (
                <SheetSection title="היסטוריה">
                  <ul className="space-y-1 text-xs">
                    {orderEvents.map((ev) => (
                      <li key={ev.id} className="flex flex-wrap gap-x-2">
                        <span className="text-muted-foreground">
                          {new Date(ev.at).toLocaleString("he-IL", {
                            day: "numeric",
                            month: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                        <span>{ev.what}</span>
                        {ev.detail && <span className="text-muted-foreground">({ev.detail})</span>}
                        <span className="text-muted-foreground">· {ev.who}</span>
                      </li>
                    ))}
                  </ul>
                </SheetSection>
              )}

              {/* Payment record and the full refund — last, and apart from the
                  everyday buttons: it cannot be undone. */}
              {selected.payment_status === "paid" && (
                <SheetSection>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 text-xs text-muted-foreground">
                      {selected.payment_provider === "offline"
                        ? `שולם מחוץ לאתר (${OFFLINE_HE[selected.payment_method as OfflineMethod] ?? selected.payment_method})`
                        : "שולם בכרטיס אשראי"}
                      {selected.cardcom_document_number
                        ? ` · מסמך ${selected.cardcom_document_type ?? ""} מס׳ ${selected.cardcom_document_number}`
                        : ""}
                      {selected.payment_provider !== "offline" &&
                        !Number(selected.cardcom_tranzaction_id) && (
                          <span className="block text-destructive">
                            אין מזהה עסקה מקארדקום — זיכוי אוטומטי אינו זמין. בצעו זיכוי ידני בממשק
                            קארדקום.
                          </span>
                        )}
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="max-sm:min-h-11"
                      disabled={refunding || !Number(selected.cardcom_tranzaction_id)}
                      onClick={() => doRefund(selected.id)}
                    >
                      {refunding ? "מבצע זיכוי..." : "זיכוי מלא"}
                    </Button>
                  </div>
                </SheetSection>
              )}
              {selected.payment_status === "refunded" && (
                <div className="border-t pt-3 text-xs font-semibold text-destructive">
                  הזמנה זו זוכתה
                </div>
              )}
            </div>
          </AdminSheetContent>
        )}
      </AdminSheet>
    </div>
  );
}
