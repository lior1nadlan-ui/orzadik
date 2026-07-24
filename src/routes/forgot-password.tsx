import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/forgot-password")({
  component: ForgotPasswordPage,
  head: () => ({ meta: [{ title: "שחזור סיסמה" }, { name: "robots", content: "noindex, nofollow" }] }),
});

function ForgotPasswordPage() {
  const navigate = useNavigate();

  // The store is passwordless — sign-in is a magic link or Google, so there is
  // no password to reset and this route is an orphaned dead-end. Send anyone who
  // lands here to /auth. navigate() runs only inside the effect (client-only),
  // so SSR renders the fallback card below with no redirect; `replace` keeps the
  // dead-end out of the browser history.
  useEffect(() => {
    navigate({ to: "/auth", replace: true });
  }, [navigate]);

  return (
    <div className="container mx-auto px-4 py-14 max-w-md text-center">
      {/* Same auth-card standard as /auth: translucent white pane with the gold
          hairline (glass-gold), not the hairline-gold class — that would replace
          the whole box-shadow and drop the pane's depth shadow. */}
      <div className="glass glass-gold p-8">
        <h1 className="font-display text-2xl font-bold mb-3">כניסה לחשבון</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-5">
          הכניסה לאתר היא ללא סיסמה — בקישור חד-פעמי למייל או עם חשבון Google.
          מעבירים אתכם לדף הכניסה…
        </p>
        <Link to="/auth" className="text-sm underline text-accent">
          לדף הכניסה
        </Link>
      </div>
    </div>
  );
}
