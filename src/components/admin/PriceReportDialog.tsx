// "דוח שינויי מחיר" — every logged price change between two dates, with an
// Excel download. Reads product_price_changes (the price ledger).

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import { getEffectivePrice } from "@/lib/pricing";
import type { PriceReportRow } from "@/lib/admin-products.functions";

const SOURCE_HE: Record<string, string> = {
  edit: "עריכה",
  inline: "טבלה",
  bulk_set: "מחיר אחיד",
  bulk_pct: "שינוי באחוזים",
  price_list: "לפי מק״ט",
  customer_price_fix: "תיקון למחיר ללקוח",
  sale_start: "תחילת מבצע",
  sale_end: "סיום מבצע",
  undo: "ביטול",
};

const todayIL = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date());

const whenIL = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

// What the customer paid before / after (the ledger stores catalog prices).
const money = (n: number | null) =>
  n === null ? "—" : `₪${getEffectivePrice(n).toLocaleString("he-IL")}`;

export function PriceReportDialog({
  open,
  onOpenChange,
  load,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  load: (range: {
    from: string;
    to: string;
  }) => Promise<{ rows: PriceReportRow[]; truncated: boolean }>;
}) {
  const [from, setFrom] = useState(todayIL);
  const [to, setTo] = useState(todayIL);
  const [report, setReport] = useState<{ rows: PriceReportRow[]; truncated: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      setReport(await load({ from, to: to < from ? from : to }));
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בטעינת הדוח");
    } finally {
      setBusy(false);
    }
  };

  const rows = report?.rows ?? [];
  const products = new Set(rows.map((r) => r.productId)).size;

  const download = () =>
    downloadCsv(
      toCsv(
        ["תאריך ושעה", "מק״ט", "מוצר", "ללקוח לפני", "ללקוח אחרי", "מקור", "בוטל"],
        rows.map((r) => [
          whenIL(r.changedAt),
          r.sku,
          r.name,
          r.oldPrice === null ? null : getEffectivePrice(r.oldPrice),
          r.newPrice === null ? null : getEffectivePrice(r.newPrice),
          SOURCE_HE[r.source] ?? r.source,
          r.undone ? "כן" : "",
        ]),
      ),
      `price-changes-${from}_${to}.csv`,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>דוח שינויי מחיר</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>מתאריך</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>עד תאריך</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={run} disabled={busy || !from || !to}>
            {busy ? "טוען…" : "הצגה"}
          </Button>
          {rows.length > 0 ? (
            <Button variant="outline" onClick={download}>
              הורדה לאקסל
            </Button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {report ? (
          rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין שינויי מחיר בתאריכים האלה.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <b>{rows.length}</b> שינויים ב-<b>{products}</b> מוצרים
                {report.truncated ? " (מוצגים 5,000 הראשונים — צמצמו את הטווח)" : ""}
              </p>
              <div className="max-h-[55vh] overflow-y-auto rounded-md border">
                <table className="w-full text-right">
                  <thead className="sticky top-0 bg-muted text-xs">
                    <tr>
                      <th className="p-2">מתי</th>
                      <th className="p-2">מוצר</th>
                      <th className="p-2">מק״ט</th>
                      <th className="p-2">ללקוח לפני</th>
                      <th className="p-2">ללקוח אחרי</th>
                      <th className="p-2">מקור</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr
                        key={i}
                        className={
                          r.undone ? "border-t text-muted-foreground line-through" : "border-t"
                        }
                      >
                        <td className="whitespace-nowrap p-2">{whenIL(r.changedAt)}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2" dir="ltr">
                          {r.sku}
                        </td>
                        <td className="p-2">{money(r.oldPrice)}</td>
                        <td className="p-2">{money(r.newPrice)}</td>
                        <td className="p-2">{SOURCE_HE[r.source] ?? r.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
