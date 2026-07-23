import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatILS } from "@/lib/cart";
import { refundCardcomOrder } from "@/lib/cardcom.functions";
import {
  listOrdersPaged,
  exportOrdersCsv,
  markOrderShipped,
  listCustomerNotes,
  addCustomerNote,
} from "@/lib/admin-crm.functions";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Phone, Mail, MessageCircle, User } from "lucide-react";

export const Route = createFileRoute("/admin/orders")({
  // Deep-linkable filters: the dashboard KPIs/chips and the customer card link
  // here with concrete filter states.
  validateSearch: (s: Record<string, unknown>): { q?: string; status?: string; payment?: string; days?: number } => ({
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
  pending: "ממתינה", processing: "בטיפול", shipped: "נשלחה", completed: "הושלמה", cancelled: "בוטלה", refunded: "זוכתה",
};
const PAYMENT_HE: Record<string, string> = { paid: "שולם", unpaid: "לא שולם", refunded: "זוכה" };

/** Israeli local number -> wa.me international format. Also used by the
 * abandoned-carts screen (admin.abandoned.tsx). */
export function waLink(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

function PaymentBadge({ status }: { status: string }) {
  const cls =
    status === "paid"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
      : status === "refunded"
        ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
        : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
  return <span className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${cls}`}>{PAYMENT_HE[status] ?? status}</span>;
}

function AdminOrders() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [refunding, setRefunding] = useState(false);
  const refundOrder = useServerFn(refundCardcomOrder);
  const listOrders = useServerFn(listOrdersPaged);
  const exportCsv = useServerFn(exportOrdersCsv);
  const shipOrder = useServerFn(markOrderShipped);
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

  const { data, isFetching } = useQuery({
    queryKey: ["admin-orders", filters],
    placeholderData: keepPreviousData,
    queryFn: () => listOrders({ data: filters }),
  });
  const orders = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-orders"] });

  const updateStatus = async (id: string, st: string) => {
    const { error } = await supabase.from("orders").update({ status: st }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("עודכן");
    refresh();
  };

  const doRefund = async (orderId: string) => {
    if (!window.confirm("לבצע זיכוי מלא להזמנה זו? הפעולה אינה הפיכה.")) return;
    setRefunding(true);
    try {
      const r = await refundOrder({ data: { order_id: orderId } });
      toast.success(
        `הזיכוי בוצע בהצלחה${r.newDocumentNumber ? ` — מסמך ${r.newDocumentType ?? ""} מס׳ ${r.newDocumentNumber}` : ""}`,
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
        data: { order_id: selected.id, tracking_number: tracking || undefined, carrier: carrier || undefined },
      });
      toast.success(r.emailSent ? "סומנה כנשלחה ומייל נשלח ללקוח 📦" : "סומנה כנשלחה (מייל כבר נשלח בעבר)");
      setSelected(null);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון המשלוח");
    } finally {
      setShipping(false);
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
        <h1 className="font-display text-2xl font-bold">הזמנות ({total})</h1>
        <Button size="sm" variant="outline" onClick={doExport}>
          <Download className="h-4 w-4 ml-1" /> ייצוא CSV
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="חיפוש: מס׳ הזמנה / שם / טלפון / אימייל"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">כל הסטטוסים</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_HE[s]}</option>)}
        </select>
        <select value={payment} onChange={(e) => setPayment(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="">כל התשלומים</option>
          <option value="paid">שולם</option>
          <option value="unpaid">לא שולם</option>
          <option value="refunded">זוכה</option>
        </select>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value={0}>כל הזמן</option>
          <option value={7}>7 ימים</option>
          <option value={30}>30 יום</option>
          <option value={90}>90 יום</option>
        </select>
      </div>

      <div className={`rounded-lg border bg-card overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-right">
            <th className="p-3">מס׳</th><th className="p-3">לקוח</th><th className="p-3">תאריך</th>
            <th className="p-3">סכום</th><th className="p-3">תשלום</th><th className="p-3">סטטוס</th><th></th>
          </tr></thead>
          <tbody>
            {orders.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">אין הזמנות תואמות.</td></tr>
            )}
            {orders.map((o: any) => (
              <tr key={o.id} className={`border-t ${isNew(o) ? "bg-primary/5" : ""}`}>
                <td className="p-3 font-mono text-xs">
                  {o.order_number}
                  {o.is_gift && <span className="mr-1" title="מתנה — יש לארוז ולהדפיס הקדשה">🎁</span>}
                  {isNew(o) && <span className="mr-1 text-[10px] text-primary font-sans font-semibold">חדש</span>}
                </td>
                <td className="p-3"><div>{o.customer_name}</div><div className="text-xs text-muted-foreground">{o.customer_phone}</div></td>
                <td className="p-3 text-xs">{new Date(o.created_at).toLocaleDateString("he-IL")}</td>
                <td className="p-3 font-bold">{formatILS(Number(o.total))}</td>
                <td className="p-3"><PaymentBadge status={o.payment_status} /></td>
                <td className="p-3">
                  <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="rounded border bg-background px-2 py-1 text-xs">
                    {STATUSES.map((s) => <option key={s} value={s}>{STATUS_HE[s]}</option>)}
                  </select>
                </td>
                <td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelected(o)}>פרטים</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>הקודם</Button>
          <span>עמוד {page + 1} מתוך {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>הבא</Button>
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
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"
                    title="כרטיס לקוח"
                  >
                    <User className="h-3 w-3" /> כרטיס לקוח
                  </Link>
                </div>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{selected.customer_name}</strong>
                  <a href={`tel:${selected.customer_phone}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted" title="חיוג">
                    <Phone className="h-3 w-3" /> {selected.customer_phone}
                  </a>
                  <a href={waLink(selected.customer_phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted text-emerald-700" title="WhatsApp">
                    <MessageCircle className="h-3 w-3" /> וואטסאפ
                  </a>
                  <a href={`mailto:${selected.customer_email}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted" title="אימייל">
                    <Mail className="h-3 w-3" /> {selected.customer_email}
                  </a>
                </div>
                <div>{selected.customer_address}{selected.customer_city ? `, ${selected.customer_city}` : ""}</div>
                {selected.notes && <div className="text-muted-foreground">הערות: {selected.notes}</div>}

                {selected.is_gift && (
                  <div className="rounded-md border border-[#D4AF37] bg-[#FAF6E9] px-3 py-2">
                    <div className="font-semibold text-[#A8862A]">🎁 הזמנה זו היא מתנה</div>
                    <div className="mt-1">
                      {selected.gift_wrap ? "עטיפת מתנה חגיגית" : "ללא עטיפה"}
                    </div>
                    {selected.gift_note && (
                      <div className="mt-1">
                        הקדשה להדפסה:
                        <div className="mt-1 whitespace-pre-wrap rounded border border-dashed border-[#D4AF37] bg-white px-2 py-1">
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
                    <Button size="sm" disabled={noteMutation.isPending || !noteText.trim()} onClick={submitNote}>
                      {noteMutation.isPending ? "שומר..." : "שמור"}
                    </Button>
                  </div>
                </div>
                <div className="border-t pt-3 space-y-1">
                  {selected.order_items.map((it: any) => (
                    <div key={it.id} className="flex justify-between">
                      <span>
                        {it.product_name} × {it.quantity}
                        {it.variant_label && <span className="text-xs text-muted-foreground"> · {it.variant_label}</span>}
                        {it.custom_text && <span className="text-xs text-primary"> · ✦ {it.custom_text}</span>}
                      </span>
                      <span className="font-medium">{formatILS(Number(it.line_total))}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-lg border-t pt-3 font-bold">
                  <span>סך הכל</span><span className="text-primary">{formatILS(Number(selected.total))}</span>
                </div>

                {/* Shipping */}
                <div className="border-t pt-3 space-y-2">
                  <div className="font-semibold">משלוח</div>
                  {selected.shipping_notified_at && (
                    <div className="text-xs text-emerald-700">
                      ✓ מייל משלוח נשלח ללקוח ב-{new Date(selected.shipping_notified_at).toLocaleDateString("he-IL")}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Input placeholder="מספר מעקב" value={tracking} onChange={(e) => setTracking(e.target.value)} className="max-w-[180px]" />
                    <Input placeholder="חברת שילוח" value={carrier} onChange={(e) => setCarrier(e.target.value)} className="max-w-[150px]" />
                    <Button size="sm" disabled={shipping} onClick={doShip}>
                      {shipping ? "שולח..." : selected.shipping_notified_at ? "עדכן משלוח" : "סמן כנשלחה ושלח מייל ללקוח 📦"}
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
                    </div>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={refunding || !selected.cardcom_document_number}
                      onClick={() => doRefund(selected.id)}
                    >
                      {refunding ? "מבצע זיכוי..." : "זיכוי מלא"}
                    </Button>
                  </div>
                )}
                {selected.payment_status === "refunded" && (
                  <div className="border-t pt-3 text-xs font-semibold text-destructive">הזמנה זו זוכתה</div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
