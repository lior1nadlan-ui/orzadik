import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  useCart,
  formatILS,
  getEffectivePrice,
  applyMemberDiscount,
  getShipping,
  lineKey,
  type CartItem,
} from "@/lib/cart";
import { useCartRevalidation, isBlocking } from "@/lib/cart-revalidation";
import { trackBeginCheckout } from "@/lib/analytics";
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
import { Lock } from "lucide-react";
import { toast } from "sonner";

// Server/transport errors can carry an English message ("Failed to fetch"),
// which is truthy and would otherwise slip past a `?? fallback`. Show the raw
// message only when it is actually Hebrew — i.e. one of our own user-facing
// thrown errors — and fall back to a Hebrew message the shopper can act on
// for anything else.
const hebrewOrFallback = (msg: unknown, fallback: string) =>
  typeof msg === "string" && /[\u0590-\u05FF]/.test(msg) ? msg : fallback;

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
  head: () => ({ meta: [{ title: "תשלום" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function CheckoutPage() {
  const { items, subtotal } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const submitOrder = useServerFn(placeOrder);
  const startPayment = useServerFn(createCardcomPayment);
  const saveCart = useServerFn(saveAbandonedCart);
  const [submitting, setSubmitting] = useState(false);
  // Set only in the instant between "CardCom gave us a URL" and the browser
  // actually leaving. Purely cosmetic — nothing depends on it.
  const [redirecting, setRedirecting] = useState(false);
  const [contactConsent, setContactConsent] = useState(false);
  // Optional and unchecked by default — never bundled with the required
  // operational consent above it.
  const [marketingConsent, setMarketingConsent] = useState(false);
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
  // Inline field errors (Hebrew) + a ref to the required-consent checkbox so a
  // submit blocked on missing consent can bring it into view and focus it.
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Persistent, screen-reader-announced failure banner shown above the submit
  // CTA. Complements the transient toast, which a returning shopper can miss.
  const [submitError, setSubmitError] = useState<string | null>(null);
  const consentRef = useRef<HTMLButtonElement>(null);

  // Update one field and clear its inline error as the shopper corrects it.
  const setField = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: "" } : prev));
  };

  // Lightweight validation for the required fields. Native `required` stays on
  // each input for semantics/a11y, but the <form> is noValidate so THESE Hebrew
  // messages — not the browser's default bubbles — are what the shopper sees.
  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "יש להזין שם מלא";
    const email = form.email.trim();
    if (!email) e.email = 'יש להזין כתובת דוא"ל';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'כתובת הדוא"ל אינה תקינה';
    if (!form.phone.trim()) e.phone = "יש להזין מספר טלפון";
    // Permissive sanity check: strip non-digits and reject only the obviously
    // too-short. Real IL numbers carry >= 9 digits; do NOT tighten this into a
    // strict format check that could reject a valid number.
    else if (form.phone.replace(/\D/g, "").length < 9) e.phone = "מספר הטלפון אינו תקין";
    if (!form.address.trim()) e.address = "יש להזין כתובת מלאה למשלוח";
    return e;
  };

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
          // `is_member` is the SAME flag the server reads when it prices the
          // order — see placeOrder() in src/lib/checkout.functions.ts.
          .select("full_name, phone, is_member")
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

  // Membership is decided by the SERVER: placeOrder() re-reads profiles.is_member
  // and Cardcom is charged the total it computes. Quoting from `!!user` instead
  // meant a signed-in non-member was shown less than they were about to pay, so
  // read the authoritative flag here. Unknown (anonymous, or the profile query
  // still in flight) ⇒ false, i.e. the quote is never lower than the charge.
  const isMember = !!prefill?.profile?.is_member;

  // Revalidate prices/stock against the catalog (shared with /cart) — the cart
  // is localStorage-backed and can be days stale, while placeOrder() re-reads DB
  // prices and THROWS on an out-of-stock/inactive line. Without this, buy-now and
  // the mini-cart (which skip the /cart block gate) could quote a stale total and
  // then hard-reject after the whole form is filled. Empty during SSR / on read
  // failure, so checkout behaves exactly as before when the check is unavailable.
  const { checks, blockedCount } = useCartRevalidation(items);
  // The charged price of a line: the revalidated one once known, the stored one
  // until then (mirrors /cart's linePrice).
  const linePrice = (item: CartItem) => {
    const c = checks.get(lineKey(item));
    return c?.kind === "price" ? c.current : getEffectivePrice(item.price);
  };
  // Sum of the orderable lines at their current price — a line placeOrder() would
  // reject (blocking) cannot be part of any amount the customer is charged, so it
  // is excluded, exactly like /cart. This makes the CTA amount equal the Cardcom
  // charge even when a product was repriced after it was added.
  const itemsTotal = items.reduce((s, i) => {
    const c = checks.get(lineKey(i));
    if (c && isBlocking(c)) return s;
    return s + linePrice(i) * i.quantity;
  }, 0);
  const memberSubtotal = applyMemberDiscount(itemsTotal, isMember);
  const memberBenefit = itemsTotal - memberSubtotal;
  // Same helper + input as the server and /cart (SHIPPING_FLAT on a positive
  // post-member subtotal), computed from the revalidated subtotal rather than the
  // stale cart's shipping so a fully-blocked cart never quotes a phantom fee.
  const shipping = getShipping(memberSubtotal);
  const finalTotal = memberSubtotal + shipping;
  // Nothing here can actually be ordered (every line is one placeOrder() would
  // reject): itemsTotal — and with it משלוח and סך הכל — collapses to 0. Printing
  // "סך הכל ₪0" over visible product rows reads as "free", so the numeric
  // breakdown is withheld (mirrors /cart). blockedCount is 0 while the check
  // loads and if it failed, so the fail-open path keeps the ordinary summary.
  const nothingOrderable = blockedCount > 0 && itemsTotal === 0;

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
      <div className="container mx-auto px-4 py-20">
        <div className="glass mx-auto max-w-lg px-6 py-14 text-center">
          <p className="mb-4">העגלה ריקה.</p>
          <Link to="/shop"><Button className="press">חזרה לחנות</Button></Link>
        </div>
      </div>
    );
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Re-entrancy guard: the disabled pay button blocks mouse clicks, but Enter
    // in any input re-fires submit during the multi-second placeOrder→startPayment
    // window. Bail before doing any work. (preventDefault stays first so a
    // re-entrant Enter can never fall through to a native form navigation.)
    if (submitting) return;
    // A retry starts clean: drop any prior persistent failure banner.
    setSubmitError(null);
    // 1) Inline field validation — surface Hebrew errors and jump to the first.
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      const firstKey = (["name", "email", "phone", "address"] as const).find(
        (k) => fieldErrors[k],
      );
      if (firstKey) {
        const el = document.getElementById(firstKey);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
        (el as HTMLElement | null)?.focus();
      }
      return;
    }
    // 2) Required operational consent. The pay button stays ENABLED so this path
    // is reachable — fire the toast AND bring the checkbox into view + focus it,
    // instead of leaving the button silently disabled far below the form.
    if (!contactConsent) {
      toast.error("יש לאשר יצירת קשר לצורך טיפול בהזמנה");
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      consentRef.current?.focus();
      return;
    }
    // A stale line that placeOrder() would reject (out of stock / inactive).
    // Submitting would hard-fail server-side after all the work above, so stop
    // here and point the shopper to /cart to remove it — checkout has no per-line
    // remove UI. blockedCount is 0 while the check loads and if it failed, so the
    // fail-open path never blocks a legitimate order.
    if (blockedCount > 0) {
      toast.error("יש בעגלה פריט שאזל מהמלאי או אינו זמין. יש להסירו בעמוד העגלה כדי להמשיך.");
      return;
    }
    // GA4 begin_checkout / Meta InitiateCheckout — the shopper committed to
    // paying. Fired before the async order call so an order-server hiccup can't
    // swallow the funnel signal. no-ops on SSR.
    trackBeginCheckout(
      items.map((i) => ({ id: i.productId, name: i.name, price: i.price, quantity: i.quantity })),
    );
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
          marketing_consent: marketingConsent,
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
        // Name the destination BEFORE the domain changes. An unannounced jump to
        // secure.cardcom.solutions is exactly the moment a first-time buyer at a
        // shop with no reviews hesitates. Baymard's finding on redirects is not
        // "avoid them", it is "signpost them" — and unlike embedding the payment
        // page in an iframe, this costs nothing and keeps Apple Pay working.
        setRedirecting(true);
        window.location.href = pay.url;
        return;
      } catch (payErr: any) {
        // The order WAS created — only the payment page failed to open — so the
        // fallback must not claim the order failed. Route via the Hebrew check so
        // an English transport message ("Failed to fetch") can't leak to the UI.
        const msg = hebrewOrFallback(payErr?.message, "לא הצלחנו לפתוח את עמוד התשלום. ניצור איתך קשר.");
        setSubmitError(msg);
        toast.error(msg);
        navigate({ to: "/order/$id", params: { id: result.id } });
      }
    } catch (err: any) {
      const msg = hebrewOrFallback(err?.message, "שגיאה בשליחת ההזמנה, נסו שוב או צרו קשר בוואטסאפ");
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">
      <form onSubmit={onSubmit} noValidate className="lg:col-span-2 space-y-4">
        <h1 className="font-display text-3xl font-bold mb-4">פרטי הזמנה</h1>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="name">שם מלא *</Label>
            <Input id="name" required maxLength={200} enterKeyHint="next" autoComplete="name" aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-error" : undefined} value={form.name} onChange={(e) => setField("name", e.target.value)} />
            {errors.name && <p id="name-error" role="alert" className="mt-1 text-xs text-destructive">{errors.name}</p>}
          </div>
          <div>
            <Label htmlFor="email">אימייל *</Label>
            <Input id="email" type="email" required maxLength={255} enterKeyHint="next" autoCapitalize="none" autoCorrect="off" autoComplete="email" aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-error" : undefined} value={form.email} onChange={(e) => setField("email", e.target.value)} />
            {errors.email && <p id="email-error" role="alert" className="mt-1 text-xs text-destructive">{errors.email}</p>}
            <p className="text-[11px] text-muted-foreground mt-1">
              אם תזין דוא"ל ולא תשלים את ההזמנה, ייתכן שנשמור את הפרטים זמנית כדי לאפשר את השלמתה. ראו <Link to="/privacy" className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent">מדיניות פרטיות</Link>.
            </p>
          </div>
          <div>
            <Label htmlFor="phone">טלפון *</Label>
            <Input id="phone" type="tel" inputMode="tel" required maxLength={50} enterKeyHint="next" autoComplete="tel" aria-invalid={!!errors.phone} aria-describedby={errors.phone ? "phone-error" : undefined} value={form.phone} onChange={(e) => setField("phone", e.target.value)} />
            {errors.phone && <p id="phone-error" role="alert" className="mt-1 text-xs text-destructive">{errors.phone}</p>}
          </div>
          <div>
            <Label htmlFor="city">עיר</Label>
            <Input id="city" maxLength={200} enterKeyHint="next" autoComplete="address-level2" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="address">כתובת מלאה *</Label>
            <Input id="address" required maxLength={500} enterKeyHint="done" autoComplete="street-address" aria-invalid={!!errors.address} aria-describedby={errors.address ? "address-error" : undefined} value={form.address} onChange={(e) => setField("address", e.target.value)} />
            {errors.address && <p id="address-error" role="alert" className="mt-1 text-xs text-destructive">{errors.address}</p>}
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="notes">הערות להזמנה</Label>
            <Textarea id="notes" maxLength={2000} autoComplete="off" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        {/* Gift options — free of charge. Nothing here feeds the price column.
            Glass panel with a decorative gold hairline instead of the old gilded
            parchment block. */}
        <div className="glass glass-gold p-4 [--glass-radius:0.75rem]">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={isGift} onCheckedChange={(v) => setIsGift(v === true)} />
            <span className="text-sm font-medium">🎁 זו מתנה</span>
            <span className="text-xs text-accent">ללא תוספת מחיר</span>
          </label>
          {isGift && (
            <div className="mt-3 space-y-3 border-t border-glass-line pt-3">
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
                {/* Read-back: show the dedication exactly as it will be printed,
                    so the buyer can double-check spelling before paying. */}
                {giftNote.trim() && (
                  <div className="mt-2 rounded-lg hairline-gold bg-secondary/60 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">כך תודפס ההקדשה שתצורף למתנה:</p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">"{giftNote}"</p>
                  </div>
                )}
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

        {/* Still one full-size clickable <label> wrapping the checkbox — only the
            surface changed (gilded parchment → glass + gold hairline). */}
        <label className="flex items-start gap-2 glass glass-gold p-4 [--glass-radius:0.75rem] cursor-pointer">
          <Checkbox
            ref={consentRef}
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
        {/* Marketing consent — lighter, optional, and visually secondary to the
            required consent above so the two can't be mistaken for one. */}
        <label className="flex items-start gap-2 rounded-xl hairline bg-muted/40 p-4 cursor-pointer">
          <Checkbox
            checked={marketingConsent}
            onCheckedChange={(v) => setMarketingConsent(v === true)}
            className="mt-0.5"
          />
          <span className="text-xs leading-relaxed text-muted-foreground">
            אשמח לקבל דיוור שיווקי — מדריכים, תוכן לקראת החגים ועדכונים בדוא"ל (אופציונלי, ניתן להסרה בכל עת).
          </span>
        </label>
        <PrivacyNotice context="checkout" />
        {/* Persistent failure banner directly above the CTA — the toast is
            transient and easy to miss, this stays until the next submit. */}
        {submitError && (
          <p
            role="alert"
            aria-live="assertive"
            className="rounded-xl hairline bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {submitError}
          </p>
        )}
        {/* A blocking line (out of stock / inactive) would make placeOrder()
            reject the whole order. Surface it here and disable the CTA, pointing
            to /cart to remove it — checkout has no per-line remove control. */}
        {blockedCount > 0 && (
          <p role="alert" className="rounded-xl hairline bg-destructive/10 px-4 py-3 text-sm text-destructive">
            יש בעגלה פריט שאזל מהמלאי או אינו זמין כרגע.{" "}
            <Link to="/cart" className="font-semibold underline underline-offset-2">חזרה לעגלה</Link>{" "}
            להסרתו לפני השלמת התשלום.
          </p>
        )}
        <Button type="submit" size="lg" disabled={submitting || blockedCount > 0} aria-busy={submitting} className="press w-full">
          {redirecting
            ? "מעבירים לתשלום מאובטח…"
            : submitting
              ? "יוצרים את ההזמנה…"
              : `המשך לתשלום · ${formatILS(finalTotal)}`}
        </Button>
        {/* Visually-hidden live region: the button-text swap alone isn't reliably
            announced, so read the processing state to assistive tech. */}
        <span className="sr-only" aria-live="polite">
          {redirecting ? "מעבירים אתכם לעמוד התשלום המאובטח של Cardcom" : submitting ? "מעבד את ההזמנה" : ""}
        </span>
        {/* Visible hand-off notice. The domain is about to change to
            secure.cardcom.solutions; saying so first is the difference between an
            expected step and a moment of doubt. */}
        {redirecting && (
          <p className="flex items-center justify-center gap-1.5 text-[13px] leading-relaxed text-accent">
            מעבירים אתכם לעמוד התשלום המאובטח של Cardcom להשלמת התשלום…
          </p>
        )}
        {/* Reassurance AT the submit button — checkout anxiety peaks here, but on
            mobile the full TrustBadges sit in the summary column far below the
            form, so this one line keeps the security promise adjacent to the
            action. Same wording as TrustBadges so the copy can't drift. */}
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 text-accent" />
          תשלום מאובטח בסליקת Cardcom · תקן PCI
        </p>
      </form>
      {/* The summary follows the form in the DOM, with no `order-*` overrides,
          so visual, DOM and focus order agree at every breakpoint: on `lg` the
          form fills the first two (right-hand, in RTL) columns and the summary
          the third; below `lg` the single column stacks in the same sequence.
          The page therefore still opens on its <h1> — this <h2> is a
          sub-section of it and must not precede it. Sticky is lg-only: pinned
          on a phone it would scroll over the fields. */}
      {/* `glass-strong`: pinned panel carrying the live total — 94% white keeps
          --accent at 5.10:1 even over an unknown backdrop. */}
      <div className="glass-strong p-6 h-fit lg:sticky lg:top-20">
        <h2 className="font-display text-xl font-bold mb-4">סיכום</h2>
        <div className="space-y-2 mb-4">
          {items.map((i) => {
            // Mirror /cart: the row amount is the REVALIDATED current price
            // (linePrice), so the itemized rows always sum to סכום פריטים. A
            // blocking line (out of stock / inactive) is greyed and marked
            // "אינו זמין" — it carries no amount because it is excluded from the
            // total placeOrder() will charge.
            const c = checks.get(lineKey(i));
            const blocked = !!c && isBlocking(c);
            return (
              <div key={lineKey(i)} className={blocked ? "text-sm opacity-55" : "text-sm"}>
                <div className="flex justify-between">
                  <span className="line-clamp-1">{i.name} × {i.quantity}</span>
                  {blocked ? (
                    <span className="text-xs text-destructive whitespace-nowrap mr-2">אינו זמין</span>
                  ) : (
                    <span className="font-medium whitespace-nowrap mr-2">{formatILS(linePrice(i) * i.quantity)}</span>
                  )}
                </div>
                {i.variantLabel && (
                  <div className="text-xs text-muted-foreground mt-1">גודל: {i.variantLabel}</div>
                )}
                {c?.kind === "price" && (
                  <div className="text-xs text-muted-foreground mt-1">המחיר עודכן למחיר הנוכחי באתר.</div>
                )}
                {i.customText && (
                  <div className="text-xs text-accent">
                    ✦ {i.customMethod === "laser" ? "חריטת לייזר" : "רקמה"}: {i.customText}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {nothingOrderable ? (
          <p className="border-t border-glass-line pt-3 text-sm text-muted-foreground">
            אין כרגע פריטים שניתן להזמין. יש להסיר את הפריטים שאזלו או שאינם זמינים כדי להמשיך בתשלום.
          </p>
        ) : (
          <>
            {/* Full breakdown of the exact amount Cardcom will charge. Every row is a
                factual component of that number — no percentages, no "before" price
                and no savings claims. סכום פריטים (− הטבת מועדון) + משלוח = סך הכל. */}
            <div className="space-y-2 border-t border-glass-line pt-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">סכום פריטים</span>
                <span className="whitespace-nowrap">{formatILS(itemsTotal)}</span>
              </div>
              {memberBenefit > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">הטבת מועדון</span>
                  <span className="whitespace-nowrap">{formatILS(-memberBenefit)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">משלוח (תעריף אחיד לכל הזמנה)</span>
                <span className="whitespace-nowrap">{formatILS(shipping)}</span>
              </div>
            </div>
            {/* Decorative gold hairline — a gradient rule, not text. */}
            <div className="gold-rule my-4" aria-hidden="true" />
            <div className="flex justify-between text-lg">
              <span className="font-bold">סך הכל</span>
              <span className="font-bold text-accent whitespace-nowrap">{formatILS(finalTotal)}</span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">כל המחירים בשקלים (₪) וכוללים מע"מ.</p>
          </>
        )}
        <Link
          to="/cart"
          className="mt-3 inline-block text-sm text-accent underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
        >
          חזרה לעגלה
        </Link>

        {/* Trust signals — reduce checkout anxiety */}
        <TrustBadges />
      </div>
    </div>
  );
}
