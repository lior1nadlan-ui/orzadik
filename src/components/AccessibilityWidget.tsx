import { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "@tanstack/react-router";
import { Accessibility, X, Plus, Minus, RotateCcw } from "lucide-react";

const STORAGE_KEY = "ozl-a11y-v1";

type A11ySettings = {
  fontScale: number; // percent, 100 = default
  contrast: boolean;
  grayscale: boolean;
  highlightLinks: boolean;
  readableFont: boolean;
  stopAnimations: boolean;
  bigCursor: boolean;
};

const DEFAULTS: A11ySettings = {
  fontScale: 100,
  contrast: false,
  grayscale: false,
  highlightLinks: false,
  readableFont: false,
  stopAnimations: false,
  bigCursor: false,
};

function load(): A11ySettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULTS, ...JSON.parse(raw) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

function apply(s: A11ySettings) {
  if (typeof document === "undefined") return;
  const html = document.documentElement;
  html.style.fontSize = s.fontScale !== 100 ? `${s.fontScale}%` : "";
  html.classList.toggle("a11y-contrast", s.contrast);
  html.classList.toggle("a11y-links", s.highlightLinks);
  html.classList.toggle("a11y-readable", s.readableFont);
  html.classList.toggle("a11y-no-motion", s.stopAnimations);
  html.classList.toggle("a11y-cursor", s.bigCursor);
  // Grayscale uses a CSS filter, which would break the fixed widget if applied
  // to <html>; apply it to the app content wrapper instead (the widget lives
  // outside #app-root).
  const root = document.getElementById("app-root");
  if (root) root.classList.toggle("a11y-grayscale", s.grayscale);
}

export function AccessibilityWidget() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<A11ySettings>(DEFAULTS);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Load + apply persisted settings on mount.
  useEffect(() => {
    const s = load();
    setSettings(s);
    apply(s);
  }, []);

  const update = useCallback((patch: Partial<A11ySettings>) => {
    setSettings((cur) => {
      const next = { ...cur, ...patch };
      apply(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    apply(DEFAULTS);
    setSettings(DEFAULTS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }, []);

  // Focus management (required for an accessible modal dialog):
  //  • move focus into the panel when it opens,
  //  • trap Tab within the panel,
  //  • Escape closes,
  //  • return focus to the trigger button on close.
  useEffect(() => {
    if (!open) return;
    const panel = dialogRef.current;
    // Focus the first focusable control inside the panel.
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((el) => !el.hasAttribute("disabled"));
    focusables()[0]?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && active === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      // Restore focus to the trigger when the dialog closes.
      triggerRef.current?.focus();
    };
  }, [open]);

  const fontMin = settings.fontScale <= 90;
  const fontMax = settings.fontScale >= 150;

  return (
    <>
      {/* Toggle button (bottom-left; WhatsApp is bottom-right) */}
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="תפריט נגישות"
        aria-haspopup="dialog"
        aria-expanded={open}
        className="fixed bottom-5 left-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-2 ring-white/70 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/40"
      >
        <Accessibility className="h-6 w-6" aria-hidden="true" />
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="הגדרות נגישות"
          className="fixed bottom-20 left-5 z-50 w-[88vw] max-w-xs rounded-2xl border border-border bg-background/98 backdrop-blur-md shadow-2xl p-4 animate-in fade-in slide-in-from-bottom-3 duration-200"
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-display text-base font-bold flex items-center gap-2">
              <Accessibility className="h-4 w-4 text-accent" aria-hidden="true" /> נגישות
            </h2>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="סגירת תפריט הנגישות"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Font size */}
          <div className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 mb-2">
            <span className="text-sm font-medium">גודל טקסט ({settings.fontScale}%)</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => update({ fontScale: Math.max(90, settings.fontScale - 10) })}
                disabled={fontMin}
                aria-label="הקטנת טקסט"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input hover:bg-muted disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => update({ fontScale: Math.min(150, settings.fontScale + 10) })}
                disabled={fontMax}
                aria-label="הגדלת טקסט"
                className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-input hover:bg-muted disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1.5">
            <Toggle label="ניגודיות גבוהה" active={settings.contrast} onClick={() => update({ contrast: !settings.contrast })} />
            <Toggle label="גווני אפור" active={settings.grayscale} onClick={() => update({ grayscale: !settings.grayscale })} />
            <Toggle label="הדגשת קישורים" active={settings.highlightLinks} onClick={() => update({ highlightLinks: !settings.highlightLinks })} />
            <Toggle label="גופן קריא" active={settings.readableFont} onClick={() => update({ readableFont: !settings.readableFont })} />
            <Toggle label="עצירת אנימציות" active={settings.stopAnimations} onClick={() => update({ stopAnimations: !settings.stopAnimations })} />
            <Toggle label="סמן עכבר גדול" active={settings.bigCursor} onClick={() => update({ bigCursor: !settings.bigCursor })} />
          </div>

          <button
            type="button"
            onClick={reset}
            className="mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium hover:bg-muted transition"
          >
            <RotateCcw className="h-3.5 w-3.5" /> איפוס הגדרות
          </button>

          <Link
            to="/accessibility"
            onClick={() => setOpen(false)}
            className="mt-2 block text-center text-xs text-accent underline hover:no-underline"
          >
            להצהרת הנגישות המלאה
          </Link>
        </div>
      )}
    </>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={active}
      className={
        "w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm font-medium transition " +
        (active ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted")
      }
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition " +
          (active ? "bg-primary" : "bg-muted-foreground/30")
        }
      >
        <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition " + (active ? "translate-x-0.5" : "translate-x-[18px]")} />
      </span>
    </button>
  );
}
