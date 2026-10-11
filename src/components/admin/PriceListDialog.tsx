// "עדכון מחירים לפי מק״ט" — paste SKU + price lines (straight from Excel or a
// supplier list), check the preview, apply as one undoable batch.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { parsePriceList, type PriceListParse } from "@/lib/price-list";
import type { PriceListMatch } from "@/lib/admin-products.functions";

type Preview = { changes: PriceListMatch[]; unchanged: number; notFound: string[] };

const money = (n: number) => `₪${n.toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;

export function PriceListDialog({
  open,
  onOpenChange,
  preview,
  apply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preview: (rows: { sku: string; price: number; salePrice?: number | null }[]) => Promise<Preview>;
  apply: (items: { id: string; price: number; salePrice?: number | null }[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<PriceListParse | null>(null);
  const [result, setResult] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setText("");
    setParsed(null);
    setResult(null);
    setError(null);
  };

  const check = async () => {
    const p = parsePriceList(text);
    setParsed(p);
    setResult(null);
    setError(null);
    if (p.rows.length === 0) return;
    setBusy(true);
    try {
      setResult(await preview(p.rows.map(({ line: _line, ...row }) => row)));
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בבדיקת הרשימה");
    } finally {
      setBusy(false);
    }
  };

  const run = async () => {
    if (!result?.changes.length) return;
    setBusy(true);
    try {
      await apply(
        result.changes.map((c) =>
          c.newSalePrice === undefined
            ? { id: c.id, price: c.newPrice }
            : { id: c.id, price: c.newPrice, salePrice: c.newSalePrice },
        ),
      );
      reset();
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בעדכון המחירים");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>עדכון מחירים לפי מק״ט</DialogTitle>
          <DialogDescription>
            הדביקו שורה לכל מוצר: מק״ט ומחיר קטלוגי, ואפשר גם עמודה שלישית של מחיר קודם (מחוק) — 0
            מוחק אותו. אפשר להעתיק עמודות מאקסל, וגם להדביק בחזרה גיליון שהורד ב״ייצוא לאקסל״. לפני
            העדכון תוצג רשימה לבדיקה, וכל העדכון יירשם בהיסטוריית המחירים עם אפשרות ביטול.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <Textarea
            dir="ltr"
            rows={10}
            placeholder={"UK82172\t69\nUK11631\t43\t61"}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setParsed(null);
            }}
            className="font-mono text-sm"
          />
        ) : null}

        {parsed && (parsed.errors.length > 0 || parsed.conflicts.length > 0) ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
            {parsed.errors.map((e) => (
              <p key={e.line}>
                שורה {e.line}: {e.error} — <span dir="ltr">{e.text}</span>
              </p>
            ))}
            {parsed.conflicts.length > 0 ? (
              <p>
                מק״ט שמופיע פעמיים עם מחירים שונים (דולג):{" "}
                <span dir="ltr">{parsed.conflicts.join(", ")}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {result ? (
          <div className="space-y-3 text-sm">
            <p>
              <b>{result.changes.length}</b> מוצרים ישתנו
              {result.unchanged ? ` · ${result.unchanged} כבר במחיר הזה` : ""}
              {result.notFound.length ? ` · ${result.notFound.length} מק״טים לא נמצאו` : ""}
            </p>
            {result.changes.length > 0 ? (
              <div className="max-h-72 overflow-y-auto rounded-md border">
                <table className="w-full text-right">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="p-2">מוצר</th>
                      <th className="p-2">מק״ט</th>
                      <th className="p-2">לפני</th>
                      <th className="p-2">אחרי</th>
                      <th className="p-2">מחיר קודם (מחוק)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.changes.map((c) => {
                      const big =
                        c.oldPrice > 0 && Math.abs(c.newPrice - c.oldPrice) / c.oldPrice >= 0.5;
                      return (
                        <tr key={c.id} className="border-t">
                          <td className="p-2">
                            {c.name}
                            {!c.isActive ? (
                              <span className="text-muted-foreground"> (לא פעיל)</span>
                            ) : null}
                          </td>
                          <td className="p-2" dir="ltr">
                            {c.sku}
                          </td>
                          <td className="p-2">{money(c.oldPrice)}</td>
                          <td className={big ? "p-2 font-semibold text-destructive" : "p-2"}>
                            {money(c.newPrice)}
                          </td>
                          <td className="p-2">
                            {c.newSalePrice === undefined ? (
                              <span className="text-muted-foreground">
                                {c.oldSalePrice === null ? "—" : money(c.oldSalePrice)}
                              </span>
                            ) : (
                              <>
                                {c.oldSalePrice === null ? "—" : money(c.oldSalePrice)} ←{" "}
                                {c.newSalePrice === null ? "הוסר" : money(c.newSalePrice)}
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}
            {result.changes.some(
              (c) => c.oldPrice > 0 && Math.abs(c.newPrice - c.oldPrice) / c.oldPrice >= 0.5,
            ) ? (
              <p className="text-destructive">
                מחירים באדום משתנים ב-50% או יותר — כדאי לבדוק שאין טעות.
              </p>
            ) : null}
            {result.notFound.length > 0 ? (
              <p className="text-muted-foreground">
                לא נמצאו: <span dir="ltr">{result.notFound.join(", ")}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter className="gap-2">
          {result ? (
            <>
              <Button variant="outline" onClick={() => setResult(null)} disabled={busy}>
                חזרה לעריכה
              </Button>
              <Button onClick={run} disabled={busy || result.changes.length === 0}>
                {busy ? "מעדכן…" : `עדכון ${result.changes.length} מחירים`}
              </Button>
            </>
          ) : (
            <Button onClick={check} disabled={busy || !text.trim()}>
              {busy ? "בודק…" : "בדיקה"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
