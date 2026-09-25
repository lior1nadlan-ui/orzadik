import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPackingSlip } from "@/lib/admin-crm.functions";
import { PackingSlip, type PackingSlipOrder } from "@/components/admin/PackingSlip";
import { Button } from "@/components/ui/button";
import { Printer, ArrowRight } from "lucide-react";

/**
 * דף אריזה — the sheet the owner packs one order from, printed on plain A4.
 *
 * WHY: the order dialog is a screen, and packing happens at a table. Engraving
 * text copied by hand from a phone is where a wrong letter gets onto a tallit
 * bag, and a gift dedication read off the screen is where it gets left out of
 * the parcel. This page puts every line on paper with a box to tick.
 *
 *   • NO PRICES — deliberately not even fetched (see getPackingSlip). The
 *     sheet goes in the box, and the box is often a gift.
 *   • The personal text of each line is printed large, in its own column, and
 *     marked — it is the one field that must be checked letter by letter.
 *   • A gift dedication gets a cut-out card at the foot of the page, set in the
 *     display face, ready to go into the parcel.
 *
 * Printing: every element that neither is the slip, sits inside it, nor
 * contains it is removed (`display:none` via :has) — removed rather than
 * hidden, because the admin sidebar and the site header belong to parent
 * layouts and, merely hidden, still pushed two blank pages after the slip.
 * The slip's ancestors are flattened to plain boxes. Black on white, no
 * backgrounds, so it prints on any office printer. Checked as a real A4 PDF.
 *
 * `admin.orders_` — the trailing underscore keeps this route out of the orders
 * page's own layout (that page renders no <Outlet/>), while still sitting under
 * /admin and its admin-only beforeLoad.
 */
export const Route = createFileRoute("/admin/orders_/$orderId/print")({
  component: PackingSlipPage,
  head: () => ({ meta: [{ title: "דף אריזה" }, { name: "robots", content: "noindex, nofollow" }] }),
});

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 14mm; }
  /* Remove everything that is neither the slip, inside it, nor one of its
     ancestors — removed, not just hidden, so the admin sidebar and the site
     chrome cannot push blank pages after it. */
  body *:not(:has(.print-slip)):not(.print-slip):not(.print-slip *) { display: none !important; }
  /* The ancestors stay, flattened to plain boxes. */
  body *:has(.print-slip) {
    display: block !important; position: static !important; margin: 0 !important;
    padding: 0 !important; border: 0 !important; box-shadow: none !important;
    min-height: 0 !important; height: auto !important; width: auto !important;
    max-width: none !important; overflow: visible !important; background: none !important;
  }
  body { background: #fff !important; }
  .print-slip { max-width: none !important; border: 0 !important; padding: 0 !important; }
}
`;

function PackingSlipPage() {
  const { orderId } = Route.useParams();
  const load = useServerFn(getPackingSlip);
  const {
    data: o,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["admin-packing-slip", orderId],
    queryFn: () => load({ data: { id: orderId } }),
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">טוען…</p>;
  if (error || !o) {
    return <p className="text-sm text-destructive">{(error as Error)?.message ?? "לא נמצא"}</p>;
  }

  return (
    <div>
      <style>{PRINT_CSS}</style>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/admin/orders"
          search={{ q: o.order_number ?? undefined }}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" /> חזרה להזמנות
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="h-4 w-4 ml-1" /> הדפסה
        </Button>
      </div>

      {o.payment_status !== "paid" && (
        <div className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          שים לב: ההזמנה הזו עדיין לא שולמה.
        </div>
      )}

      <PackingSlip o={o as PackingSlipOrder} />
    </div>
  );
}
