import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

  return (
    <div className="container mx-auto px-4 py-14 max-w-md">
      <h1 className="font-display text-3xl font-bold text-center mb-3">בחירת סיסמה חדשה</h1>
      {!ready ? (
        <p className="text-center text-sm text-muted-foreground">
          טוען... אם הגעת לכאן בלי קישור מהאימייל, חזרו לדף{" "}
          <a href="/forgot-password" className="underline">שחזור סיסמה</a>.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6">
          <div>
            <Label htmlFor="pw">סיסמה חדשה (לפחות 8 תווים)</Label>
            <Input id="pw" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="pw2">אימות סיסמה</Label>
            <Input id="pw2" type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : "עדכנו סיסמה"}
          </Button>
        </form>
      )}
    </div>
  );
}
