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

// Restore the visitor's persisted accessibility preferences to the document.
// The widget UI is deferred to browser-idle for performance (see __root.tsx),
// but a returning user's saved settings must be re-applied right away rather
// than after that deferred mount — so root calls this eagerly on load. It stays
// idempotent with the widget's own on-mount apply(load()) (same values), and is
// SSR-safe: load() and apply() both no-op when window/document are unavailable.
export function applySavedA11ySettings() {
  apply(load());
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
      ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);
    // Exclude tabindex=-1 controls so the trap's first/last stops are always
    // real, focusable elements (mirrors the SiteHeader search dialog).
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
        className="press fab-float fixed bottom-5 left-5 z-50 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:[transform:scale(1.05)]"
      >
        <Accessibility className="h-6 w-6" aria-hidden="true" />
      </button>

      {/* The panel stays MOUNTED and toggles classes, so open AND close are one
          interruptible CSS transition (keyframe utilities like animate-in /
          slide-in-from-* are one-shot and cannot be reversed mid-flight — the
          Emil standard forbids them on toggled UI).
          `visibility` is in the transition list on purpose: CSS holds `visible`
          for the whole duration when transitioning TO hidden, so the panel can
          fade out before it leaves the tab order and the a11y tree. That is also
          why no `aria-hidden` is needed — visibility:hidden already removes it.
          transform-origin follows the trigger (the bottom-left FAB), not centre.
          glass-strong already draws its own hairline (inset --glass-line-strong)
          and lift shadow; adding .hairline on top would REPLACE that box-shadow
          and throw the shadow away. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="הגדרות נגישות"
        className={
          // fab-float-panel: lifted above a page-level mobile action bar (see
          // styles.css). max-h/overflow so the raised offset can never push the
          // panel off a short viewport — it scrolls instead. The focus trap
          // queries the DOM, so .focus() simply scrolls a control into view.
          "glass-strong fab-float-panel fixed bottom-20 left-5 z-50 w-[88vw] max-w-xs p-4 origin-bottom-left " +
          // dvh, and capped against the LIFTED bottom offset (9.5rem) plus a
          // 2rem top margin — not 75vh. vh resolves against the large viewport
          // (toolbars retracted), so on a short phone the cap would never engage
          // while the lift still applied, pushing the panel's TOP edge off
          // screen — which overflow-y-auto cannot rescue, since the box itself
          // is out of view.
          "max-h-[calc(100dvh-11.5rem)] overflow-y-auto overscroll-contain " +
          "[--glass-radius:1.25rem] transition-[opacity,transform,visibility] duration-200 ease-out " +
          (open
            ? "visible opacity-100"
            : // Under prefers-reduced-motion the movement class is simply never
              // emitted, so the panel only fades — colour/opacity kept, motion dropped.
              "invisible opacity-0 motion-safe:[transform:translateY(8px)_scale(0.95)]")
        }
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display text-base font-bold flex items-center gap-2">
            <Accessibility className="h-4 w-4 text-accent" aria-hidden="true" /> נגישות
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="סגירת תפריט הנגישות"
            className="press inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="gold-rule mb-3" aria-hidden="true" />

        {/* Font size */}
        <div className="hairline flex items-center justify-between gap-2 rounded-lg p-2.5 mb-2">
          <span className="text-sm font-medium">גודל טקסט ({settings.fontScale}%)</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => update({ fontScale: Math.max(90, settings.fontScale - 10) })}
              disabled={fontMin}
              aria-label="הקטנת טקסט"
              className="press inline-flex h-7 w-7 items-center justify-center rounded-md border border-input disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => update({ fontScale: Math.min(150, settings.fontScale + 10) })}
              disabled={fontMax}
              aria-label="הגדלת טקסט"
              className="press inline-flex h-7 w-7 items-center justify-center rounded-md border border-input disabled:opacity-40 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
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
          className="press mt-3 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-input px-3 py-2 text-sm font-medium [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
        >
          <RotateCcw className="h-3.5 w-3.5" /> איפוס הגדרות
        </button>

        <Link
          to="/accessibility"
          onClick={() => setOpen(false)}
          className="mt-2 block text-center text-xs text-accent underline underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:no-underline"
        >
          להצהרת הנגישות המלאה
        </Link>
      </div>
    </>
  );
}

function Toggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    // No colour transition alongside `press`: styles.css declares .press later
    // in the utilities layer, so its `transition-property: transform` wins and a
    // `transition-colors` here would be dead code. The state flip is instant,
    // which the standard is fine with — only the press gesture animates.
    <button
      type="button"
      onClick={onClick}
      role="switch"
      aria-checked={active}
      className={
        "press w-full flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm font-medium " +
        (active
          // text-accent on bg-accent/10 over the glass panel = 5.06:1.
          ? "border-accent/40 bg-accent/10 text-accent"
          : "border-border text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary")
      }
    >
      <span>{label}</span>
      <span
        aria-hidden="true"
        dir="ltr"
        className={
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full " +
          // The track is a non-text UI component, so it needs 3:1 against the
          // panel: --accent is 5.81:1 on and --input 3.25:1 off. The previous
          // "off" track (muted-foreground/30) sat at ~1.6:1 and was invisible.
          (active ? "bg-accent" : "bg-input")
        }
      >
        <span
          className={
            // motion-safe on all three parts together: dropping only `duration`
            // would leave transition-property at its `all` initial value.
            "inline-block h-4 w-4 rounded-full bg-white motion-safe:transition-[transform] motion-safe:duration-200 motion-safe:ease-out " +
            // Tailwind v4's translate-* utilities write the `translate` property,
            // not `transform`, so an explicit transform keeps the knob on the one
            // property the transition above actually names.
            (active ? "[transform:translateX(2px)]" : "[transform:translateX(18px)]")
          }
        />
      </span>
    </button>
  );
}
