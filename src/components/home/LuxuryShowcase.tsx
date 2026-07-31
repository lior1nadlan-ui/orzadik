import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { thumbUrl } from "@/lib/img";
import { formatILS, getEffectivePrice } from "@/lib/cart";
import { SectionHeader } from "@/components/home/SectionHeader";

/**
 * "פריטי יוקרה" — asymmetric curated showcase: one large flagship card and two
 * stacked premium cards, all linking to real products.
 *
 * להחלפת פריטים (owner note): ערכו את FLAGSHIP_ITEM / STACKED_ITEMS למטה.
 * `slug` חייב להיות slug אמיתי של מוצר קיים באתר, ו-name הוא הכיתוב שיוצג על
 * הכרטיס. **אין לכתוב כאן מחיר** — המחיר נמשך מהמאגר לפי ה-slug ומחושב חי,
 * בדיוק כמו בעמוד המוצר. כרטיס שאין לו `img` מקומי מושך אוטומטית גם את תמונת
 * המוצר מהמאגר (הדרך המומלצת — התמונה תמיד תואמת למוצר). כרטיס עם `img` (כמו
 * מארז החתן, המשתמש בצילום מעוצב מ-public/groom-sets/) מציג את התמונה המקומית
 * כפי שהיא.
 *
 * Prices were hardcoded here until 2026-07-28 and every one of them was the
 * CATALOGUE list price — i.e. exactly 1/0.7 of what the store actually charges,
 * because they never passed through getEffectivePrice() and so never had
 * SITE_DISCOUNT applied. The flagship advertised ₪1,737 for an item whose own
 * page sold it for ₪1,216. A literal here cannot track pricing.ts, so the only
 * safe design is to read the row and run it through the same function the PDP
 * uses. Do not reintroduce a price string.
 */
const FLAGSHIP_ITEM = {
  slug: "acrilic-blessing-90x59-cm-gold-white-83127",
  name: "ברכת הבית אקריליק ענק 90×59 זהב-לבן",
};

type StackedItem = {
  slug: string;
  name: string;
  // When present, a bundled local image (public/…) shown as-is. Otherwise the
  // card pulls the product's own thumbnail from the catalogue by `slug`.
  img?: string;
  imgW?: number;
  imgH?: number;
};

const STACKED_ITEMS: StackedItem[] = [
  { slug: "talit-2871971", name: "טלית פלטניום תשבץ 100% צמר" },
  {
    slug: "groom-set-linen-look-premium",
    // Until 2026-07-31 this read "מארז חתן — ליאם שלום גולי": the PERSONAL NAME
    // of the customer whose bespoke box was photographed, rendered as the card
    // label AND as this image's alt text, on the most-crawled page of the site.
    // A card label must describe the product, never the person who ordered one.
    name: "מארז לחתן — דמוי פשתן, דגם פרימיום",
    // Styled local photo (every public/groom-sets/*.jpeg is 1440×1920).
    img: "/groom-sets/groom-02.jpeg",
    imgW: 1440,
    imgH: 1920,
  },
];

/**
 * Every slug on the board. This is ALL of them, not just the ones needing a
 * photo: a card with a bundled local image still needs its row for the PRICE.
 * Fetched together so the SSR loader seeds them in one round-trip and both the
 * flagship photo and every price are in the initial HTML.
 */
const DB_SLUGS = [FLAGSHIP_ITEM.slug, ...STACKED_ITEMS.map((s) => s.slug)];

/**
 * Rendered width of a stacked card: ~450 CSS px at the desktop breakpoint,
 * half-width on mobile (the pair sits two-up). We ask the storage transform for
 * this size instead of the 500–1000 px original.
 */
const STACKED_THUMB_W = 600;

/** The flagship card is up to 3/5 of a max-w-6xl grid — ask for a larger box. */
const FLAGSHIP_THUMB_W = 1000;

/** Per-slug catalogue row behind a card: its photo and its raw list price. */
export type LuxuryCards = Record<string, { thumb: string | null; price: number | null }>;

/**
 * The query behind the cards. Exported so a route loader can run it on the
 * server and hand the result back as `initialCards` — same function, same
 * shape, so the SSR HTML and the client refetch can never disagree.
 *
 * `price` is the RAW catalogue price straight from the row. It is deliberately
 * NOT discounted here: getEffectivePrice() is applied at the render site, so
 * this component runs the identical function the PDP and the cart run and the
 * three can never drift.
 */
export async function fetchLuxuryShowcaseCards(): Promise<LuxuryCards> {
  const { data, error } = await supabase
    .from("products")
    .select("slug, thumbnail_url, price")
    .in("slug", DB_SLUGS);
  if (error) throw error;
  return Object.fromEntries(
    (data ?? []).map((p) => [
      p.slug,
      { thumb: p.thumbnail_url, price: p.price === null ? null : Number(p.price) },
    ]),
  );
}

/** Live price for a card, or null when the row hasn't loaded / has no price.
 *  A missing price renders NOTHING — a placeholder number would be a lie. */
function cardPrice(cards: LuxuryCards | undefined, slug: string): string | null {
  const raw = cards?.[slug]?.price;
  if (raw === null || raw === undefined || !Number.isFinite(raw) || raw <= 0) return null;
  return formatILS(getEffectivePrice(raw));
}

export function LuxuryShowcase({ initialCards }: { initialCards?: LuxuryCards }) {
  // Same query pattern as the featured-products carousel — pull each product's
  // own thumbnail and price so the card always matches the real item.
  const { data: cards } = useQuery({
    queryKey: ["home-luxury-showcase-cards", DB_SLUGS],
    staleTime: 5 * 60_000,
    // Seeded from the SSR loader when the caller has it, so the photos and
    // prices are in the initial HTML instead of appearing only after hydration.
    initialData: initialCards,
    queryFn: fetchLuxuryShowcaseCards,
  });

  // Flagship photo — right-sized transform of the catalogue original, same
  // rewrite-detection as the stacked cards below.
  const flagThumb = cards?.[FLAGSHIP_ITEM.slug]?.thumb ?? null;
  const flagSrc = thumbUrl(flagThumb, FLAGSHIP_THUMB_W);
  const flagSrcSet =
    flagSrc && flagSrc !== flagThumb
      ? [600, FLAGSHIP_THUMB_W, 1400]
          .map((w) => `${thumbUrl(flagThumb, w)} ${w}w`)
          .join(", ")
      : undefined;

  return (
    // The cream fill + border-y band is gone: the ground is the page's own white
    // mesh, structured by two 1px gold rules (same 2px of chrome as the old
    // border-y, so the section's height is unchanged).
    <section>
      <span aria-hidden="true" className="gold-rule block w-full" />
      <div className="container mx-auto px-4 py-14 md:py-20">
        <SectionHeader
          eyebrow="אוסף היוקרה"
          title="פריטי יוקרה נבחרים"
          sub="הפריטים המוקפדים והמרשימים ביותר בקטלוג שלנו"
        />

        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-6">
          {/* Large flagship card — a signature wall piece, photo from the DB */}
          <Link
            to="/product/$slug"
            params={{ slug: FLAGSHIP_ITEM.slug }}
            className="group glass-lift relative block md:col-span-3 aspect-[4/3] overflow-hidden rounded-lg border border-gold/40 bg-muted"
          >
            {flagSrc && (
              <img
                src={flagSrc}
                srcSet={flagSrcSet}
                // Three of five columns inside a max-w-6xl grid on desktop,
                // full-bleed below it.
                sizes={flagSrcSet ? "(min-width: 768px) 58vw, 100vw" : undefined}
                alt={FLAGSHIP_ITEM.name}
                loading="lazy"
                decoding="async"
                // Catalogue thumbnails are square; the card's aspect classes
                // drive the layout regardless.
                width={FLAGSHIP_THUMB_W}
                height={FLAGSHIP_THUMB_W}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
              />
            )}
            {/* Decorative frost only — the caption no longer depends on a scrim
                for contrast, because it rides on its own glass-strong plate. */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/45 via-transparent to-transparent" />
            {/* glass-strong is mandatory here: this plate sits on a photograph, so
                the backing is unknown. At 94% white the worst case is #F0F0F0 —
                foreground ink 15.8:1, --accent 5.10:1. A cream name or a
                gold-bright price on this plate would be 1.1:1 / 1.8:1. */}
            <div className="glass-strong absolute inset-x-4 bottom-4 p-5 [--glass-radius:1rem]">
              <span className="block font-display text-2xl text-foreground">{FLAGSHIP_ITEM.name}</span>
              {/* Live price, or nothing at all. Never a placeholder number. */}
              {cardPrice(cards, FLAGSHIP_ITEM.slug) && (
                <span className="mt-1 block text-accent text-xl font-bold">
                  {cardPrice(cards, FLAGSHIP_ITEM.slug)}
                </span>
              )}
            </div>
          </Link>

          {/* Two stacked cards — a pair, two-up on mobile, stacked on desktop */}
          <div className="md:col-span-2 grid grid-cols-2 md:grid-cols-1 gap-6 md:grid-rows-2">
            {STACKED_ITEMS.map((s) => {
              const localImg = s.img;
              const thumb = localImg ? null : cards?.[s.slug]?.thumb ?? null;
              const price = cardPrice(cards, s.slug);
              // Right-sized transform of the catalog original. thumbUrl returns
              // the input untouched for anything that is not a Supabase public
              // object URL, so only offer a srcset when it actually rewrote it.
              const src = localImg ?? thumbUrl(thumb, STACKED_THUMB_W);
              const srcSet =
                !localImg && src && src !== thumb
                  ? [400, STACKED_THUMB_W, 900]
                      .map((w) => `${thumbUrl(thumb, w)} ${w}w`)
                      .join(", ")
                  : undefined;
              return (
                <Link
                  key={s.slug}
                  to="/product/$slug"
                  params={{ slug: s.slug }}
                  className="group glass-lift relative block aspect-[4/3] md:aspect-auto overflow-hidden rounded-lg border border-gold/40 bg-muted"
                >
                  {src && (
                    <img
                      src={src}
                      srcSet={srcSet}
                      // Half-width on mobile (the pair is two-up), two of five
                      // columns inside the max-w-6xl grid on desktop.
                      sizes={srcSet ? "(min-width: 768px) 40vw, 50vw" : undefined}
                      alt={s.name}
                      loading="lazy"
                      decoding="async"
                      // Local images carry their real dimensions; DB thumbnails
                      // are square. The card's aspect classes drive the layout.
                      width={localImg ? s.imgW ?? STACKED_THUMB_W : STACKED_THUMB_W}
                      height={localImg ? s.imgH ?? STACKED_THUMB_W : STACKED_THUMB_W}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
                    />
                  )}
                  {/* Decorative frost only — see the flagship card above. */}
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/45 via-transparent to-transparent" />
                  <div className="glass-strong absolute inset-x-3 bottom-3 p-4 [--glass-radius:1rem]">
                    <span className="block font-display text-lg text-foreground leading-snug">{s.name}</span>
                    {price && <span className="mt-1 block text-accent text-lg font-bold">{price}</span>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-8 md:mt-10">
          <Link
            to="/shop"
            className="text-sm md:text-base text-accent underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
          >
            לכל פריטי היוקרה בחנות ←
          </Link>
        </div>
      </div>
      <span aria-hidden="true" className="gold-rule block w-full" />
    </section>
  );
}
