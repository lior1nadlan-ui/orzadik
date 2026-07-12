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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="הגדרות עוגיות"
      className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300"
    >
      <div className="pointer-events-auto mx-auto max-w-md bg-background/95 backdrop-blur-md border border-border rounded-2xl shadow-2xl p-4 sm:p-5 relative">
        <button
          onClick={() => setOpen(false)}
          className="absolute top-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
          aria-label="סגור"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Cookie className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="font-display text-base mb-1">הגדרות עוגיות</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              אנו משתמשים בעוגיות לשיפור החוויה ולניתוח שימוש. בחרו אילו קטגוריות לאשר.{" "}
              <Link to="/privacy" className="underline hover:text-accent">
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

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => persist(true, true)}
                className="flex-1 inline-flex items-center justify-center rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition"
              >
                אישור הכל
              </button>
              <button
                onClick={() => persist(analytics, marketing)}
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-primary/40 bg-background px-3 py-2 text-xs font-medium text-primary hover:bg-primary/5 transition"
              >
                שמירת בחירה
              </button>
              <button
                onClick={() => persist(false, false)}
                className="flex-1 inline-flex items-center justify-center rounded-lg border border-input bg-background px-3 py-2 text-xs font-medium hover:bg-muted transition"
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
