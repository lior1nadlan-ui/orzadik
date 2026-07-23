import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { deleteMyAccount, exportMyData } from "@/lib/account.functions";
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
  body{font-family:Arial,"Segoe UI",sans-serif;max-width:800px;margin:24px auto;padding:0 16px;color:#1a1a1a;line-height:1.6}
  h1{color:#A8862A} h2{border-bottom:1px solid #D4AF37;padding-bottom:4px;margin-top:28px}
  table{border-collapse:collapse;width:100%} th,td{border:1px solid #ddd;padding:6px 10px;text-align:right}
  th{background:#FAF6E9;width:220px} .order{border:1px solid #eee;border-radius:8px;padding:10px 14px;margin:10px 0}
  .muted{color:#666;font-size:13px}
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

  const toggleConsent = async (next: boolean) => {
    setSavingConsent(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        marketing_consent: next,
        marketing_consent_at: next ? new Date().toISOString() : null,
        marketing_consent_source: next ? "account" : null,
      })
      .eq("id", user!.id);
    setSavingConsent(false);
    if (error) { toast.error("שמירה נכשלה"); return; }
    toast.success(next ? "נרשמת לתוכן פרסומי" : "הוסרת מרשימת הדיוור");
    queryClient.invalidateQueries({ queryKey: ["profile", user!.id] });
  };

  const { data: orders = [] } = useQuery({
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
    return <div className="container mx-auto px-4 py-20 text-center">טוען...</div>;
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
      {/* Member banner */}
      <section className="relative overflow-hidden rounded-2xl border-2 border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF6E9] via-white to-[#FAF6E9] p-6 md:p-8 shadow-[var(--shadow-card)]">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-[#A8862A]" />
              <p className="text-[11px] tracking-[0.25em] text-[#A8862A] uppercase font-bold">
                חבר/ת מועדון אור זרוע
              </p>
            </div>
            <h1 className="font-display text-2xl md:text-3xl font-bold">שלום {displayName}</h1>
            {memberSince && (
              <p className="text-sm text-muted-foreground mt-1">חבר/ה במועדון מאז {memberSince}</p>
            )}
          </div>
          <div className="flex flex-col items-start md:items-end gap-1">
            <span className="rounded-full bg-[#D4AF37] text-white text-sm font-bold px-4 py-1.5 shadow">
              חבר/ת מועדון
            </span>
            <span className="text-xs text-muted-foreground">
              ההטבות חלות אוטומטית בכל הזמנה
            </span>
          </div>
        </div>
      </section>

      {/* Stats / actions */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div className="rounded-xl border bg-card p-5">
          <Package className="h-5 w-5 text-[#A8862A] mb-2" />
          <div className="text-2xl font-bold">{orders.length}</div>
          <div className="text-xs text-muted-foreground">הזמנות בחשבון</div>
        </div>
        <Link to="/shop" className="rounded-xl border bg-card p-5 hover:border-[#D4AF37] transition">
          <ShoppingBag className="h-5 w-5 text-[#A8862A] mb-2" />
          <div className="text-sm font-semibold">המשך לקנות</div>
          <div className="text-xs text-muted-foreground">חזרה לחנות</div>
        </Link>
        <button
          onClick={async () => {
            await signOut();
            toast.success("התנתקת");
            navigate({ to: "/" });
          }}
          className="rounded-xl border bg-card p-5 text-right hover:border-destructive/40 transition"
        >
          <LogOut className="h-5 w-5 text-muted-foreground mb-2" />
          <div className="text-sm font-semibold">יציאה</div>
          <div className="text-xs text-muted-foreground">התנתקות מהחשבון</div>
        </button>
      </section>

      {/* Personal details — rectification (§14) + access/export (§13) */}
      <section className="mt-6 rounded-xl border bg-card p-5">
        <div className="flex items-start gap-3 mb-4">
          <Pencil className="h-5 w-5 text-[#A8862A] mt-0.5" />
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
          <Button onClick={onSaveProfile} disabled={savingProfile} className="bg-[#D4AF37] hover:bg-[#A8862A] text-white">
            {savingProfile ? "שומר..." : "שמירת פרטים"}
          </Button>
          <Button onClick={onExportData} disabled={exporting} variant="outline">
            <Download className="h-4 w-4 ml-1" />
            {exporting ? "מייצא..." : "ייצוא המידע שלי"}
          </Button>
        </div>
      </section>

      {/* Marketing preferences */}
      <section className="mt-6 rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-[#A8862A] mt-0.5" />
            <div>
              <div className="text-sm font-semibold">תוכן פרסומי ומבצעים</div>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-md">
                קבלת עדכונים על מבצעים, מוצרים חדשים והטבות בלעדיות לחברי מועדון
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
        {orders.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p className="text-sm mb-3">אין עדיין הזמנות בחשבון</p>
            <Link to="/shop">
              <Button className="bg-[#D4AF37] hover:bg-[#A8862A] text-white">לחנות</Button>
            </Link>
          </div>
        ) : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="divide-y">
              {orders.map((o: any) => {
                const shipLabel: Record<string, string> = {
                  pending: "ממתין לטיפול",
                  preparing: "בהכנה",
                  shipped: "נשלח",
                  delivered: "נמסר",
                };
                return (
                  <Link
                    key={o.id}
                    to="/order/$id"
                    params={{ id: o.id }}
                    className="flex items-center justify-between p-4 hover:bg-muted/40 transition gap-3"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-sm">הזמנה #{o.order_number}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(o.created_at).toLocaleDateString("he-IL")} • {o.status}
                        {o.payment_status === "paid" && <span className="text-emerald-600"> • שולם</span>}
                      </div>
                      <div className="text-xs mt-1">
                        <span className="text-muted-foreground">משלוח: </span>
                        <span className="font-medium">{shipLabel[o.shipping_status] ?? o.shipping_status}</span>
                        {o.tracking_number && (
                          <span className="text-[#A8862A]"> • מעקב: {o.tracking_number}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-sm font-bold text-[#A8862A] whitespace-nowrap">{formatILS(Number(o.total))}</div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* Danger zone — account deletion (GDPR / takana 13 right to erasure) */}
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
              <Button variant="destructive" size="sm" disabled={deleting}>
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
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
