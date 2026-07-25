import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
import { setMarketingConsent } from "@/lib/marketing-consent.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { formatILS } from "@/lib/cart";
import { orderStatusHe } from "@/lib/business";
import { CardSkeleton } from "@/components/Skeletons";
import { Sparkles, Package, LogOut, ShoppingBag, Mail, Trash2, Download, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({ meta: [{ title: "החשבון שלי — מועדון אור זרוע" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function escHtml(v: unknown): string {
  return String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

function fmtDate(v: unknown): string {
  if (!v) return "";
  try {
    return new Date(String(v)).toLocaleDateString("he-IL");
  } catch {
    return String(v);
  }
}

/** Build a human-readable Hebrew (RTL) data report for the access right (§13). */
function buildDataReportHtml(data: any): string {
  const p = data?.profile ?? {};
  const orders: any[] = Array.isArray(data?.orders) ? data.orders : [];
  const carts: any[] = Array.isArray(data?.abandoned_carts) ? data.abandoned_carts : [];

  const profileRows = [
    ["שם מלא", p.full_name],
    ['דוא"ל', p.email],
    ["טלפון", p.phone],
    ["חבר מועדון", p.is_member ? "כן" : "לא"],
    ["חבר מאז", fmtDate(p.member_since)],
    ["הסכמה לדיוור שיווקי", p.marketing_consent ? "כן" : "לא"],
    ["מועד ההסכמה לדיוור", fmtDate(p.marketing_consent_at)],
  ]
    .map(([k, v]) => `<tr><th>${escHtml(k)}</th><td>${escHtml(v)}</td></tr>`)
    .join("");

  const ordersHtml = orders.length
    ? orders
        .map((o) => {
          const items = (Array.isArray(o.order_items) ? o.order_items : [])
            .map(
              (it: any) =>
                `<li>${escHtml(it.product_name)} × ${escHtml(it.quantity)}${
                  it.variant_label ? ` (${escHtml(it.variant_label)})` : ""
                }${it.custom_text ? ` — ${escHtml(it.custom_text)}` : ""} — ${escHtml(it.line_total)} ₪</li>`,
            )
            .join("");
          return `<div class="order"><h3>הזמנה ${escHtml(o.order_number)}</h3>
            <p>תאריך: ${fmtDate(o.created_at)} · סטטוס: ${escHtml(o.status)} · תשלום: ${escHtml(o.payment_status)} · סה"כ: ${escHtml(o.total)} ₪</p>
            <ul>${items}</ul></div>`;
        })
        .join("")
    : "<p>אין הזמנות.</p>";

  const cartsHtml = carts.length
    ? `<ul>${carts
        .map(
          (c) =>
            `<li>${fmtDate(c.created_at)} — ${escHtml(c.email)}${c.name ? ` (${escHtml(c.name)})` : ""} — ${escHtml(c.subtotal)} ₪</li>`,
        )
        .join("")}</ul>`
    : "<p>אין עגלות שמורות.</p>";

  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<title>המידע שלי — אור זרוע לצדיק</title>
<style>
  /* Standalone print/offline sheet for the downloaded §13 report. It lives in a
     separate document that never loads styles.css, so it CANNOT use the design
     tokens — the brand values are inlined as literals here on purpose:
     #7E611E is --accent (5.81:1 on white), #C2A25E is --gold (decorative rule
     only, never text), #F1F3F7 is --muted (the neutral table-header fill). */
  body{font-family:Arial,"Segoe UI",sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#16181D;line-height:1.6}
  h1{color:#7E611E} h2{border-bottom:1px solid #C2A25E;padding-bottom:4px;margin-top:28px}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #E2E6EC;padding:6px 10px;text-align:right}
  th{background:#F1F3F7;width:220px} .order{border:1px solid #E2E6EC;border-radius:8px;padding:10px 14px;margin:10px 0}
  .muted{color:#565E6B;font-size:13px}
</style></head><body>
<h1>המידע שלי — אור זרוע לצדיק</h1>
<p class="muted">הופק בתאריך: ${fmtDate(data?.exported_at)} · מסמך זה כולל את המידע האישי המוחזק עליך, בהתאם לזכות העיון (סעיף 13 לחוק הגנת הפרטיות).</p>
<h2>פרטים אישיים</h2>
<table>${profileRows}</table>
<h2>הזמנות</h2>
${ordersHtml}
<h2>עגלות שמורות</h2>
${cartsHtml}
</body></html>`;
}

function AccountPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const queryClient = useQueryClient();
  const [savingConsent, setSavingConsent] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const removeAccount = useServerFn(deleteMyAccount);
  const exportData = useServerFn(exportMyData);
  const saveConsent = useServerFn(setMarketingConsent);
  const [exporting, setExporting] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const onExportData = async () => {
    setExporting(true);
    try {
      const data = await exportData();
      // §13(ב): the information must be presented in a human-readable form in
      // Hebrew — so we download a formatted Hebrew document, not a raw JSON dump.
      const html = buildDataReportHtml(data);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orzadik-my-data-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("המידע שלך הורד");
    } catch (e: any) {
      toast.error(e?.message ?? "הייצוא נכשל");
    } finally {
      setExporting(false);
    }
  };

  const onSaveProfile = async () => {
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name.trim() || null, phone: phone.trim() || null })
      .eq("id", user!.id);
    setSavingProfile(false);
    if (error) {
      toast.error("שמירה נכשלה");
      return;
    }
    toast.success("הפרטים עודכנו");
    queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
  };

  const onDeleteAccount = async () => {
    setDeleting(true);
    try {
      await removeAccount();
      await signOut();
      toast.success("החשבון והמידע האישי נמחקו");
      navigate({ to: "/" });
    } catch (e: any) {
      toast.error(e?.message ?? "מחיקת החשבון נכשלה");
      setDeleting(false);
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, is_member, member_since, marketing_consent, phone")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (profile) {
      setName(profile.full_name ?? "");
      setPhone(profile.phone ?? "");
    }
  }, [profile]);

  // Consent is never written from the client: an opt-out has to remove the
  // address from EVERY send path (profile, newsletter list, cart reminders and
  // the global suppression list), otherwise "הוסרת מרשימת הדיוור" would be a
  // false promise for anyone who also opted in at checkout. The server function
  // owns all of those writes and resolves the address from the session.
  const toggleConsent = async (next: boolean) => {
    setSavingConsent(true);
    try {
      await saveConsent({ data: { optIn: next } });
      toast.success(next ? "נרשמת לתוכן פרסומי" : "הוסרת מרשימת הדיוור");
      queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
    } catch {
      // The Switch is controlled by the (unchanged) profile query, so it stays
      // showing the previous value when the save fails.
      toast.error("שמירה נכשלה");
    } finally {
      setSavingConsent(false);
    }
  };

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ["my-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total, created_at, payment_status, shipping_status, tracking_number, shipping_carrier")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  if (authLoading || !user) {
    // Card-shaped placeholder that reserves the member banner + the three stat
    // tiles below it, so the real panes drop in with no layout shift.
    return (
      <div className="container mx-auto px-4 py-10 max-w-4xl">
        <CardSkeleton className="min-h-[8.5rem] rounded-[1.25rem]" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          <CardSkeleton className="min-h-[6.5rem]" />
          <CardSkeleton className="min-h-[6.5rem]" />
          <CardSkeleton className="min-h-[6.5rem]" />
        </div>
      </div>
    );
  }

  const memberSince = profile?.member_since
    ? new Date(profile.member_since).toLocaleDateString("he-IL", {
        year: "numeric",
        month: "long",
      })
    : "";
  const displayName = profile?.full_name || user.email?.split("@")[0] || "חבר/ת מועדון";

  return (
    <div className="container mx-auto px-4 py-10 max-w-4xl">
      {/* Member banner — the one hero pane on this route.
          `glass-strong` (94% white + blur) rather than `glass`, because the page
          mesh is at its most saturated behind the top of the viewport and the
          panel carries gold text. `glass-gold` swaps the inset hairline to the
          gold line; it is used INSTEAD of the `hairline-gold` class because that
          class would replace the whole box-shadow and take the glass lift-shadow
          with it (see the override contract in styles.css). */}
      <section className="relative overflow-hidden glass-strong glass-gold [--glass-radius:1.25rem] p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-accent" />
              <p className="text-[11px] tracking-[0.25em] text-accent uppercase font-bold">
                חבר/ת מועדון אור זרוע
              </p>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">שלום {displayName}</h1>
            {memberSince && (
              <p className="text-sm text-muted-foreground mt-1">חבר/ה במועדון מאז {memberSince}</p>
            )}
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="rounded-full bg-accent text-white text-sm font-bold px-4 py-1.5">
              חבר/ת מועדון
            </span>
            <span className="text-xs text-muted-foreground">
              ההטבות חלות אוטומטית בכל הזמנה
            </span>
          </div>
        </div>
        <div className="gold-rule mt-5 md:mt-6" aria-hidden="true" />
      </section>

      {/* Stats / actions — glass tiles. `.glass` already draws its own hairline
          as an inset ring, so no border utility is added (a `border-*` would
          double the line).
          Motion: the two pressable tiles carry `press` ONLY — transform, 160ms,
          ease-out. `glass-lift` is deliberately not stacked on top of it: both
          classes set `transition-property`, `press` is emitted last, and the
          combination would silently drop the shadow half of the lift. The hover
          affordance is therefore a hairline that shifts to gold — a token swap,
          no transition to conflict, and colour survives prefers-reduced-motion.
          The static counter tile gets neither. */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="glass p-5">
          <Package className="h-5 w-5 text-accent mb-2" />
          <div className="text-2xl font-bold">{ordersLoading ? "—" : orders.length}</div>
          <div className="text-xs text-muted-foreground">הזמנות בחשבון</div>
        </div>
        <Link
          to="/shop"
          className="glass press p-5 [@media(hover:hover)_and_(pointer:fine)]:hover:[--glass-line:var(--glass-line-gold)]"
        >
          <ShoppingBag className="h-5 w-5 text-accent mb-2" />
          <div className="text-sm font-semibold">המשך לקנות</div>
          <div className="text-xs text-muted-foreground">חזרה לחנות</div>
        </Link>
        <button
          onClick={async () => {
            await signOut();
            toast.success("התנתקת");
            navigate({ to: "/" });
          }}
          className="glass press p-5 text-right [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
        >
          <LogOut className="h-5 w-5 text-muted-foreground mb-2" />
          <div className="text-sm font-semibold">יציאה</div>
          <div className="text-xs text-muted-foreground">התנתקות מהחשבון</div>
        </button>
      </section>

      {/* Personal details — rectification (§14) + access/export (§13) */}
      <section className="mt-6 glass p-5">
        <div className="flex items-start gap-3 mb-4">
          <Pencil className="h-5 w-5 text-accent mt-0.5" />
          <div>
            <div className="text-sm font-semibold">הפרטים האישיים שלי</div>
            <p className="text-xs text-muted-foreground mt-1">עדכון הפרטים שלך, ועיון/הורדה של כל המידע שאנו מחזיקים עליך.</p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="acc-name">שם מלא</Label>
            <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="acc-phone">טלפון</Label>
            <Input id="acc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-muted-foreground">דוא"ל</Label>
            <Input value={profile?.email ?? user.email ?? ""} disabled readOnly />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onSaveProfile} disabled={savingProfile} className="press">
            {savingProfile ? "שומר..." : "שמירת פרטים"}
          </Button>
          <Button onClick={onExportData} disabled={exporting} variant="outline" className="press">
            <Download className="h-4 w-4 ml-1" />
            {exporting ? "מייצא..." : "ייצוא המידע שלי"}
          </Button>
        </div>
      </section>

      {/* Marketing preferences */}
      <section className="mt-6 glass p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-accent mt-0.5" />
            <div>
              <div className="text-sm font-semibold">דיוור שיווקי</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                מדריכים ותוכן לקראת החגים, מוצרים חדשים ועדכונים לחברי מועדון
                באימייל וב-SMS. ניתן להסיר את ההסכמה בכל עת.
              </p>
            </div>
          </div>
          <Switch
            checked={!!profile?.marketing_consent}
            disabled={savingConsent}
            onCheckedChange={toggleConsent}
          />
        </div>
      </section>

      {/* Orders */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-bold mb-4">ההזמנות שלי</h2>
        {ordersLoading ? (
          // The query defaults to [], so gating the empty state on length alone
          // flashed a false "אין עדיין הזמנות" to returning customers mid-load.
          // Reserve the list footprint with skeleton rows until the fetch settles.
          <div className="glass overflow-hidden" aria-hidden="true">
            <div className="divide-y">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 gap-3">
                  <div className="min-w-0 space-y-2">
                    <CardSkeleton className="h-4 w-32 min-h-0 rounded-md" />
                    <CardSkeleton className="h-3 w-40 min-h-0 rounded-md" />
                  </div>
                  <CardSkeleton className="h-4 w-16 min-h-0 rounded-md" />
                </div>
              ))}
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-xl border border-dashed border-glass-line p-8 text-center text-muted-foreground">
            <p className="text-sm mb-3">אין עדיין הזמנות בחשבון</p>
            <Link to="/shop">
              <Button className="press">לחנות</Button>
            </Link>
          </div>
        ) : (
          <div className="glass overflow-hidden">
            <div className="divide-y">
              {orders.map((o: any) => {
                const shipLabel: Record<string, string> = {
                  pending: "ממתין לטיפול",
                  preparing: "בהכנה",
                  shipped: "נשלח",
                  delivered: "נמסר",
                };
                // `press` owns the motion on the row (transition-property: transform,
                // 160ms, ease-out — a named property, never `transition: all`). The
                // hover tint is intentionally un-transitioned: `.press` is emitted
                // later in the utilities layer than any Tailwind `transition-*`, so a
                // second transition utility here would be dead code, not a fade.
                return (
                  <Link
                    key={o.id}
                    to="/order/$id"
                    params={{ id: o.id }}
                    className="flex items-center justify-between p-4 gap-3 press [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm">הזמנה #{o.order_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("he-IL")} • {orderStatusHe(o.status)}
                        {o.payment_status === "paid" && <span className="text-accent font-medium"> • שולם</span>}
                      </div>
                      <div className="text-xs mt-1">
                        <span className="text-muted-foreground">משלוח: </span>
                        <span className="font-medium">{shipLabel[o.shipping_status] ?? o.shipping_status}</span>
                        {o.tracking_number && (
                          <span className="text-accent"> • מעקב: {o.tracking_number}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-accent whitespace-nowrap">{formatILS(Number(o.total))}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Danger zone — account deletion (GDPR / takana 13 right to erasure) */}
      {/* Semantic destructive panel — deliberately NOT glass. A glass pane would
          wash the warning tint out; the destructive surface has to stay legible
          as a warning, so it keeps a solid tint and a destructive border. */}
      <section className="mt-10 rounded-xl border border-destructive/30 bg-destructive/5 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <Trash2 className="h-5 w-5 text-destructive mt-0.5" />
            <div>
              <div className="text-sm font-semibold">מחיקת חשבון</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                מחיקת החשבון תסיר את הפרופיל והמידע האישי שלך. הזמנות עבר יישמרו
                באופן אנונימי בלבד, כנדרש בחוק לצורכי הנהלת חשבונות. הפעולה אינה הפיכה.
              </p>
            </div>
          </div>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="press" disabled={deleting}>
                {deleting ? "מוחק..." : "מחיקת החשבון"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>למחוק את החשבון?</AlertDialogTitle>
                <AlertDialogDescription>
                  המידע האישי שלך יימחק לצמיתות ולא ניתן לשחזרו. הזמנות עבר יישמרו
                  באופן אנונימי בלבד כנדרש בחוק. להמשיך?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>ביטול</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDeleteAccount}
                  className="bg-destructive text-destructive-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-destructive/90"
                >
                  מחק לצמיתות
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </div>
  );
}
