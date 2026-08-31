import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { sendContactMessage } from "@/lib/contact.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Loader2 } from "lucide-react";

/**
 * On-site contact form. An addition to the phone/WhatsApp/email cards above it,
 * not a replacement — until now every enquiry had to leave the site.
 *
 * Accessibility notes that are load-bearing, not decoration:
 *   • Every field has a real <Label htmlFor>, never a placeholder-as-label.
 *   • The two status regions are ALWAYS mounted (they render an empty node when
 *     idle) so a screen reader announces the text change. A live region that is
 *     mounted at the same moment its text appears is announced unreliably.
 *   • Validation is native (required / type=email / minLength). The server
 *     re-validates with zod — this is the convenience layer, not the gate. The
 *     zod schema deliberately is NOT imported here: it lives in a module that
 *     pulls in the service-role Supabase client.
 *
 * Plain useState only — no window/localStorage — so it renders identically on
 * the server and hydrates without a mismatch.
 */
export function ContactForm() {
  const send = useServerFn(sendContactMessage);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [website, setWebsite] = useState(""); // honeypot
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const set =
    (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    // Mirror the server's `.trim().min()` BEFORE sending. The browser's native
    // minLength counts the untrimmed value, so a message padded with spaces
    // (trailing space from mobile autocomplete, or literal spacebar padding)
    // sails past the browser and then fails zod on the server — turning a
    // fixable typo into a server round-trip and an opaque error. Check it here
    // and name the field instead. The server still re-validates; this only
    // stops the two constraints from disagreeing.
    if (name.length < 2) return setError("אנא הזינו שם מלא.");
    if (message.length < 10) return setError("אנא כתבו הודעה מפורטת מעט יותר.");

    setBusy(true);
    setError("");
    try {
      await send({ data: { name, email, phone: form.phone.trim(), message, website } });
      setSent(true);
      setForm({ name: "", email: "", phone: "", message: "" });
    } catch (err: any) {
      // Show the server's own Hebrew message, but ONLY that. Hebrew alone is not
      // a safe test: a zod failure arrives as ZodError.message, which is a
      // JSON.stringify dump of the issues array — and since this form's schema
      // carries Hebrew messages, that dump matches a Hebrew check too and would
      // be rendered to the visitor as a wall of JSON. Anything JSON-shaped is
      // therefore rejected in favour of the fallback.
      const raw = typeof err?.message === "string" ? err.message.trim() : "";
      const isOwnMessage = /[֐-׿]/.test(raw) && !raw.startsWith("[") && !raw.startsWith("{");
      setError(
        isOwnMessage ? raw : "לא הצלחנו לשלוח את ההודעה. נסו שוב, או פנו אלינו בטלפון או בוואטסאפ.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="glass mt-6 p-5 md:p-6" aria-labelledby="contact-form-title">
      <h2 id="contact-form-title" className="font-display text-xl md:text-2xl text-foreground">
        שלחו לנו הודעה
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        מעדיפים לכתוב? מלאו את הפרטים ונחזור אליכם בדוא"ל.
      </p>

      {/* Success region — mounted from the first render so the announcement fires
          on the text change rather than on the element appearing. */}
      <div aria-live="polite">
        {sent && (
          <p className="mt-4 rounded-xl hairline bg-accent/10 px-4 py-3 text-[15px] leading-relaxed text-foreground">
            תודה! ההודעה נשלחה ✨ נחזור אליכם בהקדם, בדרך כלל תוך יום עסקים אחד.
          </p>
        )}
      </div>

      {!sent && (
        <form onSubmit={onSubmit} className="mt-5 space-y-4" noValidate={false}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="contact-name">שם מלא</Label>
              <Input
                id="contact-name"
                name="name"
                required
                minLength={2}
                maxLength={200}
                autoComplete="name"
                value={form.name}
                onChange={set("name")}
                className="mt-1.5 bg-card"
              />
            </div>
            <div>
              <Label htmlFor="contact-email">דוא"ל</Label>
              <Input
                id="contact-email"
                name="email"
                type="email"
                required
                maxLength={255}
                autoComplete="email"
                dir="ltr"
                value={form.email}
                onChange={set("email")}
                aria-describedby="contact-email-hint"
                className="mt-1.5 bg-card text-right"
              />
              <p id="contact-email-hint" className="mt-1 text-[11px] text-muted-foreground">
                לכתובת הזו נשיב לפנייתכם.
              </p>
            </div>
          </div>

          <div>
            <Label htmlFor="contact-phone">
              טלפון <span className="text-muted-foreground">(לא חובה)</span>
            </Label>
            <Input
              id="contact-phone"
              name="phone"
              type="tel"
              maxLength={40}
              autoComplete="tel"
              dir="ltr"
              value={form.phone}
              onChange={set("phone")}
              aria-describedby="contact-phone-hint"
              className="mt-1.5 bg-card text-right"
            />
            <p id="contact-phone-hint" className="mt-1 text-[11px] text-muted-foreground">
              אם נוח לכם שנחזור בטלפון או בוואטסאפ.
            </p>
          </div>

          <div>
            <Label htmlFor="contact-message">ההודעה שלכם</Label>
            <Textarea
              id="contact-message"
              name="message"
              required
              minLength={10}
              maxLength={4000}
              rows={5}
              value={form.message}
              onChange={set("message")}
              aria-describedby="contact-message-hint"
              className="mt-1.5 bg-card"
            />
            <p id="contact-message-hint" className="mt-1 text-[11px] text-muted-foreground">
              ספרו לנו במה נוכל לעזור — שאלה על מוצר, בקשת התאמה אישית או בירור על הזמנה קיימת (אפשר
              לצרף את מספר ההזמנה).
            </p>
          </div>

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

          {/* Error region — also always mounted while the form is on screen. */}
          <div aria-live="assertive">
            {error && (
              <p className="rounded-xl hairline bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* --accent (5.81:1 with white), never the decorative #D4AF37; the
                hover fill is --accent-strong for the same contrast reason as the
                newsletter button. */}
            <Button
              type="submit"
              disabled={busy}
              aria-busy={busy}
              className="press bg-accent text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  שולח…
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" aria-hidden="true" />
                  שליחת ההודעה
                </>
              )}
            </Button>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              הפרטים שתמסרו ישמשו למענה לפנייה בלבד. פרטים מלאים ב
              <Link
                to="/privacy"
                className="underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent"
              >
                מדיניות הפרטיות
              </Link>
              .
            </p>
          </div>
        </form>
      )}
    </section>
  );
}
