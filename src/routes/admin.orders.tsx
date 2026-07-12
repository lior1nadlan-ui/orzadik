import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatILS } from "@/lib/cart";
import { refundCardcomOrder } from "@/lib/cardcom.functions";
import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/orders")({
  component: AdminOrders,
});

const STATUSES = ["pending", "processing", "shipped", "completed", "cancelled", "refunded"];
const STATUS_HE: Record<string, string> = {
  pending: "ממתינה", processing: "בטיפול", shipped: "נשלחה", completed: "הושלמה", cancelled: "בוטלה", refunded: "זוכתה",
};

function AdminOrders() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<any>(null);
  const [refunding, setRefunding] = useState(false);
  const refundOrder = useServerFn(refundCardcomOrder);

  const doRefund = async (orderId: string) => {
    if (!window.confirm("לבצע זיכוי מלא להזמנה זו? הפעולה אינה הפיכה.")) return;
    setRefunding(true);
    try {
      const r = await refundOrder({ data: { order_id: orderId } });
      toast.success(
        `הזיכוי בוצע בהצלחה${r.newDocumentNumber ? ` — מסמך ${r.newDocumentType ?? ""} מס׳ ${r.newDocumentNumber}` : ""}`,
      );
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (e: any) {
      toast.error(e?.message ?? "הזיכוי נכשל");
    } finally {
      setRefunding(false);
    }
  };

  const { data: orders = [] } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("עודכן");
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">הזמנות ({orders.length})</h1>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-right">
            <th className="p-3">מס׳</th><th className="p-3">לקוח</th><th className="p-3">תאריך</th>
            <th className="p-3">סכום</th><th className="p-3">סטטוס</th><th></th>
          </tr></thead>
          <tbody>
            {orders.map((o: any) => (
              <tr key={o.id} className="border-t">
                <td className="p-3 font-mono text-xs">{o.order_number}</td>
                <td className="p-3"><div>{o.customer_name}</div><div className="text-xs text-muted-foreground">{o.customer_phone}</div></td>
                <td className="p-3 text-xs">{new Date(o.created_at).toLocaleDateString("he-IL")}</td>
                <td className="p-3 font-bold">{formatILS(Number(o.total))}</td>
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

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader><DialogTitle>הזמנה {selected.order_number}</DialogTitle></DialogHeader>
              <div className="space-y-3 text-sm">
                <div><strong>{selected.customer_name}</strong> · {selected.customer_phone} · {selected.customer_email}</div>
                <div>{selected.customer_address}{selected.customer_city ? `, ${selected.customer_city}` : ""}</div>
                {selected.notes && <div className="text-muted-foreground">הערות: {selected.notes}</div>}
                <div className="border-t pt-3 space-y-1">
                  {selected.order_items.map((it: any) => (
                    <div key={it.id} className="flex justify-between">
                      <span>{it.product_name} × {it.quantity}</span>
                      <span className="font-medium">{formatILS(Number(it.line_total))}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between text-lg border-t pt-3 font-bold">
                  <span>סך הכל</span><span className="text-primary">{formatILS(Number(selected.total))}</span>
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
