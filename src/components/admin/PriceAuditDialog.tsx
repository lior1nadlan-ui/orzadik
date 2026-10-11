// "מחירים חשודים" — products whose price is probably a mistake, grouped by
// rule. Tapping a row searches the products table for it, where the price is
// edited inline as usual.

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ISSUE_LABEL, type PriceIssue, type PriceIssueKind } from "@/lib/price-audit";

const ORDER: PriceIssueKind[] = [
  "pack_unit_price",
  "family_outlier",
  "sharp_change",
  "former_hidden",
];

const HELP: Record<PriceIssueKind, string> = {
  pack_unit_price:
    "השם אומר סטנד/סט של הרבה יחידות, אבל המחיר נראה כמו של יחידה אחת. לתקן מחיר או שם.",
  family_outlier: "מוצרים באותו שם בדיוק, וזה רחוק מאוד מהמחיר של השאר.",
  sharp_change: "המחיר השתנה ב-50% או יותר ב-30 הימים האחרונים — לוודא שאין טעות הקלדה.",
  former_hidden:
    "יש מחיר קודם, אבל הוא לא גבוה ממה שהלקוח משלם (אחרי 30% הנחה) — ולכן לא מוצג באתר.",
};

export function PriceAuditDialog({
  open,
  onOpenChange,
  load,
  onPick,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  load: () => Promise<PriceIssue[]>;
  onPick: (issue: PriceIssue) => void;
}) {
  const [issues, setIssues] = useState<PriceIssue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<PriceIssueKind>("pack_unit_price");

  useEffect(() => {
    if (!open) return;
    setIssues(null);
    setError(null);
    load()
      .then((r) => {
        setIssues(r);
        const first = ORDER.find((k) => r.some((i) => i.kind === k));
        if (first) setTab(first);
      })
      .catch((e) => setError(e?.message ?? "שגיאה בבדיקה"));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on open only
  }, [open]);

  const count = (k: PriceIssueKind) => (issues ?? []).filter((i) => i.kind === k).length;
  const rows = (issues ?? []).filter((i) => i.kind === tab);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>מחירים חשודים</DialogTitle>
          <DialogDescription>
            בדיקה אוטומטית של כל המוצרים הפעילים. זו רשימה לבדיקה — לא כל שורה היא טעות. לחיצה על
            מוצר מחפשת אותו בטבלה, ושם משנים מחיר כרגיל.
          </DialogDescription>
        </DialogHeader>

        {!issues && !error ? <p className="text-sm text-muted-foreground">בודק…</p> : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {issues && issues.length === 0 ? (
          <p className="text-sm">לא נמצאו מחירים חשודים. 👌</p>
        ) : null}

        {issues && issues.length > 0 ? (
          <>
            <div className="flex flex-wrap gap-2">
              {ORDER.map((k) => (
                <Button
                  key={k}
                  size="sm"
                  variant={tab === k ? "default" : "outline"}
                  onClick={() => setTab(k)}
                  disabled={count(k) === 0}
                >
                  {ISSUE_LABEL[k]} ({count(k)})
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{HELP[tab]}</p>
            <div className="max-h-[55vh] overflow-y-auto rounded-md border">
              {rows.map((i) => (
                <button
                  key={`${i.kind}-${i.productId}`}
                  type="button"
                  onClick={() => onPick(i)}
                  className="block w-full border-t p-2 text-right text-sm first:border-t-0 hover:bg-muted/50"
                >
                  <div>
                    {i.name}
                    {i.sku ? (
                      <span className="text-muted-foreground" dir="ltr">
                        {" "}
                        {i.sku}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground">{i.detail}</div>
                </button>
              ))}
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
