import { Star } from "lucide-react";

/** Read-only star rating display (supports halves via fill width). */
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
            <Star className="absolute inset-0 text-[#D4AF37]" style={{ width: size, height: size }} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
              <Star
                className="text-[#D4AF37]"
                style={{ width: size, height: size }}
                fill="#D4AF37"
              />
            </span>
          </span>
        );
      })}
    </div>
  );
}

/** Interactive 1–5 star picker for the review form. */
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
          <Star
            style={{ width: size, height: size }}
            className="text-[#D4AF37] transition-transform hover:scale-110"
            fill={n <= value ? "#D4AF37" : "none"}
          />
        </button>
      ))}
    </div>
  );
}
