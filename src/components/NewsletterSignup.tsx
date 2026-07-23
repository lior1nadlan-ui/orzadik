import { useState } from "react";
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
export function NewsletterSignup({ source = "footer" as const }) {
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

  return (
    <form onSubmit={onSubmit} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="newsletter-email" className="sr-only">
          כתובת דוא"ל להרשמה לרשימת התפוצה
        </label>
        <Input
          id="newsletter-email"
          type="email"
          required
          autoComplete="email"
          placeholder="הדוא״ל שלכם"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="bg-background"
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
          className="shrink-0 bg-[#D4AF37] hover:bg-[#A8862A] text-white"
        >
          {busy ? "רושם..." : "הרשמה"}
        </Button>
      </div>
    </form>
  );
}
