import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Loader2 } from "lucide-react";
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

  useEffect(() => {
    // Supabase handles the recovery hash automatically and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
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
      {!ready ? (
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
      ) : (
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
            <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw2">אימות סיסמה</Label>
            <Input id="pw2" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
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
      )}
    </div>
  );
}
