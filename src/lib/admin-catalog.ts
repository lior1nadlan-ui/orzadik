// Pure helpers for adding products in the admin: photo sizing, the automatic
// slug, a name guess from a photo's file name, and the category search.
//
// WHY. The owner asked for adding products "by category and photo" to be easy.
// The study of the admin (docs/improvement-workflow.md, "ממצאי הלמידה") found
// four walls: a phone photo is usually over the 5 MB upload cap; only one
// image could be added and the gallery could not be edited at all; the 102
// categories were a flat A-Z list of checkboxes; and a product with a Hebrew
// name could not be saved until the owner invented a URL in English.
//
// No browser or server globals here, so everything is covered by Vitest.

/** Longest side, in pixels, a product photo is stored at. Product pages render
 *  at most ~800 CSS px wide (1600 on a 2x screen), so more is only weight. */
export const MAX_PHOTO_SIDE = 1600;

/** Scale (w, h) down to fit inside `max` on the long side. Never upscales. */
export function fitWithin(w: number, h: number, max: number): { width: number; height: number } {
  if (!(w > 0) || !(h > 0)) return { width: 0, height: 0 };
  const scale = Math.min(1, max / Math.max(w, h));
  return { width: Math.max(1, Math.round(w * scale)), height: Math.max(1, Math.round(h * scale)) };
}

/**
 * Hand-rolled slug maker (no dependency): lowercase, niqqud/diacritics
 * stripped, any run outside [a-z0-9] collapsed to "-", edges trimmed. A
 * Hebrew-only name yields "".
 */
export function slugify(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud / te'amim
    .replace(/[̀-ͯ]/g, "") // Latin combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * The URL slug for a new product, without asking the owner for English.
 *
 * `<words>-<5 digits>`: the Latin words of the name when it has real ones
 * ("Tallit Prestige 60" → `tallit-prestige-60-48213`), otherwise the category
 * slug — a Hebrew name, or one whose only Latin is a size like "16", becomes
 * `candlesticks-48213`. Most of the imported catalogue already ends in such a
 * number (e.g. `...-80333`), and the number keeps a duplicated product, whose
 * name is its original's plus "(עותק)", from colliding with the original.
 * `suffix` is injected so the result is testable.
 */
export function autoSlug(
  name: string,
  categorySlug: string | null | undefined,
  suffix: number,
): string {
  const n = Math.abs(Math.trunc(suffix)) % 100000;
  const latin = slugify(name);
  if (/[a-z]{2,}/.test(latin)) return `${latin.slice(0, 70).replace(/-+$/, "")}-${n}`;
  const base =
    categorySlug && /^[a-z0-9-]+$/.test(categorySlug) ? categorySlug.slice(0, 60) : "product";
  return `${base}-${n}`;
}

/** A random 5-digit number (10000-99999) for autoSlug. */
export function slugSuffix(random: () => number = Math.random): number {
  return 10000 + Math.floor(random() * 90000);
}

/**
 * A product-name guess from a photo's file name, or "" when the file name is
 * just what a camera or WhatsApp called it. "פמוט_כסף-גדול.jpg" → "פמוט כסף
 * גדול"; "IMG_2034.JPG" → "".
 */
export function nameFromFileName(fileName: string): string {
  const base = (fileName ?? "").replace(/\.[a-z0-9]{2,5}$/i, "");
  const words = base
    .replace(/[_\-.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!/[\p{L}]{2,}/u.test(words)) return "";
  if (/^(img|dsc|dscn|pxl|photo|image|screenshot|whatsapp image|picsart|signal)\b/i.test(words)) {
    return "";
  }
  return words.slice(0, 120);
}

export type PickerCategory = { id: string; slug: string; name: string; depth: number };

/**
 * Narrow the category picker to what the owner typed. Empty query → the whole
 * tree; otherwise every category whose name or slug contains the text,
 * flattened, since indentation means nothing once rows are filtered out.
 */
export function filterCategories(options: PickerCategory[], query: string): PickerCategory[] {
  const q = (query ?? "").trim().toLowerCase();
  if (!q) return options;
  return options
    .filter((o) => o.name.toLowerCase().includes(q) || o.slug.includes(q))
    .map((o) => ({ ...o, depth: 0 }));
}

/**
 * The product page shows `thumbnail_url` first, then `product_images` by
 * sort_order, deduplicated (routes/product.$slug.tsx). This turns that into
 * the single ordered list the admin gallery edits, and back.
 */
export function galleryFromProduct(
  thumbnailUrl: string | null | undefined,
  images: Array<{ url: string; sort_order: number | null }>,
): string[] {
  const ordered = [...images]
    .sort(
      (a, b) =>
        (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.url).localeCompare(String(b.url)),
    )
    .map((i) => i.url);
  return Array.from(new Set([...(thumbnailUrl ? [thumbnailUrl] : []), ...ordered].filter(Boolean)));
}

/** Split an edited gallery back into the main image and the extra rows. */
export function splitGallery(urls: string[]): {
  thumbnailUrl: string | null;
  extra: Array<{ url: string; sort_order: number }>;
} {
  const unique = Array.from(new Set(urls.filter(Boolean)));
  return {
    thumbnailUrl: unique[0] ?? null,
    extra: unique.slice(1).map((url, i) => ({ url, sort_order: i + 1 })),
  };
}
