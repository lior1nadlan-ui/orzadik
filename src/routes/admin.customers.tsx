import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCustomers,
  getCustomerDetail,
  addCustomerNote,
  deleteCustomerNote,
  exportCustomersCsv,
} from "@/lib/admin-crm.functions";
import { formatILS } from "@/lib/cart";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Phone, Mail, MessageCircle, Trash2 } from "lucide-react";

export const Route = createFileRoute("/admin/customers")({
  // Deep-linkable search: the orders dialog links here with the customer email.
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: AdminCustomers,
});

const PAYMENT_HE: Record<string, string> = { paid: "שולם", unpaid: "לא שולם", refunded: "זוכה" };

function waLink(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

function AdminCustomers() {
  const qc = useQueryClient();
  const list = useServerFn(listCustomers);
  const detail = useServerFn(getCustomerDetail);
  const addNote = useServerFn(addCustomerNote);
  const delNote = useServerFn(deleteCustomerNote);
  const exportCsv = useServerFn(exportCustomersCsv);

  // Search seeded from the URL so deep links land on a filtered list.
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(search.q ?? "");
  const [sort, setSort] = useState<"ltv" | "recent" | "orders">("ltv");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debouncedQ, sort]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-customers", debouncedQ, sort, page],
    placeholderData: keepPreviousData,
    queryFn: () => list({ data: { q: debouncedQ || undefined, sort, page } }),
  });
  const customers = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const { data: cust } = useQuery({
    queryKey: ["admin-customer", selected?.email],
    enabled: !!selected,
    queryFn: () => detail({ data: { email: selected.email } }),
  });

  const refreshDetail = () => qc.invalidateQueries({ queryKey: ["admin-customer", selected?.email] });

  const onAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await addNote({ data: { email: selected.email, note: noteText.trim() } });
      setNoteText("");
      toast.success("ההערה נשמרה");
      refreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בשמירת ההערה");
    } finally {
      setSavingNote(false);
    }
  };

  const onDeleteNote = async (id: string) => {
    try {
      await delNote({ data: { id } });
      toast.success("ההערה נמחקה");
      refreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה במחיקה");
    }
  };

  const doExport = async () => {
    try {
      const { csv, count } = await exportCsv({ data: { q: debouncedQ || undefined, sort, page: 0 } });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`יוצאו ${count} לקוחות`);
    } catch (e: any) {
      toast.error(e?.message ?? "הייצוא נכשל");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">לקוחות ({total})</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <Input placeholder="חיפוש: שם / אימייל / טלפון" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} className="rounded-md border bg-background px-3 py-2 text-sm">
          <option value="ltv">לפי סך קניות</option>
          <option value="recent">לפי הזמנה אחרונה</option>
          <option value="orders">לפי מס׳ הזמנות</option>
        </select>
        <Button size="sm" variant="outline" onClick={doExport}>
          <Download className="h-4 w-4 ml-1" /> ייצוא CSV
        </Button>
      </div>

      <div className={`rounded-lg border bg-card overflow-x-auto transition-opacity ${isFetching ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-right">
            <th className="p-3">לקוח</th><th className="p-3">קשר</th><th className="p-3">הזמנות</th>
            <th className="p-3">סך קניות</th><th className="p-3">הזמנה אחרונה</th><th></th>
          </tr></thead>
          <tbody>
            {customers.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">
                {debouncedQ ? "אין לקוחות תואמים." : "אין עדיין לקוחות — הם יופיעו כאן עם ההזמנה הראשונה."}
              </td></tr>
            )}
            {customers.map((c: any) => (
              <tr key={c.email} className="border-t">
                <td className="p-3">
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </td>
                <td className="p-3">
                  <div className="flex gap-1.5">
                    <a href={`tel:${c.phone}`} className="rounded-full border p-1.5 hover:bg-muted" title={c.phone}><Phone className="h-3.5 w-3.5" /></a>
                    <a href={waLink(c.phone)} target="_blank" rel="noreferrer" className="rounded-full border p-1.5 hover:bg-muted text-emerald-700" title="WhatsApp"><MessageCircle className="h-3.5 w-3.5" /></a>
                    <a href={`mailto:${c.email}`} className="rounded-full border p-1.5 hover:bg-muted" title={c.email}><Mail className="h-3.5 w-3.5" /></a>
                  </div>
                </td>
                <td className="p-3">{c.orders}{c.paidOrders !== c.orders && <span className="text-xs text-muted-foreground"> ({c.paidOrders} שולמו)</span>}</td>
                <td className="p-3 font-bold">{formatILS(c.ltv)}</td>
                <td className="p-3 text-xs">{new Date(c.lastOrderAt).toLocaleDateString("he-IL")}</td>
                <td className="p-3"><Button size="sm" variant="outline" onClick={() => setSelected(c)}>כרטיס לקוח</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
              <DialogHeader><DialogTitle>{selected.name}</DialogTitle></DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"><Phone className="h-3 w-3" /> {selected.phone}</a>
                  <a href={waLink(selected.phone)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted text-emerald-700"><MessageCircle className="h-3 w-3" /> וואטסאפ</a>
                  <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs hover:bg-muted"><Mail className="h-3 w-3" /> {selected.email}</a>
                  {selected.contactConsent && <span className="text-[11px] rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">אישר/ה יצירת קשר</span>}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">הזמנות</div><div className="text-lg font-bold">{selected.orders}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">סך קניות</div><div className="text-lg font-bold">{formatILS(selected.ltv)}</div></div>
                  <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">אחרונה</div><div className="text-lg font-bold">{new Date(selected.lastOrderAt).toLocaleDateString("he-IL")}</div></div>
                </div>

                {/* Notes */}
                <div className="border-t pt-3">
                  <div className="font-semibold mb-2">הערות פנימיות</div>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder='למשל: "ביקש הקדשה עד חמישי"'
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onAddNote()}
                    />
                    <Button size="sm" disabled={savingNote || !noteText.trim()} onClick={onAddNote}>
                      {savingNote ? "שומר..." : "הוסף"}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {(cust?.notes ?? []).map((n: any) => (
                      <div key={n.id} className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-3 py-2">
                        <div>
                          <div>{n.note}</div>
                          <div className="text-[11px] text-muted-foreground">{new Date(n.created_at).toLocaleString("he-IL")}</div>
                        </div>
                        <button onClick={() => onDeleteNote(n.id)} className="text-muted-foreground hover:text-destructive" title="מחק">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {(cust?.notes ?? []).length === 0 && <div className="text-xs text-muted-foreground">אין הערות עדיין.</div>}
                  </div>
                </div>

                {/* Orders history */}
                <div className="border-t pt-3">
                  <div className="font-semibold mb-2">היסטוריית הזמנות</div>
                  <div className="space-y-2">
                    {(cust?.orders ?? []).map((o: any) => (
                      <div key={o.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Link to="/admin/orders" search={{ q: o.order_number }} className="font-mono text-xs underline text-primary">
                              {o.order_number}
                            </Link>
                            <span className="mx-2 text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString("he-IL")}</span>
                            <span className="text-[11px] rounded-full bg-muted px-2 py-0.5">{PAYMENT_HE[o.payment_status] ?? o.payment_status}</span>
                          </div>
                          <div className="font-bold">{formatILS(Number(o.total))}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(o.order_items ?? []).map((it: any) => `${it.product_name} ×${it.quantity}`).join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
