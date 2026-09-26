// "היסטוריית מחירים" — the last price changes made from the admin, each with
// a one-click undo.
//
// Every inline edit and bulk action is one logged batch
// (product_price_changes). Undo restores only the products whose price is
// still what that batch set, so it can never overwrite a later edit; the
// dialog says how many were skipped for that reason.

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { describePriceBatch } from "@/lib/admin-pricing";

export type HistoryBatch = {
  batchId: string;
  source: string;
  changedAt: string;
  products: number;
  undone: number;
  oldTotal: number;
  newTotal: number;
  sample: string | null;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

export function PriceHistoryDialog({
  open,
  onOpenChange,
  batches,
  loading,
  busyBatch,
  onUndo,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  batches: HistoryBatch[];
  loading: boolean;
  /** The batch currently being undone, if any. */
  busyBatch: string | null;
  onUndo: (batchId: string) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>היסטוריית שינויי מחיר</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          כל שינוי מחיר מהטבלה או מפעולה מרובה נשמר כאן. "בטל" מחזיר את המחירים הקודמים — רק למוצרים
          שמחירם לא שונה שוב מאז.
        </p>
        {loading && <p className="text-sm text-muted-foreground">טוען…</p>}
        {!loading && batches.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            עדיין לא נרשמו שינויי מחיר.
          </p>
        )}
        <ul className="divide-y">
          {batches.map((b) => {
            const fullyUndone = b.undone >= b.products;
            const canUndo = b.source !== "undo" && !fullyUndone;
            return (
              <li key={b.batchId} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p
                    className={`text-sm ${fullyUndone ? "text-muted-foreground line-through" : ""}`}
                  >
                    {describePriceBatch(b)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {when(b.changedAt)}
                    {b.undone > 0 && !fullyUndone && ` · ${b.undone} כבר בוטלו`}
                    {fullyUndone && " · בוטל"}
                  </p>
                </div>
                {canUndo && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busyBatch !== null}
                    onClick={() => onUndo(b.batchId)}
                  >
                    {busyBatch === b.batchId ? "מבטל..." : "בטל"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
