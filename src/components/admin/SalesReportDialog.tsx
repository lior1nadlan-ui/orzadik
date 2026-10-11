// "דוח מכירות לפי מוצר" — what sold, how many and for how much, in a date
// range (paid orders only), with an Excel download.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import type { SalesReportRow } from "@/lib/admin-products.functions";

type Report = { rows: SalesReportRow[]; orders: number; revenue: number; units: number };

const ymdIL = (d: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(d);
const money = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 0 })}`;

const PRESETS: { label: string; days: number }[] = [
  { label: "היום", days: 0 },
  { label: "7 ימים", days: 6 },
  { label: "30 יום", days: 29 },
  { label: "שנה", days: 364 },
];

export function SalesReportDialog({
  open,
  onOpenChange,
  load,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  load: (range: { from: string; to: string }) => Promise<Report>;
}) {
  const [from, setFrom] = useState(() => ymdIL(new Date(Date.now() - 29 * 86400_000)));
  const [to, setTo] = useState(() => ymdIL(new Date()));
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (f = from, t = to) => {
    setBusy(true);
    setError(null);
    try {
      setReport(await load({ from: f, to: t < f ? f : t }));
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בטעינת הדוח");
    } finally {
      setBusy(false);
    }
  };

  const preset = (days: number) => {
    const t = ymdIL(new Date());
    const f = ymdIL(new Date(Date.now() - days * 86400_000));
    setFrom(f);
    setTo(t);
    void run(f, t);
  };

  const download = () =>
    report &&
    downloadCsv(
      toCsv(
        ["מוצר", "מק״ט", "יחידות", "הזמנות", "הכנסה"],
        report.rows.map((r) => [r.name, r.sku, r.qty, r.orders, r.revenue]),
      ),
      `sales-${from}_${to}.csv`,
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>דוח מכירות לפי מוצר</DialogTitle>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              size="sm"
              variant="outline"
              onClick={() => preset(p.days)}
              disabled={busy}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>מתאריך</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div>
            <Label>עד תאריך</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          <Button onClick={() => void run()} disabled={busy || !from || !to}>
            {busy ? "טוען…" : "הצגה"}
          </Button>
          {report && report.rows.length > 0 ? (
            <Button variant="outline" onClick={download}>
              הורדה לאקסל
            </Button>
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {report ? (
          report.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">אין מכירות ששולמו בתאריכים האלה.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <b>{money(report.revenue)}</b> · {report.orders} הזמנות · {report.units} יחידות ·{" "}
                {report.rows.length} מוצרים
              </p>
              <div className="max-h-[55vh] overflow-y-auto rounded-md border">
                <table className="w-full text-right">
                  <thead className="sticky top-0 bg-muted text-xs">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">מוצר</th>
                      <th className="p-2">מק״ט</th>
                      <th className="p-2">יחידות</th>
                      <th className="p-2">הזמנות</th>
                      <th className="p-2">הכנסה</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows.map((r, i) => (
                      <tr key={r.productId ?? r.name} className="border-t">
                        <td className="p-2 text-muted-foreground">{i + 1}</td>
                        <td className="p-2">{r.name}</td>
                        <td className="p-2" dir="ltr">
                          {r.sku}
                        </td>
                        <td className="p-2">{r.qty}</td>
                        <td className="p-2">{r.orders}</td>
                        <td className="p-2">{money(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                לפי תאריך התשלום, הזמנות ששולמו בלבד (לא כולל זיכויים). ההכנסה היא סכום השורות לפני
                משלוח.
              </p>
            </div>
          )
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
