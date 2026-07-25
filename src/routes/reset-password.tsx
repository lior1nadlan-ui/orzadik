import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({ meta: [{ title: "סיסמה חדשה" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Supabase handles the recovery hash automatically and emits PASSWORD_RECOVERY.
    let settled = false;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        settled = true;
        setReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        settled = true;
        setReady(true);
      }
    });
    // A valid recovery link restores a session (or fires PASSWORD_RECOVERY)
    // within a moment of mount. If neither happens the link was missing, already
    // used, or expired — so stop the spinner and show a dead-end with a way back,
    // instead of leaving the user staring at an endless "טוען…".
    const timer = setTimeout(() => {
      if (!settled) setExpired(true);
    }, 6000);
    return () => {
      sub.subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("סיסמה חייבת להיות לפחות 8 תווים");
    if (password !== confirm) return toast.error("הסיסמאות לא תואמות");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("הסיסמה עודכנה בהצלחה");
    navigate({ to: "/account" });
  };

  // A recovery token may land a user here (Supabase reset-password redirect), so
  // this route is NOT redirected away — it is brought up to the /auth card
  // standard: a glass + glass-gold pane (gold hairline, not the hairline-gold
  // class, which would drop the pane's depth shadow), an accent Lock crest, and
  // a spinner on submit.
  return (
    <div className="container mx-auto px-4 py-14 max-w-md">
      {ready ? (
        // Token-driven pane: mounts only once Supabase has emitted
        // PASSWORD_RECOVERY / SIGNED_IN.
        <form onSubmit={onSubmit} className="glass glass-gold p-8 space-y-4">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <Lock className="h-5 w-5 text-accent" aria-hidden="true" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">בחירת סיסמה חדשה</h1>
            <p className="text-xs text-muted-foreground">בחרו סיסמה חדשה לחשבונכם.</p>
          </div>
          <div>
            <Label htmlFor="pw">סיסמה חדשה (לפחות 8 תווים)</Label>
            {/* One reveal toggle drives both fields' visibility. It sits at the
                trailing (left, in RTL) edge, hence pl-10 to reserve its box. */}
            <div className="relative">
              <Input
                id="pw"
                type={show ? "text" : "password"}
                minLength={8}
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
              />
              {/* Centred with inset-y-0 + flex, NOT -translate-y-1/2: `.press`
                  owns `transform` (active:scale(0.97)) and would clobber a
                  translate mid-press. Flex centring needs no transform, so the
                  scale gesture scales cleanly around the icon. */}
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? "הסתרת הסיסמה" : "הצגת הסיסמה"}
                aria-pressed={show}
                className="press absolute inset-y-0 left-2 flex items-center text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                {show ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="pw2">אימות סיסמה</Label>
            <Input id="pw2" type={show ? "text" : "password"} minLength={8} required autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full press" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                מעדכן…
              </>
            ) : (
              "עדכנו סיסמה"
            )}
          </Button>
        </form>
      ) : expired ? (
        // The recovery event never arrived within the grace window — a stale or
        // already-used link. Dead-end honestly and route back to a fresh request.
        <div className="glass glass-gold p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-3">הקישור פג תוקף</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            קישור איפוס הסיסמה כבר אינו תקף או שכבר נעשה בו שימוש. בקשו קישור חדש
            בדף{" "}
            <a href="/forgot-password" className="underline text-accent">שחזור סיסמה</a>.
          </p>
        </div>
      ) : (
        <div className="glass glass-gold p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Lock className="h-5 w-5 text-accent" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold mb-3">בחירת סיסמה חדשה</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            טוען… אם הגעתם לכאן בלי קישור מהאימייל, חזרו לדף{" "}
            <a href="/forgot-password" className="underline text-accent">שחזור סיסמה</a>.
          </p>
        </div>
      )}
    </div>
  );
}
