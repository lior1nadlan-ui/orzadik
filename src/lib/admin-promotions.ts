// Pure helpers for the CRM promotions screen (/admin/promotions) and its server
// functions — status, validation, date round-trips and the preview numbers.
// No I/O here, so every rule is unit-tested; see docs/promotions-wave.md.
import { getEffectivePrice } from "@/lib/pricing";
import { promoPrice } from "@/lib/promotions";

export type PromotionScope = "all" | "categories" | "products";

export type PromotionRecord = {
  id: string;
  name: string;
  badge_label: string | null;
  percent_off: number;
  scope: PromotionScope;
  category_ids: string[];
  product_ids: string[];
  starts_at: string;
  ends_at: string;
  is_active: boolean;
};

export type PromotionStatus = "active" | "scheduled" | "ended" | "disabled";

export const STATUS_LABEL: Record<PromotionStatus, string> = {
  active: "פעיל",
  scheduled: "מתוכנן",
  ended: "הסתיים",
  disabled: "בוטל",
};

export function promotionStatus(
  p: Pick<PromotionRecord, "is_active" | "starts_at" | "ends_at">,
  now: Date = new Date(),
): PromotionStatus {
  if (!p.is_active) return "disabled";
  const t = now.getTime();
  if (new Date(p.ends_at).getTime() <= t) return "ended";
  if (new Date(p.starts_at).getTime() > t) return "scheduled";
  return "active";
}

export function scopeSummary(
  p: Pick<PromotionRecord, "scope" | "category_ids" | "product_ids">,
): string {
  if (p.scope === "all") return "כל החנות";
  if (p.scope === "categories") {
    const n = p.category_ids.length;
    return n === 1 ? "קטגוריה אחת" : `${n} קטגוריות`;
  }
  const n = p.product_ids.length;
  return n === 1 ? "מוצר אחד" : `${n} מוצרים`;
}

/** What the form submits. Dates are ISO strings. */
export type PromotionInput = {
  name: string;
  badge_label: string | null;
  percent_off: number;
  scope: PromotionScope;
  category_ids: string[];
  product_ids: string[];
  starts_at: string;
  ends_at: string;
  /** Required for more than HIGH_DISCOUNT percent — a second, deliberate yes. */
  confirm_high_discount?: boolean;
};

export const MAX_PERCENT = 70;
export const HIGH_DISCOUNT = 50;
export const MAX_PRODUCTS = 500;

/**
 * Every reason the input cannot be saved, in Hebrew, for the form. Empty = ok.
 * The database checks the same limits again; these exist so the owner reads
 * the reason instead of a constraint name. `isNew` adds "must end in the
 * future" — an existing promotion may be saved after it ended (e.g. renamed).
 */
export function promotionInputErrors(
  input: PromotionInput,
  { isNew, now = new Date() }: { isNew: boolean; now?: Date },
): string[] {
  const errors: string[] = [];
  const name = input.name.trim();
  if (!name) errors.push("חסר שם למבצע.");
  if (name.length > 120) errors.push("שם המבצע ארוך מדי (עד 120 תווים).");
  if ((input.badge_label ?? "").trim().length > 40)
    errors.push("התווית לאתר ארוכה מדי (עד 40 תווים).");

  const pct = input.percent_off;
  if (!Number.isFinite(pct) || pct <= 0) errors.push("אחוז ההנחה חייב להיות גדול מ-0.");
  else if (pct > MAX_PERCENT) errors.push(`אחוז ההנחה המרבי הוא ${MAX_PERCENT}.`);
  else if (pct > HIGH_DISCOUNT && !input.confirm_high_discount)
    errors.push(`הנחה מעל ${HIGH_DISCOUNT}% דורשת אישור — סמנו את תיבת האישור.`);

  if (input.scope === "categories" && input.category_ids.length === 0)
    errors.push("בחרו לפחות קטגוריה אחת.");
  if (input.scope === "products" && input.product_ids.length === 0)
    errors.push("בחרו לפחות מוצר אחד.");
  if (input.product_ids.length > MAX_PRODUCTS)
    errors.push(`אפשר לבחור עד ${MAX_PRODUCTS} מוצרים; למבצע גדול יותר בחרו קטגוריה.`);

  const start = new Date(input.starts_at).getTime();
  const end = new Date(input.ends_at).getTime();
  if (!Number.isFinite(start)) errors.push("תאריך ההתחלה לא תקין.");
  if (!Number.isFinite(end)) errors.push("חסר תאריך סיום — מבצע חייב להסתיים.");
  if (Number.isFinite(start) && Number.isFinite(end) && end <= start)
    errors.push("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.");
  if (isNew && Number.isFinite(end) && end <= now.getTime()) errors.push("תאריך הסיום כבר עבר.");
  return errors;
}

/** ISO → the value an <input type="datetime-local"> shows, in the browser's zone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO. "" for an empty or bad value. */
export function fromLocalInput(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
}

/** A new promotion's default window: from now to the end of the day a week from now. */
export function defaultWindow(now: Date = new Date()): { starts_at: string; ends_at: string } {
  const end = new Date(now);
  end.setDate(end.getDate() + 7);
  end.setHours(23, 59, 0, 0);
  return { starts_at: now.toISOString(), ends_at: end.toISOString() };
}

/** The price range a preview prints: catalogue prices → what shoppers will pay. */
export function previewRange(
  minCatalogue: number | null,
  maxCatalogue: number | null,
  percentOff: number,
): { from: { regular: number; pays: number }; to: { regular: number; pays: number } } | null {
  if (minCatalogue == null || maxCatalogue == null) return null;
  const promo = { id: "preview", percentOff, label: null, endsAt: "" };
  const at = (price: number) => {
    const regular = getEffectivePrice(price);
    return { regular, pays: promoPrice(regular, percentOff > 0 ? promo : null) };
  };
  return { from: at(minCatalogue), to: at(maxCatalogue) };
}
