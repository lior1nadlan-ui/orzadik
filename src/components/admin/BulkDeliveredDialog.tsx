// "סימון מרובה — כבר נמסרו": paid orders that were never marked shipped,
// ticked and closed together. Same effect per order as "כבר נמסרה ללקוח" in
// the order sheet: no "on its way" email, the order is completed, and the
// review request follows a week after the ship date.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { UnshippedOrder } from "@/lib/admin-crm.functions";

const ymdIL = (iso: string | number) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(iso));
const dmIL = (iso: string) =>
  new Date(iso).toLocaleDateString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
  });

export function BulkDeliveredDialog({
  open,
  onOpenChange,
  load,
  submit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  load: () => Promise<UnshippedOrder[]>;
  submit: (
    orders: { order_id: string; shipped_on: string; pickup?: boolean }[],
  ) => Promise<{ done: number; failed: { order_id: string; error: string }[] }>;
}) {
  const [orders, setOrders] = useState<UnshippedOrder[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [dates, setDates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setOrders(null);
    setPicked(new Set());
    setFailed({});
    setError(null);
    load()
      .then((rows) => {
        setOrders(rows);
        // Default ship day: the day it was paid — the earliest it could have left.
        setDates(Object.fromEntries(rows.map((o) => [o.id, ymdIL(o.paidAt ?? o.createdAt)])));
      })
      .catch((e) => setError(e?.message ?? "שגיאה בטעינת ההזמנות"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on open only
  }, [open]);

  const toggle = (id: string) =>
    setPicked((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const run = async () => {
    if (!orders || picked.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const r = await submit(
        orders
          .filter((o) => picked.has(o.id))
          .map((o) => ({ order_id: o.id, shipped_on: dates[o.id], pickup: o.pickup })),
      );
      if (r.failed.length === 0) {
        onOpenChange(false);
        return;
      }
      setFailed(Object.fromEntries(r.failed.map((f) => [f.order_id, f.error])));
      const failedIds = new Set(r.failed.map((f) => f.order_id));
      setOrders((cur) => (cur ?? []).filter((o) => !picked.has(o.id) || failedIds.has(o.id)));
      setPicked(failedIds);
      setError(`${r.done} סומנו, ${r.failed.length} נכשלו — ראו בשורות.`);
    } catch (e: any) {
      setError(e?.message ?? "הסימון נכשל");
    } finally {
      setBusy(false);
    }
  };

  const today = ymdIL(Date.now());
  const all = orders ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>הזמנות ששולמו ולא סומנו כנשלחו</DialogTitle>
          <DialogDescription>
            סמנו את ההזמנות שכבר אצל הלקוח. לכל אחת: תאריך היציאה (ברירת מחדל — יום התשלום). לא
            יישלח מייל "ההזמנה בדרך"; בקשת חוות דעת תצא שבוע אחרי תאריך היציאה.
          </DialogDescription>
        </DialogHeader>

        {!orders && !error ? <p className="text-sm text-muted-foreground">טוען…</p> : null}
        {orders && orders.length === 0 ? (
          <p className="text-sm">אין הזמנות ששולמו וממתינות למשלוח. 🎉</p>
        ) : null}

        {all.length > 0 ? (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={picked.size === all.length}
                onCheckedChange={(v) => setPicked(v ? new Set(all.map((o) => o.id)) : new Set())}
              />
              בחירת הכל ({all.length})
            </label>
            {all.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center gap-3 rounded-md border p-2 text-sm"
              >
                <Checkbox checked={picked.has(o.id)} onCheckedChange={() => toggle(o.id)} />
                <div className="min-w-0 flex-1">
                  <div>
                    <bdi className="font-mono">{o.orderNumber}</bdi> · {o.customerName}
                    {o.pickup ? " · איסוף עצמי" : ""}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    ₪{o.total.toLocaleString("he-IL")} · שולם {o.paidAt ? dmIL(o.paidAt) : "—"}
                  </div>
                  {failed[o.id] ? (
                    <div className="text-xs text-destructive">{failed[o.id]}</div>
                  ) : null}
                </div>
                <Input
                  type="date"
                  className="w-40"
                  value={dates[o.id] ?? ""}
                  min={ymdIL(o.createdAt)}
                  max={today}
                  onChange={(e) => setDates((d) => ({ ...d, [o.id]: e.target.value }))}
                  aria-label="תאריך יציאה"
                />
              </div>
            ))}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button onClick={run} disabled={busy || picked.size === 0}>
            {busy ? "מסמן…" : `סימון ${picked.size} כנמסרו`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
