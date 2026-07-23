import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useCart, formatILS, getEffectivePrice, applyMemberDiscount, lineKey } from "@/lib/cart";
import { useAuth } from "@/lib/auth";
import { placeOrder } from "@/lib/checkout.functions";
import { createCardcomPayment } from "@/lib/cardcom.functions";
import { saveAbandonedCart } from "@/lib/abandoned-cart.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { TrustBadges } from "@/components/cart/TrustBadges";
import { toast } from "sonner";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "תשלום" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function CheckoutPage() {
  const { items, subtotal, subtotalBase, discountAmount, shipping, grandTotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const submitOrder = useServerFn(placeOrder);
  const startPayment = useServerFn(createCardcomPayment);
  const saveCart = useServerFn(saveAbandonedCart);
  const [submitting, setSubmitting] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  // Gift options — free, so none of this touches the summary column below.
  const [isGift, setIsGift] = useState(false);
  const [giftNote, setGiftNote] = useState("");
  const [giftWrap, setGiftWrap] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: user?.email ?? "",
    phone: "",
    address: "",
    city: "",
    notes: "",
  });

  // On hard loads the session resolves after first render, so the initializer
  // above sees user=null. Pre-fill the email once auth resolves (if still empty).
  useEffect(() => {
    if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email! }));
  }, [user?.email]);

  // Profile + last-order details for returning customers, used to pre-fill the form.
  const { data: prefill } = useQuery({
    queryKey: ["checkout-prefill", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [{ data: profile }, { data: lastOrder }] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, phone")
          .eq("id", user!.id)
          .maybeSingle(),
        supabase
          .from("orders")
          .select("customer_phone, customer_address, customer_city")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return { profile, lastOrder };
    },
  });

  // Same one-shot guard as the email pre-fill above: fill each field only
  // while it is still empty, so user-typed values are never overwritten.
  useEffect(() => {
    if (!prefill) return;
    const { profile, lastOrder } = prefill;
    setForm((f) => ({
      ...f,
      name: f.name || (profile?.full_name ?? ""),
      phone: f.phone || (profile?.phone ?? lastOrder?.customer_phone ?? ""),
      city: f.city || (lastOrder?.customer_city ?? ""),
      address: f.address || (lastOrder?.customer_address ?? ""),
    }));
  }, [prefill]);

  // Signed-in users are auto-enrolled as members
  const isMember = !!user;
  const memberSubtotal = applyMemberDiscount(subtotal, isMember);
  const memberSavings = subtotal - memberSubtotal;
  const finalTotal = memberSubtotal + shipping;

  // Save abandoned-cart snapshot 2s after the user types a valid email
  const lastSavedRef = useRef<string>("");
  useEffect(() => {
    const email = form.email.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
    if (items.length === 0) return;
    const key = `${email}|${items.length}|${subtotal}`;
    if (lastSavedRef.current === key) return;
    const t = setTimeout(() => {
      lastSavedRef.current = key;
      saveCart({
        data: {
          email,
          name: form.name || null,
          subtotal,

          items: items.map((i) => ({
            product_id: i.productId,
            name: i.name,
            price: i.price,
            quantity: i.quantity,
            thumbnail: i.thumbnail,
            slug: i.slug,
          })),
        },
      }).catch(() => {});
    }, 2000);
    return () => clearTimeout(t);
  }, [form.email, form.name, items, subtotal, user?.id, saveCart]);


  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="mb-4">העגלה ריקה.</p>
        <Link to="/shop"><Button>חזרה לחנות</Button></Link>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactConsent) {
      toast.error("יש לאשר יצירת קשר לצורך טיפול בהזמנה");
      return;
    }
    setSubmitting(true);
    try {
      const result = await submitOrder({
        data: {
          customer_name: form.name,
          customer_email: form.email,
          customer_phone: form.phone,
          customer_address: form.address,
          customer_city: form.city || null,
          notes: form.notes || null,
          contact_consent: contactConsent,
          is_gift: isGift,
          gift_note: isGift ? giftNote || null : null,
          gift_wrap: isGift ? giftWrap : false,
          items: items.map((i) => ({

            product_id: i.productId,
            quantity: i.quantity,
            variant_id: i.variantId ?? null,
            custom_text: i.customText ?? null,
            custom_method: i.customMethod ?? null,
          })),


        },
      });

      // Create Cardcom payment page and redirect.
      // NOTE: do NOT clear the cart here — if the customer abandons or the
      // payment fails, they must return to a full cart and retry. The cart is
      // cleared only after a confirmed `paid` status, on the order page.
      try {
        const pay = await startPayment({
          data: { order_id: result.id },
        });
        window.location.href = pay.url;
        return;
      } catch (payErr: any) {
        toast.error(payErr.message ?? "לא הצלחנו לפתוח את עמוד התשלום. ניצור איתך קשר.");
        navigate({ to: "/order/$id", params: { id: result.id } });
      }
    } catch (err: any) {
      toast.error(err.message ?? "שגיאה בשליחת ההזמנה");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
      <form onSubmit={onSubmit} className="lg:col-span-2 space-y-4">
        <h1 className="font-display text-3xl font-bold mb-4">פרטי הזמנה</h1>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">שם מלא *</Label>
            <Input id="name" required autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="email">אימייל *</Label>
            <Input id="email" type="email" required autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <p className="text-[11px] text-muted-foreground mt-1">
              אם תזין דוא"ל ולא תשלים את ההזמנה, ייתכן שנשמור את הפרטים זמנית כדי לאפשר את השלמתה. ראו <Link to="/privacy" className="underline hover:text-accent">מדיניות פרטיות</Link>.
            </p>
          </div>
          <div>
            <Label htmlFor="phone">טלפון *</Label>
            <Input id="phone" required autoComplete="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="city">עיר</Label>
            <Input id="city" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">כתובת מלאה *</Label>
            <Input id="address" required autoComplete="street-address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">הערות להזמנה</Label>
            <Textarea id="notes" autoComplete="off" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {/* Gift options — free of charge. Nothing here feeds the price column. */}
        <div className="rounded-md border border-[#D4AF37]/40 bg-[#FAF6E9]/60 p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isGift} onCheckedChange={(v) => setIsGift(v === true)} />
            <span className="text-sm font-medium">🎁 זו מתנה</span>
            <span className="text-xs text-[#A8862A]">ללא תוספת מחיר</span>
          </label>
          {isGift && (
            <div className="mt-3 space-y-3 border-t border-[#D4AF37]/30 pt-3">
              <div>
                <Label htmlFor="gift-note">הקדשה אישית (תודפס ותצורף למתנה)</Label>
                <Textarea
                  id="gift-note"
                  rows={3}
                  maxLength={300}
                  autoComplete="off"
                  value={giftNote}
                  onChange={(e) => setGiftNote(e.target.value)}
                  placeholder="למשל: מזל טוב באהבה, משפחת כהן"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {giftNote.length}/300
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={giftWrap} onCheckedChange={(v) => setGiftWrap(v === true)} />
                <span className="text-sm">עטיפת מתנה חגיגית — בחינם</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                העטיפה וההקדשה ניתנות ללא עלות ואינן משפיעות על סכום ההזמנה.
              </p>
            </div>
          )}
        </div>

        <label className="flex items-start gap-2 rounded-md border border-[#D4AF37]/40 bg-[#FAF6E9] p-3 cursor-pointer">
          <Checkbox
            checked={contactConsent}
            onCheckedChange={(v) => setContactConsent(v === true)}
            className="mt-0.5"
            required
          />
          <span className="text-xs leading-relaxed text-foreground/90">
            אני מאשר/ת שלצורך טיפול בהזמנה — אישור, תיאום משלוח ובירורים — ייצרו עמי קשר
            בטלפון או בדוא"ל שמסרתי. הפרטים נדרשים להשלמת ההזמנה ואינם משמשים לדיוור שיווקי
            ללא הסכמה נפרדת.
          </span>
        </label>
        <PrivacyNotice context="checkout" />
        {(
          <Button type="submit" size="lg" disabled={submitting || !contactConsent} className="w-full bg-[#D4AF37] hover:bg-[#A8862A] text-white">
            {submitting ? "טוען..." : `המשך לתשלום · ${formatILS(finalTotal)}`}
          </Button>
        )}
      </form>
      <div className="rounded-lg border bg-card p-6 h-fit sticky top-20">
        <h2 className="font-display text-xl font-bold mb-4">סיכום</h2>
        <div className="space-y-2 mb-4">
          {items.map((i) => (
            <div key={lineKey(i)} className="text-sm">
              <div className="flex justify-between">
                <span className="line-clamp-1">{i.name} × {i.quantity}</span>
                <span className="font-medium whitespace-nowrap mr-2">{formatILS(getEffectivePrice(i.price) * i.quantity)}</span>
              </div>
              {i.variantLabel && (
                <div className="text-xs text-muted-foreground mt-1">גודל: {i.variantLabel}</div>
              )}
              {i.customText && (
                <div className="text-xs text-[#A8862A]">
                  ✦ {i.customMethod === "laser" ? "חריטת לייזר" : "רקמה"}: {i.customText}
                </div>
              )}
            </div>
          ))}
        </div>
        {discountAmount > 0 && (
          <>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>מחיר מקורי</span>
              <span className="line-through">{formatILS(subtotalBase)}</span>
            </div>
            <div className="flex justify-between text-xs text-[#A8862A] font-medium mb-2">
              <span>הנחת מבצע</span>
              <span>-{formatILS(discountAmount)}</span>
            </div>
          </>
        )}
        {isMember && memberSavings > 0 && (
          <div className="flex justify-between text-xs text-[#A8862A] font-medium mb-2">
            <span>✦ הנחת חבר מועדון (5%)</span>
            <span>-{formatILS(memberSavings)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm mb-2">
          <span className="text-muted-foreground">משלוח</span>
          <span>{formatILS(shipping)}</span>
        </div>
        <div className="flex justify-between text-lg border-t pt-3">
          <span className="font-bold">סך הכל</span>
          <span className="font-bold text-[#A8862A]">{formatILS(finalTotal)}</span>
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">כל המחירים בשקלים (₪) וכוללים מע"מ.</p>
        {!isMember && (
          <div className="mt-3 rounded-md border border-[#D4AF37]/30 bg-[#FAF6E9] p-3 text-xs">
            <Link to="/auth" className="font-semibold text-[#A8862A] hover:underline">
              הצטרפו בחינם כחבר מועדון
            </Link>
            <span className="text-foreground/80"> וקבלו 5% הנחה נוספת על ההזמנה הזו</span>
          </div>
        )}

        {/* Trust signals — reduce checkout anxiety */}
        <TrustBadges />
      </div>
    </div>
  );
}
