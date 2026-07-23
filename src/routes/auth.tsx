import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { PrivacyNotice } from "@/components/PrivacyNotice";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "כניסה / הרשמה" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function AuthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [marketingConsent, setMarketingConsent] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  const sendMagicLink = async (opts: { isSignup: boolean }) => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: true,
        data: opts.isSignup
          ? { full_name: fullName, phone, marketing_consent: marketingConsent }
          : undefined,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSentTo(email);
    toast.success("שלחנו לך קישור כניסה למייל");
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendMagicLink({ isSignup: false });
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("יש לאשר את תנאי השימוש ומדיניות הפרטיות");
      return;
    }
    await sendMagicLink({ isSignup: true });
  };

  const signInGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setLoading(false);
      toast.error(result.error.message || "שגיאה בהתחברות עם גוגל");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/" });
  };

  if (sentTo) {
    return (
      <div className="container mx-auto px-4 py-14 max-w-md text-center">
        <div className="rounded-lg border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF6E9] to-white p-8">
          <div className="text-4xl mb-4">✉️</div>
          <h1 className="font-display text-2xl font-bold mb-3">בדקו את תיבת המייל</h1>
          <p className="text-sm text-foreground/80 leading-relaxed mb-4">
            שלחנו קישור כניסה לכתובת:
            <br />
            <strong className="text-[#A8862A]">{sentTo}</strong>
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-6">
            לחצו על הקישור במייל כדי להיכנס לחשבון. הקישור תקף ל-15 דקות.
            <br />
            לא רואים את המייל? בדקו בתיקיית הספאם.
          </p>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setSentTo(null);
              setEmail("");
            }}
          >
            לכתובת אחרת
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-14 max-w-md">
      <h1 className="font-display text-3xl font-bold text-center mb-3">כניסה / הרשמה לצדיק</h1>
      <div className="mb-6 rounded-lg border border-[#D4AF37]/40 bg-gradient-to-br from-[#FAF6E9] to-white p-4 text-center">
        <p className="text-sm font-semibold text-[#A8862A]">✦ חבר מועדון אור זרוע</p>
        <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
          הצטרפות חינם — <span className="font-bold text-accent">מועדון הלקוחות</span> מעניק מעקב הזמנות והטבות,
          תזכורות לעגלות שלא הושלמו, ועדכונים על מבצעים, מוצרים חדשים ותוכן מיוחד לחברי המועדון
          באימייל וב-SMS.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full mb-4 gap-2"
        onClick={signInGoogle}
        disabled={loading}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        המשך עם Google
      </Button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
        <span className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">או באמצעות מייל</span>
        </span>
      </div>

      <Tabs defaultValue="login" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="login">כניסה</TabsTrigger>
          <TabsTrigger value="signup">הרשמה</TabsTrigger>
        </TabsList>
        <TabsContent value="login">
          <form method="post" action="#" onSubmit={signIn} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <Label htmlFor="email1">אימייל</Label>
              <Input id="email1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "שולח..." : "שלחו לי קישור כניסה"}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
              נשלח אליך קישור חד-פעמי למייל. בלי סיסמאות.
            </p>
          </form>
        </TabsContent>
        <TabsContent value="signup">
          <form method="post" action="#" onSubmit={signUp} className="space-y-4 rounded-lg border bg-card p-6">
            <div>
              <Label htmlFor="name2">שם מלא</Label>
              <Input id="name2" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ישראל ישראלי" />
            </div>
            <div>
              <Label htmlFor="email2">אימייל</Label>
              <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="phone2">טלפון <span className="text-muted-foreground text-xs">(לעדכוני הזמנות ו-SMS)</span></Label>
              <Input id="phone2" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" />
            </div>

            <div className="rounded-md border border-border bg-muted/30 p-3 space-y-3">
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={marketingConsent}
                  onCheckedChange={(v) => setMarketingConsent(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground/90">
                  אני מאשר/ת קבלת <strong>תוכן פרסומי, מבצעים ועדכונים</strong> מאור זרוע
                  באימייל וב-SMS. ניתן להסיר את ההסכמה בכל עת מתוך אזור החשבון
                  או בקישור ההסרה שבכל הודעה.
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <Checkbox
                  checked={termsAccepted}
                  onCheckedChange={(v) => setTermsAccepted(v === true)}
                  className="mt-0.5"
                />
                <span className="text-xs leading-relaxed text-foreground/90">
                  קראתי ואני מאשר/ת את <a href="/terms" className="underline">תנאי השימוש</a> ואת
                  {" "}<a href="/privacy" className="underline">מדיניות הפרטיות</a>. <span className="text-destructive">*</span>
                </span>
              </label>
            </div>

            <Button type="submit" className="w-full bg-[#D4AF37] hover:bg-[#A8862A] text-white" disabled={loading}>
              {loading ? "שולח..." : "הצטרפו למועדון אור זרוע לצדיק בחינם"}
            </Button>

            <div className="text-center">
              <p className="text-[11px] text-muted-foreground leading-relaxed mb-1">נשלח אליך קישור הפעלה למייל.</p>
              <PrivacyNotice context="signup" className="text-center" />
            </div>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
