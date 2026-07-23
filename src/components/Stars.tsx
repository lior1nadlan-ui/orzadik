import { Star } from "lucide-react";

/**
 * Read-only star rating display (supports halves via fill width).
 *
 * The whole group is `aria-hidden` — the numeric rating is always announced by
 * the surrounding text — so the gold here is purely decorative. It still moves
 * off the raw `#D4AF37` (2.1:1 on white) onto the `--accent` token: one brand
 * gold across both twins, and it is the gold that styles.css clamps to #5c4300
 * in high-contrast mode.
 */
export function Stars({
  value,
  size = 16,
  className = "",
}: {
  value: number;
  size?: number;
  className?: string;
}) {
  const full = Math.floor(value);
  const frac = value - full;
  return (
    <div className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden>
      {Array.from({ length: 5 }).map((_, i) => {
        const fill = i < full ? 1 : i === full ? frac : 0;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star className="absolute inset-0 text-accent" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star
                className="text-accent"
                style={{ width: size, height: size }}
                fill="currentColor"
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/**
 * Interactive 1–5 star picker for the review form.
 *
 * CONTRAST — this is the reason the file changed. Selection state is signalled
 * ONLY by the star fill, which makes it a non-text contrast target under WCAG
 * 1.4.11 (3:1 minimum). The old `#D4AF37` measured 2.1:1 on white and failed.
 * `--accent` (#7E611E) is 5.81:1 on white, 5.71:1 on `.glass` and 5.14:1 on
 * `--secondary` — clear in every place a review form can land. Both the stroke
 * and the fill use it (`currentColor`), so the filled/empty distinction is
 * carried by a colour that is legible either way.
 *
 * The radiogroup/radio roles and aria-checked are load-bearing and unchanged.
 */
export function StarInput({
  value,
  onChange,
  size = 28,
}: {
  value: number;
  onChange: (v: number) => void;
  size?: number;
}) {
  return (
    <div className="inline-flex items-center gap-1" role="radiogroup" aria-label="דירוג">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} כוכבים`}
          onClick={() => onChange(n)}
          className="p-0.5"
        >
          {/* Hover growth is gated to real pointers so it never sticks on touch,
              and to motion-safe so reduced motion keeps the colour and drops the
              movement. v4 emits scale-* to the standalone `scale` property. */}
          <Star
            style={{ width: size, height: size }}
            className="text-accent transition-[transform,scale] duration-160 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:scale-110"
            fill={n <= value ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
