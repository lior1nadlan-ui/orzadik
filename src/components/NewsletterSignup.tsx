import { useId, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { subscribeNewsletter } from "@/lib/newsletter.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Footer newsletter capture.
 *
 * Plain useState only — no window/localStorage access, so it renders
 * identically on the server and hydrates without a mismatch.
 */
type NewsletterSource = "footer" | "checkout" | "account" | "article" | "home" | "category";

export function NewsletterSignup({ source = "footer" }: { source?: NewsletterSource } = {}) {
  // The id is GENERATED, not the literal "newsletter-email" it used to be.
  // This component renders TWICE on the homepage — once in the footer
  // (SiteHeader.tsx) and once in the club section (routes/index.tsx) — so a
  // hard-coded id produced two elements sharing one id on the site's most
  // visited page. `htmlFor` resolves to the FIRST match in the document, so
  // tapping the footer form's label moved focus to the club section's input,
  // hundreds of pixels up the page. Measured in a headless browser, not
  // theorised. useId() is SSR-safe: React emits the same value on the server
  // and the client, so this does not reintroduce a hydration mismatch.
  const emailId = useId();
  const subscribe = useServerFn(subscribeNewsletter);
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await subscribe({ data: { email: email.trim(), source, website } });
      setDone(true);
      setEmail("");
      toast.success("נרשמת לרשימת התפוצה — תודה!");
    } catch (err: any) {
      toast.error(err?.message ?? "לא הצלחנו להשלים את ההרשמה. נסו שוב.");
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <p className="text-[15px] text-accent" role="status">
        תודה! נרשמת לרשימת התפוצה ✨
      </p>
    );
  }

  // Buttons use --accent (the design system's CTA gold, 5.81:1 with white) and
  // NOT the raw #D4AF37 used decoratively elsewhere: that is only 2.1:1 against
  // white, which Lighthouse flagged on this very button.
  //
  // The hover fill is --accent-strong (#6B5219, 7.38:1 with white) and NOT
  // `bg-accent/90`: 90% of --accent over the panel behind it composites to
  // #8B7135, where the button's own white label drops to 4.66:1 — passing by
  // 0.16 with no headroom at all, and failing outright the moment the surface
  // under it is anything but pure white. accent-strong has real margin.
  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor={emailId} className="sr-only">
          כתובת דוא"ל להרשמה לרשימת התפוצה
        </label>
        <Input
          id={emailId}
          type="email"
          required
          autoComplete="email"
          placeholder="הדוא״ל שלכם"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-card"
        />
        {/* Honeypot: hidden from people and assistive tech, irresistible to bots. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
        />
        <Button
          type="submit"
          disabled={busy}
          className="shrink-0 bg-accent text-accent-foreground press [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
        >
          {busy ? "רושם..." : "הרשמה"}
        </Button>
      </div>
    </form>
  );
}
