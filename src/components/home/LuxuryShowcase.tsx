import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
};

const STACKED_ITEMS: { slug: string; name: string; price: string }[] = [
  { slug: "talit-2871971", name: "טלית פלטניום תשבץ 100% צמר", price: "‏1,572 ₪" },
  { slug: "acrilic-blessing-90x59-cm-gold-white-83127", name: "ברכת הבית אקריליק ענק 90×59 זהב-לבן", price: "‏1,737 ₪" },
];

export function LuxuryShowcase() {
  // Same query pattern as the featured-products carousel — pull each product's
  // own thumbnail so the card always shows the real item photo.
  const { data: thumbs } = useQuery({
    queryKey: ["home-luxury-showcase-thumbs", STACKED_ITEMS.map((s) => s.slug)],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Record<string, string | null>> => {
      const { data, error } = await supabase
        .from("products")
        .select("slug, thumbnail_url")
        .in("slug", STACKED_ITEMS.map((s) => s.slug));
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((p) => [p.slug, p.thumbnail_url]));
    },
  });

  return (
    <section className="bg-cream border-y border-gold/40">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="text-center mb-10 md:mb-14">
          <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-3">
            אוסף היוקרה
          </p>
          <h2 className="font-display text-3xl md:text-4xl tracking-wide">
            פריטי יוקרה נבחרים
          </h2>
          <span aria-hidden="true" className="block h-px w-24 mx-auto mt-4 bg-[image:var(--gradient-gold-line)]" />
          <p className="mt-4 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            היצירות המוקפדות ביותר של הבית — במלאי מוגבל
          </p>
        </div>

        <div className="max-w-6xl mx-auto grid md:grid-cols-5 gap-6">
          {/* Large flagship card */}
          <Link
            to="/product/$slug"
            params={{ slug: LARGE_ITEM.slug }}
            className="group relative block md:col-span-3 aspect-[4/3] overflow-hidden rounded-lg border border-gold/40 transition-shadow duration-700 hover:shadow-[var(--shadow-soft)]"
          >
            <img
              src={LARGE_ITEM.img}
              alt={LARGE_ITEM.name}
              loading="lazy"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
            />
            {/* Label-zone scrim: holds >=75% argaman through the bottom 45% so the
                cream name / gold price keep AA contrast over white studio shots. */}
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#421720]/90 via-[#421720]/75 via-45% to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6">
              <span className="block font-display text-2xl text-cream">{LARGE_ITEM.name}</span>
              <span className="mt-1 block text-gold-bright text-xl font-bold">{LARGE_ITEM.price}</span>
            </div>
          </Link>

          {/* Two stacked cards — each shows its own product photo from the DB */}
          <div className="md:col-span-2 grid gap-6 md:grid-rows-2">
            {STACKED_ITEMS.map((s) => {
              const thumb = thumbs?.[s.slug] ?? null;
              return (
                <Link
                  key={s.slug}
                  to="/product/$slug"
                  params={{ slug: s.slug }}
                  className="group relative block aspect-[4/3] md:aspect-auto overflow-hidden rounded-lg border border-gold/40 bg-muted transition-shadow duration-700 hover:shadow-[var(--shadow-soft)]"
                >
                  {thumb && (
                    <img
                      src={thumb}
                      alt={s.name}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
                    />
                  )}
                  {/* Label-zone scrim: holds >=75% argaman through the bottom 45% so the
                      cream name / gold price keep AA contrast over white studio shots. */}
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-[#421720]/90 via-[#421720]/75 via-45% to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-5">
                    <span className="block font-display text-lg text-cream leading-snug">{s.name}</span>
                    <span className="mt-1 block text-gold-bright text-lg font-bold">{s.price}</span>
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
            className="text-sm md:text-base text-accent underline-offset-4 hover:underline"
          >
            לכל מארזי החתן והכלה ←
          </Link>
        </div>
      </div>
    </section>
  );
}
