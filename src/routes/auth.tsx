import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
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
  head: () => ({
    meta: [{ title: "כניסה / הרשמה" }, { name: "robots", content: "noindex, nofollow" }],
  }),
});

// Cooldown between magic-link sends. Long enough that a link genuinely has time
// to land before the user decides it is lost, and short enough that a mistyped
// or spam-filtered address is not a dead end. It also keeps an impatient double
// press off the OTP endpoint.
const RESEND_COOLDOWN_MS = 60_000;

/** Hebrew seconds, so the countdown reads naturally at 1 and 2. */
function secondsHe(n: number): string {
  if (n === 1) return "שנייה";
  if (n === 2) return "שתי שניות";
  return `${n} שניות`;
}

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
  // Which tab produced the link that was sent. A resend has to repeat the SAME
  // call — reusing the signup path for a login would hand back the ability to
  // create an account without name, consent or terms acceptance, which is
  // exactly what shouldCreateUser is there to prevent.
  const [sentSignup, setSentSignup] = useState(false);
  // Text of the single polite live region. Sighted users read the send state off
  // the confirmation pane and the toast; this is the same information for AT.
  const [status, setStatus] = useState("");
  // Absolute epoch ms at which resending unlocks (null = no cooldown running).
  const [resendDeadline, setResendDeadline] = useState<number | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (user) navigate({ to: "/" });
  }, [user, navigate]);

  // Cooldown ticker. SSR-safe by construction: the timer is only ever created
  // inside an effect, which never runs during the server render, and no browser
  // global is touched at module or render time. It reads an absolute deadline
  // instead of decrementing a counter, so a backgrounded tab (where timers are
  // throttled) cannot stretch the wait past the 60s the user was promised.
  // Zeroing the deadline is what stops the interval — via this effect's cleanup.
  useEffect(() => {
    if (resendDeadline === null) return;
    const tick = () => {
      const left = Math.max(0, Math.ceil((resendDeadline - Date.now()) / 1000));
      setCooldown(left);
      if (left === 0) setResendDeadline(null);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [resendDeadline]);

  const sendMagicLink = async (opts: { isSignup: boolean; resend?: boolean }) => {
    setLoading(true);
    // Empty the live region before the request goes out. A resend produces the
    // same sentence as the send before it, and a live region whose text ends up
    // identical to what it already held generates no DOM mutation — so nothing
    // would be announced the second time. Clearing here and filling after the
    // await are two separate commits, so every attempt is read out.
    setStatus("");
    // Only the gated signup tab is allowed to provision a new user. On the login
    // path shouldCreateUser is false, so typing an unknown address no longer
    // silently creates an account with no name, no consent and no terms
    // acceptance — Supabase rejects it and we nudge the user to the signup tab.
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        shouldCreateUser: opts.isSignup,
        data: opts.isSignup
          ? { full_name: fullName, phone, marketing_consent: marketingConsent }
          : undefined,
      },
    });
    setLoading(false);
    if (error) {
      // shouldCreateUser:false on an unknown email comes back as
      // "Signups not allowed for otp" (code otp_disabled). Surface a gentle
      // Hebrew hint instead of the raw Supabase string.
      const code = (error as { code?: string }).code;
      const message =
        !opts.isSignup && (code === "otp_disabled" || /signup/i.test(error.message))
          ? "לא נמצא חשבון — עברו ללשונית הרשמה"
          : error.message;
      toast.error(message);
      // The toast is transient and visual-first; the same words go to the live
      // region so a screen-reader user is not left with a silent no-op.
      setStatus(message);
      return;
    }
    setSentTo(email);
    setSentSignup(opts.isSignup);
    setResendDeadline(Date.now() + RESEND_COOLDOWN_MS);
    // Seed the visible counter in the SAME commit that reveals the pane. The
    // ticker below only runs after paint, so leaving this to the effect would
    // flash one frame of an unlocked resend button before it locks.
    setCooldown(Math.round(RESEND_COOLDOWN_MS / 1000));
    toast.success(opts.resend ? "שלחנו קישור חדש למייל" : "שלחנו לך קישור כניסה למייל");
    setStatus(
      opts.resend
        ? `שלחנו שוב קישור כניסה לכתובת ${email}`
        : `שלחנו לך קישור כניסה לכתובת ${email}`,
    );
  };

  const canResend = !loading && cooldown === 0;

  // aria-disabled rather than `disabled`: a disabled button leaves the tab order
  // entirely, so during the cooldown a keyboard/AT user would lose the control
  // AND the description that explains why it is unavailable. Kept focusable, the
  // countdown stays discoverable; the handler is the thing that no-ops.
  const resendMagicLink = async () => {
    if (!canResend) return;
    await sendMagicLink({ isSignup: sentSignup, resend: true });
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

  // Straight to Supabase, NOT through @lovable.dev/cloud-auth-js. That shim
  // routes OAuth via Lovable's hosted auth service, which this store no longer
  // uses — the Lovable subscription was cancelled and the database moved to the
  // owner's own project. The button was therefore wired to a dead service.
  // supabase.auth.signInWithOAuth talks to the project that actually holds the
  // Google provider config (whtjslgrrfzehivrknuv).
  //
  // redirectTo must appear in the project's Redirect URLs allow-list, or the
  // user is bounced to the Site URL after consenting instead of back here.
  const signInGoogle = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/` },
    });
    // On success the browser is already navigating to Google, so there is
    // nothing to do; only an immediate failure comes back here.
    if (error) {
      setLoading(false);
      toast.error(error.message || "שגיאה בהתחברות עם גוגל");
    }
  };

  // THE one polite live region for this route, rendered OUTSIDE the sent /
  // not-sent branch on purpose. A successful send swaps the entire pane, and a
  // live region that first mounts in the same commit as its message is not
  // reliably announced. Sitting at a fixed position in both branches it is
  // present-and-empty from first paint and keeps its DOM node across the swap,
  // so every later text change is a mutation assistive tech picks up.
  const liveRegion = (
    <p className="sr-only" role="status" aria-live="polite">
      {status}
    </p>
  );

  if (sentTo) {
    return (
      <>
        {liveRegion}
        <div className="container mx-auto px-4 py-14 max-w-md text-center">
          {/* Magic-link confirmation. `glass` + `glass-gold` = translucent white
              pane with the gold hairline; `glass-gold` rather than the `hairline-gold`
              class because that class replaces the whole box-shadow and would take
              the pane's depth shadow with it (override contract in styles.css). */}
          <div className="glass glass-gold p-8">
            <div className="text-4xl mb-4">✉️</div>
            <h1 className="font-display text-2xl font-bold mb-3">בדקו את תיבת המייל</h1>
            <p className="text-sm text-foreground/80 leading-relaxed mb-4">
              שלחנו קישור כניסה לכתובת:
              <br />
              <strong className="text-accent">{sentTo}</strong>
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mb-6">
              לחצו על הקישור במייל כדי להיכנס לחשבון. הקישור תקף ל-15 דקות.
              <br />
              לא רואים את המייל? בדקו בתיקיית הספאם.
            </p>
            {/* Without a resend, a link that never lands is a dead end: the
                address is already committed and the pane offers no way forward
                except starting over. */}
            <div className="space-y-2">
              <Button
                type="button"
                className="w-full press aria-disabled:opacity-50 aria-disabled:cursor-not-allowed"
                onClick={resendMagicLink}
                aria-disabled={!canResend}
                aria-busy={loading}
                aria-describedby="resend-hint"
              >
                {loading ? "שולח..." : "שליחה חוזרת"}
              </Button>
              {/* Always rendered, so aria-describedby never points at a missing
                  node, and visible, so the wait is not information only screen
                  readers get. */}
              <p id="resend-hint" className="text-xs text-muted-foreground leading-relaxed">
                {cooldown > 0
                  ? `אפשר לשלוח שוב בעוד ${secondsHe(cooldown)}`
                  : "הקישור לא הגיע? אפשר לשלוח אותו שוב."}
              </p>
              <Button
                variant="outline"
                className="w-full press"
                onClick={() => {
                  setSentTo(null);
                  setEmail("");
                  // A different address is a different send: nothing about the
                  // previous one should keep the new one waiting.
                  setResendDeadline(null);
                  setCooldown(0);
                  setStatus("");
                }}
              >
                לכתובת אחרת
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {liveRegion}
      <div className="container mx-auto px-4 py-14 max-w-md">
        <h1 className="font-display text-3xl font-bold text-center mb-3">כניסה / הרשמה לצדיק</h1>
        <div className="mb-6 glass glass-gold p-4 text-center">
          <p className="text-sm font-semibold text-accent">✦ חבר מועדון אור זרוע</p>
          <p className="text-xs text-foreground/80 mt-1 leading-relaxed">
            הצטרפות חינם — <span className="font-bold text-accent">מועדון הלקוחות</span> מעניק מעקב
            הזמנות והטבות, תזכורות לעגלות שלא הושלמו, מדריכים ותוכן לקראת החגים ועדכונים על מוצרים
            חדשים באימייל וב-SMS.
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
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          המשך עם Google
        </Button>

        <div className="relative mb-4">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
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
            <form method="post" action="#" onSubmit={signIn} className="space-y-4 glass p-6 mt-2">
              <div>
                <Label htmlFor="email1">אימייל</Label>
                <Input
                  id="email1"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </div>
              <Button type="submit" className="w-full press" disabled={loading}>
                {loading ? "שולח..." : "שלחו לי קישור כניסה"}
              </Button>
              <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                נשלח אליך קישור חד-פעמי למייל. בלי סיסמאות.
              </p>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form method="post" action="#" onSubmit={signUp} className="space-y-4 glass p-6 mt-2">
              <div>
                <Label htmlFor="name2">שם מלא</Label>
                <Input
                  id="name2"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ישראל ישראלי"
                />
              </div>
              <div>
                <Label htmlFor="email2">אימייל</Label>
                <Input
                  id="email2"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="phone2">
                  טלפון{" "}
                  <span className="text-muted-foreground text-xs">(לעדכוני הזמנות ו-SMS)</span>
                </Label>
                <Input
                  id="phone2"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050-0000000"
                />
              </div>

              <div className="rounded-md hairline bg-muted/50 p-3 space-y-3">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={marketingConsent}
                    onCheckedChange={(v) => setMarketingConsent(v === true)}
                    className="mt-0.5"
                    aria-labelledby="cb-auth-marketing"
                  />
                  <span
                    id="cb-auth-marketing"
                    className="text-xs leading-relaxed text-foreground/90"
                  >
                    אני מאשר/ת קבלת <strong>דיוור שיווקי — מדריכים, תוכן ועדכונים</strong> מאור זרוע
                    באימייל וב-SMS. ניתן להסיר את ההסכמה בכל עת מתוך אזור החשבון או בקישור ההסרה
                    שבכל הודעה.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                    className="mt-0.5"
                    aria-labelledby="cb-auth-terms"
                  />
                  <span id="cb-auth-terms" className="text-xs leading-relaxed text-foreground/90">
                    קראתי ואני מאשר/ת את{" "}
                    <a href="/terms" className="underline">
                      תנאי השימוש
                    </a>{" "}
                    ואת{" "}
                    <a href="/privacy" className="underline">
                      מדיניות הפרטיות
                    </a>
                    . <span className="text-destructive">*</span>
                  </span>
                </label>
              </div>

              <Button type="submit" className="w-full press" disabled={loading}>
                {loading ? "שולח..." : "הצטרפות חינם למועדון"}
              </Button>

              <div className="text-center">
                <p className="text-[11px] text-muted-foreground leading-relaxed mb-1">
                  הצטרפות חינם למועדון אור זרוע לצדיק. נשלח אליך קישור הפעלה למייל.
                </p>
                <PrivacyNotice context="signup" className="text-center" />
              </div>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
