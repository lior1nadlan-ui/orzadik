import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatILS, getEffectivePrice } from "@/lib/cart";
import { SectionHeader } from "@/components/home/SectionHeader";
import { CATEGORY_COUNT_EMBED } from "@/routes/categories";

// FILE NAME IS STALE, ON PURPOSE. This module used to render "פריטי יוקרה
// נבחרים" — one flagship card and two stacked premium cards. It now renders the
// shelf directory that replaced that slot. The path is unchanged because moving
// it is a rename in a tree several agents are editing at once; the exports are
// renamed instead, which is what any caller actually reads.
//
// ---------------------------------------------------------------------------
// WHY THE LUXURY SHOWCASE WENT
//
// It was three products from the top 0.6% of the catalogue — a ₪1,216 acrylic
// blessing, a ₪1,100 tallit and a ₪1,800 groom box — on the page whose recorded
// failure is that "every ₪ figure the homepage rendered came from the set
// {756, 1100, 1216, 1400, 1800}", i.e. from the 60 products of 4,648 that cost
// ₪756 or more (see fetchGiftPicks in src/routes/index.tsx for that
// measurement). The ₪150 gift rail was added as the other half of the fix; this
// section was the half still pulling the other way, and it was curation — three
// hand-picked slugs — where the page needed navigation.
//
// Two concrete defects died with it:
//   • FLAGSHIP_ITEM.name carried "90×59" with U+00D7 MULTIPLICATION SIGN. That
//     is bidi class ON, UAX#9 rule N1 resolves it to R between two European
//     numbers, and the live homepage therefore painted the dimensions REVERSED,
//     as "59x90". Nothing in the replacement uses anything but ASCII "x" and
//     ASCII "-".
//   • one of the three cards routed to a groom set, and 7 of the 11 products in
//     marazim-chatanim have a null thumbnail (measured 2026-08-09). Groom sets
//     keep their flagship band further up the page, which uses real local
//     photographs; they are no longer a door from here.
//
// WHAT REPLACES IT
//
// The same six shelves the header now carries, as six text doors: name, depth,
// and the shelf's own honest floor. No photography — 66-72% of masters are
// 500x500 and this section does not need to be a gallery to be a door.
//
// EVERY NUMBER IS READ FROM THE DATABASE AT SSR, NEVER TYPED. That rule is
// inherited verbatim from the section this replaces, whose own header comment
// recorded why: prices were hardcoded here until 2026-07-28 and every one was
// the CATALOGUE list price, i.e. 1/0.7 of what the store charges, because a
// literal cannot pass through getEffectivePrice(). The floor below is a real
// row's price run through that same function, so the number here, the number on
// the tile and the number in the cart are one function apart. Do not
// reintroduce a price string. The counts are read live for the same reason.
// (The HEADER hardcodes its six counts — see the note in SiteHeader.tsx — but
// the header has no route loader to read them in; this page does.)
// ---------------------------------------------------------------------------

/**
 * The six deepest shelves in the catalogue. Slugs and labels are kept in step
 * with CURATED_CATEGORIES in src/components/SiteHeader.tsx by hand, and
 * deliberately so: the header needs static labels (no loader) while this
 * section needs live numbers, and one shared constant would have forced one of
 * the two to be wrong. The SLUGS are the contract; if you retarget a door,
 * retarget it in both places.
 *
 * The label for brachot-chamsot-segulot is shortened from the DB name
 * "ברכות חמסות וסגולות" to fit a two-up card on a 390px phone.
 */
const SHELVES: { slug: string; label: string }[] = [
  { slug: "kipot", label: "כיפות" },
  { slug: "chagim", label: "חגים" },
  { slug: "talit-tefilin", label: "טלית ותפילין" },
  { slug: "plastic", label: "נרתיקי מזוזה" },
  { slug: "shabbat", label: "שבת" },
  { slug: "brachot-chamsot-segulot", label: "ברכות וחמסות" },
];

const SHELF_SLUGS = SHELVES.map((s) => s.slug);

/** Per-shelf depth and raw floor price, keyed by category slug. */
export type ShelfStats = Record<string, { count: number; floorRaw: number | null }>;

/**
 * Depth + floor for the six shelves, in two round-trips.
 *
 * TWO and not one, because the two figures need DIFFERENT embedded filters and
 * PostgREST applies an embedded filter to the aggregate itself: the count must
 * include every active product, while the floor must exclude the price<=0
 * "call for price" rows — a ₪0 floor would be a lie, since those items have no
 * price at all until the gold rate is quoted. (A single `products(price.min())`
 * would collapse it to one request, but aggregate functions are disabled on
 * this project's PostgREST — verified 2026-08-09, PGRST123.)
 *
 * The floor query is an ORDERED, LIMIT-1 embed rather than a full column pull:
 * these six shelves hold 2,772 products between them and PostgREST caps an
 * unbounded select at 1,000 rows, so reading them all would silently return a
 * WRONG floor for whichever shelf fell past the cap.
 *
 * Exported so the route loader can run it on the server and hand the result
 * back as `initialStats` — same function, same shape, so the SSR HTML and any
 * client refetch cannot disagree.
 */
export async function fetchShelfStats(): Promise<ShelfStats> {
  const [counts, floors] = await Promise.all([
    supabase
      .from("categories")
      .select(`slug, ${CATEGORY_COUNT_EMBED}`)
      .in("slug", SHELF_SLUGS)
      .eq("products.is_active", true),
    supabase
      .from("categories")
      .select("slug, products(price)")
      .in("slug", SHELF_SLUGS)
      .eq("products.is_active", true)
      .gt("products.price", 0)
      .order("price", { referencedTable: "products", ascending: true })
      .limit(1, { referencedTable: "products" }),
  ]);
  if (counts.error) throw counts.error;
  if (floors.error) throw floors.error;

  const floorBySlug = new Map(
    (floors.data ?? []).map((row: any) => {
      const raw = Number(row.products?.[0]?.price);
      return [row.slug as string, Number.isFinite(raw) && raw > 0 ? raw : null];
    }),
  );

  const out: ShelfStats = {};
  for (const row of (counts.data ?? []) as any[]) {
    out[row.slug] = {
      count: Number(row.products?.[0]?.count ?? 0),
      floorRaw: floorBySlug.get(row.slug) ?? null,
    };
  }
  return out;
}

export function ShelfDirectory({ initialStats }: { initialStats?: ShelfStats }) {
  const { data: stats } = useQuery({
    queryKey: ["home-shelf-stats", SHELF_SLUGS],
    staleTime: 5 * 60_000,
    // Seeded from the SSR loader when the caller has it, so the counts and
    // floors are in the initial HTML rather than appearing after hydration.
    initialData: initialStats,
    queryFn: fetchShelfStats,
  });

  return (
    // Same two gold rules the luxury band used, so the section's chrome — and
    // therefore the page's rhythm at this point — is unchanged.
    <section>
      <span aria-hidden="true" className="gold-rule block w-full" />
      <div className="container mx-auto px-4 py-14 md:py-20">
        <SectionHeader
          eyebrow="לפי עומק"
          title="המדפים הגדולים בחנות"
          sub="שש הקטגוריות שיש בהן הכי הרבה לבחור מתוכו. המספר הוא מספר הפריטים במדף, והמחיר הוא הפריט הזול שיש בו."
        />

        {/* Two-up on a phone, three-up from md. Text doors, not tiles: nothing
            here loads an image, so the section costs no bytes and cannot show a
            centre-cropped 500x500 master as if it were photography. */}
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
          {SHELVES.map((s) => {
            const stat = stats?.[s.slug];
            const count = stat?.count ?? 0;
            // A missing row renders NO number rather than a placeholder — the
            // same rule the luxury cards' cardPrice() enforced for prices.
            const floor =
              stat?.floorRaw != null ? formatILS(getEffectivePrice(stat.floorRaw)) : null;
            return (
              <Link
                key={s.slug}
                to="/category/$slug"
                params={{ slug: s.slug }}
                className="group block h-full"
              >
                <div className="glass-soft glass-lift flex h-full flex-col justify-between gap-4 p-4 md:p-6 [--glass-radius:1rem]">
                  <h3 className="font-display text-lg leading-tight text-foreground md:text-xl">
                    {s.label}
                  </h3>
                  <div className="text-sm text-muted-foreground">
                    {count > 0 && (
                      <span className="block tabular-nums">{`${count} פריטים`}</span>
                    )}
                    {/* ASCII hyphen U+002D, never U+2013. The hyphen sits
                        between the Hebrew "מ" and the RLM that formatILS's
                        Intl output opens with, so it is a neutral between two
                        strong-R runs: U+002D is class ES, W6 hands it to ON and
                        N1 then resolves it to R, which is why "החל מ-4 ₪" paints
                        in reading order. U+2013 is class ON from the start and
                        offers N1 nothing to absorb it — the bug this site has
                        shipped three times.
                        Built as ONE template string rather than two JSX
                        children for the reason recorded at DELIVERY_WINDOW in
                        product.$slug.tsx: one text node leaves no question about
                        what React's SSR separators do to a bidi run. */}
                    {floor && (
                      <span className="mt-0.5 block font-semibold text-accent">
                        {`החל מ-${floor}`}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        <div className="mt-8 text-center md:mt-10">
          <Link
            to="/categories"
            className="text-sm text-accent underline-offset-4 transition-colors duration-200 ease-out md:text-base [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
          >
            לכל הקטגוריות ←
          </Link>
        </div>
      </div>
      <span aria-hidden="true" className="gold-rule block w-full" />
    </section>
  );
}
