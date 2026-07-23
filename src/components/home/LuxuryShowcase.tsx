import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { thumbUrl } from "@/lib/img";

/**
 * "פריטי יוקרה" — asymmetric curated showcase: one large flagship card and two
 * stacked premium cards, all linking to real products.
 *
 * להחלפת פריטים (owner note): ערכו את LARGE_ITEM / STACKED_ITEMS למטה.
 * `slug` חייב להיות slug אמיתי של מוצר קיים באתר, ו-name/price הם הטקסטים
 * שיוצגו על הכרטיס. הכרטיס הגדול משתמש בתמונה מקומית מ-public/groom-sets/
 * (groom-01..17.jpeg); שני הכרטיסים הקטנים מושכים אוטומטית את תמונת המוצר
 * עצמו מהמאגר לפי ה-slug.
 */
const LARGE_ITEM = {
  slug: "groom-set-liam-shalom-goli",
  name: "מארז חתן — ליאם שלום גולי",
  price: "‏2,572 ₪",
  img: "/groom-sets/groom-02.jpeg",
  // Intrinsic size of the file on disk — every public/groom-sets/*.jpeg is
  // 1440×1920. Declared so the browser reserves the box before the bytes land.
  width: 1440,
  height: 1920,
};

const STACKED_ITEMS: { slug: string; name: string; price: string }[] = [
  { slug: "talit-2871971", name: "טלית פלטניום תשבץ 100% צמר", price: "‏1,572 ₪" },
  { slug: "acrilic-blessing-90x59-cm-gold-white-83127", name: "ברכת הבית אקריליק ענק 90×59 זהב-לבן", price: "‏1,737 ₪" },
];

const STACKED_SLUGS = STACKED_ITEMS.map((s) => s.slug);

/**
 * Rendered width of a stacked card: ~450 CSS px at the desktop breakpoint,
 * full-width on mobile. We ask the storage transform for this size instead of
 * the 500–1000 px original.
 */
const STACKED_THUMB_W = 600;

export type LuxuryThumbs = Record<string, string | null>;

/**
 * The query behind the two stacked cards. Exported so a route loader can run it
 * on the server and hand the result back as `initialThumbs` — same function,
 * same shape, so the SSR HTML and the client refetch can never disagree.
 */
export async function fetchLuxuryShowcaseThumbs(): Promise<LuxuryThumbs> {
  const { data, error } = await supabase
    .from("products")
    .select("slug, thumbnail_url")
    .in("slug", STACKED_SLUGS);
  if (error) throw error;
  return Object.fromEntries((data ?? []).map((p) => [p.slug, p.thumbnail_url]));
}

export function LuxuryShowcase({ initialThumbs }: { initialThumbs?: LuxuryThumbs }) {
  // Same query pattern as the featured-products carousel — pull each product's
  // own thumbnail so the card always shows the real item photo.
  const { data: thumbs } = useQuery({
    queryKey: ["home-luxury-showcase-thumbs", STACKED_SLUGS],
    staleTime: 5 * 60_000,
    // Seeded from the SSR loader when the caller has it, so the photos are in
    // the initial HTML instead of appearing only after hydration.
    initialData: initialThumbs,
    queryFn: fetchLuxuryShowcaseThumbs,
  });

  return (
    // The cream fill + border-y band is gone: the ground is the page's own white
    // mesh, structured by two 1px gold rules (same 2px of chrome as the old
    // border-y, so the section's height is unchanged).
    <section>
      <span aria-hidden="true" className="gold-rule block w-full" />
      <div className="container mx-auto px-4 py-16 md:py-24">
        {/* Mirrors SectionHeader in src/routes/index.tsx — keep the two in step. */}
        <div className="text-center mb-10 md:mb-14">
          <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase mb-3">
            אוסף היוקרה
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-wide text-foreground">
            פריטי יוקרה נבחרים
          </h2>
          <span aria-hidden="true" className="gold-rule block w-24 mx-auto mt-4" />
          <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            היצירות המוקפדות ביותר של הבית — במלאי מוגבל
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-6">
          {/* Large flagship card */}
          <Link
            to="/product/$slug"
            params={{ slug: LARGE_ITEM.slug }}
            className="group glass-lift relative block md:col-span-3 aspect-[4/3] overflow-hidden rounded-lg border border-gold/40"
          >
            <img
              src={LARGE_ITEM.img}
              alt={LARGE_ITEM.name}
              loading="lazy"
              decoding="async"
              width={LARGE_ITEM.width}
              height={LARGE_ITEM.height}
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
            />
            {/* Decorative frost only — the caption no longer depends on a scrim
                for contrast, because it rides on its own glass-strong plate. */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/45 via-transparent to-transparent" />
            {/* glass-strong is mandatory here: this plate sits on a photograph, so
                the backing is unknown. At 94% white the worst case is #F0F0F0 —
                foreground ink 15.8:1, --accent 5.10:1. A cream name or a
                gold-bright price on this plate would be 1.1:1 / 1.8:1. */}
            <div className="glass-strong absolute inset-x-4 bottom-4 p-5 [--glass-radius:1rem]">
              <span className="block font-display text-2xl text-foreground">{LARGE_ITEM.name}</span>
              <span className="mt-1 block text-accent text-xl font-bold">{LARGE_ITEM.price}</span>
            </div>
          </Link>

          {/* Two stacked cards — each shows its own product photo from the DB */}
          <div className="md:col-span-2 grid gap-6 md:grid-rows-2">
            {STACKED_ITEMS.map((s) => {
              const thumb = thumbs?.[s.slug] ?? null;
              // Right-sized transform of the catalog original. thumbUrl returns
              // the input untouched for anything that is not a Supabase public
              // object URL, so only offer a srcset when it actually rewrote it.
              const src = thumbUrl(thumb, STACKED_THUMB_W);
              const srcSet =
                src && src !== thumb
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
                      // Two of five columns inside a max-w-6xl grid on desktop,
                      // full-bleed below it.
                      sizes={srcSet ? "(min-width: 768px) 40vw, 100vw" : undefined}
                      alt={s.name}
                      loading="lazy"
                      decoding="async"
                      // The transform is requested at STACKED_THUMB_W and catalog
                      // thumbnails are square, so that is the delivered box. The
                      // card's own aspect classes drive the layout regardless.
                      width={STACKED_THUMB_W}
                      height={STACKED_THUMB_W}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-[1.04]"
                    />
                  )}
                  {/* Decorative frost only — see the flagship card above. */}
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-white/45 via-transparent to-transparent" />
                  <div className="glass-strong absolute inset-x-3 bottom-3 p-4 [--glass-radius:1rem]">
                    <span className="block font-display text-lg text-foreground leading-snug">{s.name}</span>
                    <span className="mt-1 block text-accent text-lg font-bold">{s.price}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        <div className="text-center mt-8 md:mt-10">
          <Link
            to="/category/$slug"
            params={{ slug: "chatan-kala" }}
            className="text-sm md:text-base text-accent underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
          >
            לכל מארזי החתן והכלה ←
          </Link>
        </div>
      </div>
      <span aria-hidden="true" className="gold-rule block w-full" />
    </section>
  );
}
