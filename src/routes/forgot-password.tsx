import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "שחזור סיסמה" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("נשלח קישור לשחזור סיסמה לאימייל שלך");
  };

  return (
    <div className="container mx-auto px-4 py-14 max-w-md">
      <h1 className="font-display text-3xl font-bold text-center mb-3">שחזור סיסמה</h1>
      <p className="text-center text-sm text-muted-foreground mb-6">
        הזינו את כתובת האימייל שלכם ונשלח קישור לאיפוס הסיסמה
      </p>

      {sent ? (
        <div className="rounded-lg border bg-card p-6 text-center space-y-3">
          <p className="text-sm">
            ✦ נשלח קישור לאיפוס סיסמה אל <strong>{email}</strong>.
            <br />
            בדקו את תיבת הדואר (וגם את תיקיית הספאם).
          </p>
          <Link to="/auth" className="text-sm underline text-[#A8862A]">
            חזרה לדף הכניסה
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border bg-card p-6">
          <div>
            <Label htmlFor="email">אימייל</Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "..." : "שלחו לי קישור"}
          </Button>
          <div className="text-center">
            <Link to="/auth" className="text-xs underline text-muted-foreground">
              חזרה לכניסה
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
