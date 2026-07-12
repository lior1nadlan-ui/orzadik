import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getOrderConfirmation } from "@/lib/order.functions";
import { formatILS, useCart } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock } from "lucide-react";

export const Route = createFileRoute("/order/$id")({
  component: OrderConfirmationPage,
  head: () => ({
    meta: [
      { title: "אישור הזמנה — אור זרוע לצדיק" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function OrderConfirmationPage() {
  const { id } = Route.useParams();
  const loadOrder = useServerFn(getOrderConfirmation);
  const { clear } = useCart();
  const { data: order, isLoading, isError } = useQuery({
    queryKey: ["order", id],
    queryFn: () => loadOrder({ data: { order_id: id } }),
    retry: false,
  });

  const isPaid = order?.payment_status === "paid";

  // Clear the cart only once payment is confirmed — never before.
  useEffect(() => {
    if (isPaid) clear();
  }, [isPaid, clear]);

  if (isLoading) return <div className="container mx-auto px-4 py-20 text-center">טוען...</div>;
  if (isError || !order) {
    return (
      <div className="container mx-auto px-4 py-20 text-center space-y-4">
        <p className="text-muted-foreground">ההזמנה לא נמצאה או שאין לך הרשאה לצפות בה.</p>
        <Link to="/shop"><Button variant="outline">חזרה לחנות</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-14 max-w-2xl">
      <div className="text-center mb-8">
        {isPaid ? (
          <>
            <CheckCircle2 className="h-16 w-16 text-accent mx-auto mb-4" />
            <h1 className="font-display text-3xl font-bold">תודה על ההזמנה!</h1>
            <p className="text-muted-foreground mt-2">מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span></p>
            <p className="text-sm text-muted-foreground mt-1">קיבלנו את התשלום. אישור הזמנה יישלח לדוא"ל שלך, וניצור עמך קשר לתיאום המשלוח.</p>
          </>
        ) : (
          <>
            <Clock className="h-16 w-16 text-[#A8862A] mx-auto mb-4" />
            <h1 className="font-display text-3xl font-bold">ההזמנה התקבלה — ממתינה לתשלום</h1>
            <p className="text-muted-foreground mt-2">מספר הזמנה: <span className="font-mono font-bold">{order.order_number}</span></p>
            <p className="text-sm text-muted-foreground mt-1">טרם נקלט תשלום עבור הזמנה זו. אם ביטלת בטעות, ניתן לחזור לעגלה ולהשלים את התשלום, או ליצור איתנו קשר בוואטסאפ.</p>
            <div className="mt-4">
              <Link to="/cart"><Button className="bg-[#D4AF37] hover:bg-[#A8862A] text-white">חזרה לעגלה להשלמת התשלום</Button></Link>
            </div>
          </>
        )}
      </div>
      <div className="rounded-lg border bg-card p-6">
        <h2 className="font-display text-xl font-bold mb-4">פירוט ההזמנה</h2>
        <div className="space-y-2 mb-4">
          {order.order_items.map((it: any) => (
            <div key={it.id} className="flex justify-between text-sm">
              <span>{it.product_name} × {it.quantity}</span>
              <span className="font-medium">{formatILS(Number(it.line_total))}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-lg border-t pt-3">
          <span className="font-bold">סך הכל</span>
          <span className="font-bold text-primary">{formatILS(Number(order.total))}</span>
        </div>
      </div>
      <div className="mt-6 text-center">
        <Link to="/shop"><Button variant="outline">המשך לקנות</Button></Link>
      </div>
    </div>
  );
}
