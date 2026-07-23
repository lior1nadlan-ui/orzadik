import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const STORAGE_KEY = "cookie-consent-v2";
export const COOKIE_SETTINGS_EVENT = "ozl:open-cookie-settings";

export type CookieConsentValue = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  timestamp: number;
};

/**
 * Read the stored cookie consent. Analytics/marketing tags MUST gate on this
 * (e.g. `if (readCookieConsent()?.analytics) loadAnalytics()`) so nothing fires
 * before the visitor has made a choice.
 */
export function readCookieConsent(): CookieConsentValue | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CookieConsentValue;
  } catch {
    return null;
  }
}

/** Re-open the cookie preferences banner (wire to a footer "הגדרות עוגיות" link). */
export function openCookieSettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(COOKIE_SETTINGS_EVENT));
  }
}

function saveConsent(v: CookieConsentValue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
    window.dispatchEvent(new Event("ozl:cookie-consent-changed"));
  } catch {}
}

export function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  // Show automatically on first visit; also open on demand via the global event.
  useEffect(() => {
    const existing = readCookieConsent();
    if (!existing) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, []);

  useEffect(() => {
    const onOpen = () => {
      const cur = readCookieConsent();
      setAnalytics(!!cur?.analytics);
      setMarketing(!!cur?.marketing);
      setOpen(true);
    };
    window.addEventListener(COOKIE_SETTINGS_EVENT, onOpen);
    return () => window.removeEventListener(COOKIE_SETTINGS_EVENT, onOpen);
  }, []);

  const persist = (a: boolean, m: boolean) => {
    saveConsent({ necessary: true, analytics: a, marketing: m, timestamp: Date.now() });
    setOpen(false);
  };

  // The band stays MOUNTED and toggles classes so first-show and dismiss are the
  // same interruptible transition (keyframe utilities are one-shot and cannot be
  // reversed mid-flight). `visibility` is in the transition list so CSS holds
  // `visible` through the fade-out before the band leaves the tab order and the
  // a11y tree — which is also why no aria-hidden is needed here.
  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="הגדרות עוגיות"
      className={
        "fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none " +
        "transition-[opacity,transform,visibility] duration-300 ease-out " +
        (open
          ? "visible opacity-100"
          : // prefers-reduced-motion: the movement class is never emitted, so the
            // band only fades — colour and opacity are kept, motion is dropped.
            "invisible opacity-0 motion-safe:[transform:translateY(16px)]")
      }
    >
      {/* glass-strong is the only glass that is contrast-safe over an unknown
          backdrop, and this band floats over whatever page the visitor landed
          on. It already carries its own hairline + lift shadow, so no .hairline
          here (that would replace the box-shadow and drop the shadow). */}
      <div className="glass-strong pointer-events-auto mx-auto max-w-md p-4 sm:p-5 relative overflow-hidden [--glass-radius:1.25rem]">
        {/* Decorative gold hairline along the top edge of the pane. */}
        <div className="gold-rule absolute inset-x-0 top-0" aria-hidden="true" />
        <button
          onClick={() => setOpen(false)}
          className="press absolute top-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
          aria-label="סגור"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base mb-1">הגדרות עוגיות</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              אנו משתמשים בעוגיות לשיפור החוויה ולניתוח שימוש. בחרו אילו קטגוריות לאשר.{" "}
              <Link
                to="/privacy"
                className="text-accent underline underline-offset-2 transition-[color] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                למידע נוסף
              </Link>
              .
            </p>

            {/* Per-category controls */}
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold">עוגיות הכרחיות</div>
                  <div className="text-[11px] text-muted-foreground">נדרשות לתפעול האתר — תמיד פעילות.</div>
                </div>
                <Switch checked disabled aria-label="עוגיות הכרחיות (תמיד פעילות)" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold">עוגיות אנליטיקה</div>
                  <div className="text-[11px] text-muted-foreground">מדידת תנועה ושיפור האתר.</div>
                </div>
                <Switch checked={analytics} onCheckedChange={setAnalytics} aria-label="עוגיות אנליטיקה" />
              </div>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-semibold">עוגיות שיווק</div>
                  <div className="text-[11px] text-muted-foreground">התאמת תוכן ומבצעים.</div>
                </div>
                <Switch checked={marketing} onCheckedChange={setMarketing} aria-label="עוגיות שיווק" />
              </div>
            </div>

            {/* All three consent actions keep the same size and shape — only the
                fill differs — so declining is never harder to find than accepting.
                The stored default stays analytics:false / marketing:false. */}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => persist(true, true)}
                className="press flex-1 inline-flex items-center justify-center rounded-lg bg-accent px-3 py-2 text-xs font-medium text-accent-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
              >
                אישור הכל
              </button>
              <button
                onClick={() => persist(analytics, marketing)}
                className="press flex-1 inline-flex items-center justify-center rounded-lg border border-input px-3 py-2 text-xs font-medium text-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
              >
                שמירת בחירה
              </button>
              <button
                onClick={() => persist(false, false)}
                className="press flex-1 inline-flex items-center justify-center rounded-lg border border-input px-3 py-2 text-xs font-medium text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
              >
                דחיית לא-הכרחיות
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
