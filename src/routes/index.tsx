import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Pause, Play } from "lucide-react";
import {
  HeroSlides,
  useHeroCycles,
  HERO_SLIDES,
  HERO_SIZES,
  heroSrc,
  heroSrcSet,
} from "@/components/home/HeroSlides";
import { supabase } from "@/integrations/supabase/client";
import { FeaturedProductsCarousel, ProductRail } from "@/components/home/FeaturedProductsCarousel";
import { diversifyRail, fetchHomeFeaturedProducts, rotateDaily } from "@/lib/home-rails";
import { thumbUrl } from "@/lib/img";
import { MobileCarousel } from "@/components/MobileCarousel";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { readRecent } from "@/components/engagement/recently-viewed";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { HomeReviews } from "@/components/content/HomeReviews";
import { fetchHomeReviews } from "@/lib/home-reviews";
import { SectionHeader } from "@/components/home/SectionHeader";
import { CollectionCard, type CatTile } from "@/components/home/CollectionCard";
import { CategoryTile } from "@/components/home/CategoryTile";
import { OccasionTile } from "@/components/home/OccasionTile";
import { Reveal } from "@/components/Reveal";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
import { seasonalOrder, type SeasonalSlot } from "@/lib/holiday-season";
import { GUIDES } from "@/lib/guide-links";
import {
  BUSINESS,
  CONSUMER_POLICY,
  GOOGLE_PLACE_URL,
  OPENING_HOURS,
  openingHoursLabel,
} from "@/lib/business";
import { formatILS, getEffectivePrice, SHIPPING_FLAT, SITE_DISCOUNT } from "@/lib/cart";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import imgSiddur from "@/assets/cat-siddur.webp";
import imgTallit from "@/assets/cat-tallit.webp";
import imgChatan from "@/assets/cat-chatan.webp";
import imgChalaka from "@/assets/cat-chalaka.webp";
import imgGoldJewelry from "@/assets/cat-gold-jewelry.webp";
import imgTallitTefillinCovers from "@/assets/cat-tallit-tefillin-covers.webp";
import imgJudaica from "@/assets/cat-judaica.webp";
import igPost1 from "@/assets/ig/post-1.jpg";
import igReel1 from "@/assets/ig/reel-1.mp4";
import igReel1Poster from "@/assets/ig/reel-1-poster.webp";
import igReel2 from "@/assets/ig/reel-2.mp4";
import igReel2Poster from "@/assets/ig/reel-2-poster.webp";
import igReel3 from "@/assets/ig/reel-3.mp4";
import igReel3Poster from "@/assets/ig/reel-3-poster.webp";
import igReel4 from "@/assets/ig/reel-4.mp4";
import igReel4Poster from "@/assets/ig/reel-4-poster.webp";
import igReel5 from "@/assets/ig/reel-5.mp4";
import igReel5Poster from "@/assets/ig/reel-5-poster.webp";

import oc_aluminum from "@/assets/other-cats/aluminum.webp";
import oc_accessories from "@/assets/other-cats/accessories.webp";
import oc_blessings from "@/assets/other-cats/blessings.webp";
import oc_metalKiddush from "@/assets/other-cats/metal-kiddush.webp";
import oc_crystalKiddush from "@/assets/other-cats/crystal-kiddush.webp";
import oc_havdalah from "@/assets/other-cats/havdalah.webp";
import oc_hanukkah from "@/assets/other-cats/hanukkah.webp";
import oc_wedding from "@/assets/other-cats/wedding.webp";
import oc_tallitTzitzit from "@/assets/other-cats/tallit-tzitzit.webp";
import oc_challahCover from "@/assets/other-cats/challah-cover.webp";
import oc_kippot from "@/assets/other-cats/kippot.webp";
import oc_holidays from "@/assets/other-cats/holidays.webp";
import oc_mezuzot from "@/assets/other-cats/mezuzot.webp";
import oc_wineDividers from "@/assets/other-cats/wine-dividers.webp";
import oc_maimAchronim from "@/assets/other-cats/maim-achronim.webp";
import oc_branding from "@/assets/other-cats/branding.webp";
import oc_bencherStands from "@/assets/other-cats/bencher-stands.webp";
import oc_mirrors from "@/assets/other-cats/mirrors.webp";
import oc_washingCups from "@/assets/other-cats/washing-cups.webp";
import oc_talitTefillinSet from "@/assets/other-cats/talit-tefillin-set.webp";
import oc_talitTefillinSets from "@/assets/other-cats/talit-tefillin-sets.webp";
import oc_liqueurSets from "@/assets/other-cats/liqueur-sets.webp";
import oc_atara from "@/assets/other-cats/atara.webp";
import oc_purim from "@/assets/other-cats/purim.webp";
import oc_plastic from "@/assets/other-cats/plastic.webp";
import oc_candlesticks from "@/assets/other-cats/candlesticks.webp";
// Not other-cats/passover.webp: that "seder plate" is a platter of cheese slabs.
// The table photograph (matza, kiddush cup, candles) is the same crop the
// Pesach occasion tile uses — see src/components/home/occasion-art.ts.
import oc_passover from "@/assets/occasions/passover-table.webp";
import oc_talitClips from "@/assets/other-cats/talit-clips.webp";
import oc_roshHashana from "@/assets/other-cats/rosh-hashana.webp";
import oc_pvcBags from "@/assets/other-cats/pvc-bags.webp";
import oc_tefillinCases from "@/assets/other-cats/tefillin-cases.webp";

const OTHER_CATS_IMAGES: Record<string, string> = {
  aluminum: oc_aluminum,
  "%d7%90%d7%a7%d7%a1%d7%a1%d7%95%d7%a8%d7%99%d7%96": oc_accessories,
  blessings: oc_blessings,
  "metal-kiddush-cups": oc_metalKiddush,
  "crystal-ceramic-kiddush-cups": oc_crystalKiddush,
  havdalah: oc_havdalah,
  hanukkah: oc_hanukkah,
  wedding: oc_wedding,
  talitot: oc_tallitTzitzit,
  "challah-covers": oc_challahCover,
  kipot: oc_kippot,
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%92%d7%99%d7%9d": oc_holidays,

  "wine-dividers": oc_wineDividers,
  "maim-achronim": oc_maimAchronim,
  "%d7%9e%d7%99%d7%aa%d7%95%d7%92": oc_branding,
  "bencher-stands": oc_bencherStands,
  mirrors: oc_mirrors,
  "washing-cups": oc_washingCups,
  "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f": oc_talitTefillinSet,
  "talit-tefillin-covers": oc_talitTefillinSets,
  "liqueur-sets": oc_liqueurSets,
  atara: oc_atara,
  // "polyrasin-stone" is deliberately absent. The artwork that sat here was an
  // AI-generated robed figure with hands clasped in prayer — Marian iconography
  // with pseudo-Hebrew glyphs painted on the robe. A figurative devotional
  // statue is the one image a תשמישי קדושה shop can never show, and this map is
  // what puts a tile on the homepage, so the key is the removal. The category
  // itself is real (12 polymer/stone mezuza cases with genuine supplier photos)
  // and still lives at /category/polyrasin-stone.
  purim: oc_purim,
  plastic: oc_mezuzot,
  candlesticks: oc_candlesticks,
  passover: oc_passover,
  "talit-clips": oc_talitClips,
  "rosh-hashana": oc_roshHashana,
  "pvc-bags": oc_pvcBags,
  "tefillin-cases": oc_tefillinCases,
};

/** The only category slugs this page has artwork for — see the map above. */
const OTHER_CAT_SLUGS = Object.keys(OTHER_CATS_IMAGES);

/** Every src/assets/other-cats/*.webp is authored at this size. */
const OTHER_CAT_IMG_SIZE = 760;

/** Every public/groom-sets/*.jpeg used on this page is 1440×1920. */
const GROOM_IMG_W = 1440;
const GROOM_IMG_H = 1920;

/**
 * "מתנות עד ₪150" — the homepage's low-risk entry point.
 *
 * WHY THIS RAIL EXISTS. Measured on the live anon REST 2026-08-03, all figures
 * as the PAID price getEffectivePrice() returns: of 4,648 active products, 3,233
 * cost ≤ ₪150 AND are presentable (in stock, thumbnail, real description), while
 * exactly 60 cost ≥ ₪756. Yet every ₪ figure the homepage rendered came from the
 * set {756, 1100, 1216, 1400, 1800} — that is, from those 60. The page sold the
 * top 1.3% of the catalogue and nothing else, because the featured pool is
 * ordered price DESC (deliberate — the premium pieces should surface, and that
 * stays) and the luxury showcase is premium by definition. A stranger arriving
 * from a Google result or a WhatsApp share met a ₪1,400 box as their first
 * price. This rail is the other half: something they can afford to risk on a
 * shop they have never bought from.
 *
 * THE ₪150 IS ENFORCED BY getEffectivePrice, NOT BY THE FILTER. The `.lte` below
 * is only a coarse prefilter so PostgREST does not stream the whole catalogue;
 * the ceiling that the heading promises is applied in JS by the one pricing
 * function, so the number on the tile and the number in the heading cannot
 * disagree. (getEffectivePrice is Math.round(price * (1 - SITE_DISCOUNT)), so
 * the raw ceiling is derived from SITE_DISCOUNT rather than typed as 214.)
 *
 * The caps are TIGHTER than the premium rail's (1 per family / 2 per head noun,
 * against 2 / 3). Measured on the live band: with the premium rail's caps the
 * pool spanned ₪137-148 and repeated נטלות and גביעים; tightened it spans
 * ₪135-148 and reaches מזוזות, כיסוי חלה, תיקי טלית, פמוטים, קופות צדקה and a
 * children's puzzle — which is what "gifts" has to look like to work at all.
 * The head cap is what removes the third נטלה: "נטלה אקריליק", "נטלה מהודרת"
 * and "נטלה פולימר" are three families and one washing cup.
 */
const GIFT_CEILING = 150;
const GIFT_RAW_FETCH = 400;
const GIFT_POOL = 36;
const GIFT_SHOW = 10;

async function fetchGiftPicks(): Promise<ProductCardData[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, price, sale_price, thumbnail_url, stock_status")
    .eq("is_active", true)
    .neq("stock_status", "outofstock")
    .not("thumbnail_url", "is", null)
    .not("description", "is", null)
    .neq("description", "")
    .gt("price", 0)
    // Same presentability gate the featured pool uses. Ordered price DESC so the
    // rail leads with the most substantial thing you can get under the cap — a
    // ₪148 gift reads as a gift, a ₪19 one reads as a keyring.
    .lte("price", Math.ceil(GIFT_CEILING / (1 - SITE_DISCOUNT)) + 1)
    .order("price", { ascending: false })
    .order("id", { ascending: true }) // stable tiebreaker so the pool is deterministic
    .limit(GIFT_RAW_FETCH);
  if (error) throw error;
  const withinCeiling = ((data ?? []) as ProductCardData[]).filter(
    (p) => getEffectivePrice(p.price) <= GIFT_CEILING,
  );
  const pool = diversifyRail(withinCeiling, {
    maxPerFamily: 1,
    maxPerHead: 2,
    limit: GIFT_POOL,
  });
  return rotateDaily(pool, GIFT_SHOW);
}

/**
 * Categories that are not in FEATURED but do have a tile image. Runs in the
 * route loader (so the strip is server-rendered) and again as the client query.
 */
async function fetchOtherCategories(): Promise<CatTile[]> {
  const featuredIds = FEATURED.map((f) => f.id);
  const { data: cats, error } = await supabase
    .from("categories")
    .select("id, slug, name")
    // Ask only for the ~32 slugs we can actually render. The previous
    // unbounded select pulled every category row and discarded most of them.
    .in("slug", OTHER_CAT_SLUGS)
    .not("id", "in", `(${featuredIds.join(",")})`);
  if (error) throw error;

  // Verified against production 2026-07-31: these have ZERO active products and no
  // children with products, yet each shipped as a full-size gift photograph with a
  // gold-bordered label, visually indistinguishable from the 24 that work. Five of
  // the 37 homepage category links were dead ends; three more (aluminum /
  // bencher-stands / liqueur-sets) hold a single product that is a duplicate of one
  // already reachable via mezuzot-aluminium / gviei-kidush / birchonim, so the tile
  // buys the shopper nothing.
  //
  // Re-check with:
  //   select c.slug, count(p.id) filter (where p.is_active)
  //     from categories c
  //     left join product_categories pc on pc.category_id = c.id
  //     left join products p on p.id = pc.product_id
  //    group by c.slug having count(p.id) filter (where p.is_active) = 0;
  const blacklist = new Set([
    "sale",
    "uncategorized",
    "wine-dividers", // מחלקי יין — 0
    "birkat-habayit", // תמונות בלייזר — 0
    "study-books", // ספרי לימוד — 0
    "%d7%90%d7%a7%d7%a1%d7%a1%d7%95%d7%a8%d7%99%d7%96", // אקססוריז — 0
    "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%92%d7%99%d7%9d", // מוצרי חגים — 0
    "%d7%9e%d7%99%d7%aa%d7%95%d7%92", // מיתוג — 0
    "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f", // סט טלית תפילין — 0
    "aluminum", // 1 product, duplicate
    "bencher-stands", // 1 product, duplicate
    "liqueur-sets", // 1 product, duplicate
    // מראות — 4 products, all tefillin items (3 pairs of plastic tefillin boxes
    // and a stand of tefillin mirrors), every one also filed under בתי תפילין
    // ומראות and תיקי תפילין. The tile's artwork is an ornate WALL mirror, so it
    // promised something the shelf does not hold. Checked 2026-09-24.
    "mirrors",
  ]);
  const bySlug = new Map((cats ?? []).map((c) => [c.slug, c.name]));
  // Emit in the curated map order rather than PostgREST's (unordered) row
  // order, so the loader result and any later refetch render the same sequence.
  return OTHER_CAT_SLUGS.filter((slug) => bySlug.has(slug) && !blacklist.has(slug)).map((slug) => ({
    slug,
    name: bySlug.get(slug)!,
    img: OTHER_CATS_IMAGES[slug],
    w: OTHER_CAT_IMG_SIZE,
    h: OTHER_CAT_IMG_SIZE,
  }));
}

/**
 * A failed fetch must not blank the homepage: it degrades to `null`, the
 * section falls back to its client query, and the page still renders.
 */
function settle<T>(p: Promise<T>): Promise<T | null> {
  return p.catch((err) => {
    console.error("[home loader]", err);
    return null;
  });
}

// Single source of truth for the homepage FAQ — feeds both the Question nodes
// hung off the WebPage in head() (the SEO carrier; they were a standalone
// FAQPage until that node was merged away — see the note there) and the visible
// accordion. The fuller answers (previously only in the JSON-LD) are canonical.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "האם המוצרים מהודרים ובעלי כשרות?",
    // Truthful scope. The catalog holds נרתיקי מזוזה, תיקי תפילין and כיסויים —
    // NOT written klaf or sofer-made tefillin — so the previous answer ("תפילין
    // ומזוזות מגיעים עם תעודות כשרות") named products the store does not sell.
    // This string is ALSO emitted as JSON-LD (a Question node on the page), so
    // it is read verbatim by machines and is in fact the ONLY copy of this
    // answer a crawler ever sees. Part of the tzitzit/talit range does
    // carry hashgacha, which is why that is stated separately rather than dropped.
    a: 'אנו בוחרים כל פריט בקפידה, בהקפדה על איכות והידור. חשוב לדעת: בחנות נמכרים נרתיקי מזוזה, תיקי תפילין וכיסויים לטלית ולתפילין — ולא קלף כתוב או תפילין מסופר סת"ם. חלק מהטליתות והציציות מגיעות בהשגחה רבנית. לפרטים על ההכשר של פריט מסוים נשמח לענות בטלפון או בוואטסאפ.',
  },
  {
    q: "האם ניתן להוסיף שם אישי או רקמה על המוצרים?",
    a: "בהחלט! אנו מציעים שירות רקמה אישית וחריטת לייזר על מגוון רחב של מוצרים — כולל כיסויים לטלית ותפילין, תיקי תפילין וסידורים. ניתן להזמין בעת הרכישה.",
  },
  {
    q: "כמה זמן לוקח המשלוח?",
    a: `המשלוח מגיע תוך ${CONSUMER_POLICY.deliveryMinDays}-${CONSUMER_POLICY.deliveryMaxDays} ימי עסקים לכל רחבי הארץ. מוצרים עם רקמה אישית עשויים לקחת מעט יותר זמן. אפשר לעקוב אחר מצב ההזמנה בעמוד "מעקב הזמנה" עם מספר ההזמנה וכתובת הדוא"ל, וכאשר מתקבל מספר מעקב מחברת השילוח הוא מופיע שם.`,
  },
  {
    q: "האם ניתן להחזיר מוצרים?",
    a: "כן, אנו מציעים מדיניות החזרה של 14 יום על מוצרים שלא נעשה בהם שימוש ושלא הותאמו אישית. צרו קשר עם שירות הלקוחות שלנו לקבלת סיוע.",
  },
  {
    q: "האם ניתן להזמין מחוץ לישראל?",
    a: 'כרגע אנו משלחים בתוך ישראל בלבד. למשלוחים לחו"ל, אנא צרו קשר ישיר בוואטסאפ ונשמח לסייע.',
  },
  {
    q: 'מה זה "אור זרוע לצדיק" ומי עומד מאחורי החנות?',
    // Product list matches FAQ item 1 and the catalog: כיסויים/נרתיקים, not klaf.
    a: 'אור זרוע לצדיק היא חנות אונליין ישראלית לתשמישי קדושה ויודאיקה מהודרת, בבעלות ליאור בן עמי מקרית ביאליק. השם נלקח מהפסוק בתהילים (צ"ז), "אוֹר זָרֻעַ לַצַּדִּיק". החנות מתמחה בטליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים, עם אפשרות רקמה וחריטה אישית ומשלוח עד הבית בישראל.',
  },
];

// Single source of truth for the page's own name and snippet: the <title>, the
// og/twitter titles and the WebPage node below all read these, so the string a
// human sees in the SERP and the string a machine reads can no longer drift.
//
// Why "חנות" is in the title now. GSC: "אור זרוע לצדיק חנות" is the one brand
// query with volume — 43 impressions / 3 clicks / position 5.5 — and Google
// bolds matched terms in BOTH SERP elements. Until now the title carried the
// brand without "חנות" and the description carried "חנות" without the brand, so
// neither element ever showed both query words, while the store's own Instagram
// and Facebook results directly above literally read "אור זרוע לצדיק". Nothing
// new is claimed: both strings mirror the colophon h2 further down this page
// ("אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה מהודרת") verbatim. The token
// stays OUT of the h1 (measured: the identical h1 ranks #1 on the
// city-qualified brand query and #4 on the "חנות" one, so it is not the
// discriminator) and out of the other 3,895 pages — repeating it sitewide was
// rejected as keyword stuffing. Homepage title + description only.
//
// Measured at Arial against the desktop SERP budget: title 436px of ~600px
// (was 393px); description 151 chars / 861px of ~920px. The previous
// description was 165 chars / 949px — it truncated TODAY, so leading with the
// brand also buys back the tail of the sentence.
const HOME_TITLE = "אור זרוע לצדיק | חנות תשמישי קדושה ויודאיקה מהודרת";
const HOME_DESCRIPTION =
  "אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה: טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים. רקמה אישית ומשלוח עד הבית.";

export const Route = createFileRoute("/")({
  component: HomePage,
  // Everything below the hero used to be fetched only after hydration, which
  // meant three whole sections injected themselves mid-page and shifted the
  // rest down. Resolving them here puts them in the server-rendered HTML.
  // Each fetch is independently fault-tolerant — see settle().
  loader: async () => {
    const [otherCats, featuredProducts, reviews, groomPrices, giftPicks] = await Promise.all([
      settle(fetchOtherCategories()),
      settle(fetchHomeFeaturedProducts()),
      settle(fetchHomeReviews()),
      settle(fetchGroomThumbPrices()),
      settle(fetchGiftPicks()),
    ]);
    // The occasion rail's order for today (the coming holiday first), decided
    // here on the server and carried in loader data so the client renders the
    // exact same order it hydrates. See src/lib/holiday-season.ts.
    const occasionOrder: SeasonalSlot[] = seasonalOrder(
      OCCASION_COLLECTIONS.map((c) => c.slug),
      Date.now(),
    );
    return { otherCats, featuredProducts, reviews, groomPrices, giftPicks, occasionOrder };
  },
  head: () => ({
    meta: [
      { title: HOME_TITLE },
      { name: "description", content: HOME_DESCRIPTION },
      { property: "og:title", content: HOME_TITLE },
      // "נבחרים בהקפדה על כשרות והידור" — a selection claim, matching llms.txt
      // and FAQ item 1. The previous "כשרות מהודרת" asserted certification for
      // every SKU (candlesticks and gold jewelry included). The clause lives on
      // here, on the share cards, which have no 920px budget to respect; the
      // SERP description above gave it up to make room for the brand token.
      // Dropping a claim is always safe — this is the honest version, kept.
      {
        property: "og:description",
        content:
          "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש ומארזים לחתנים — נבחרים בהקפדה על כשרות והידור. רקמה אישית ומשלוח עד הבית.",
      },
      { property: "og:url", content: "https://orzadik.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: HOME_TITLE },
      {
        name: "twitter:description",
        content:
          "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש ומארזים לחתנים — נבחרים בהקפדה על כשרות והידור.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://orzadik.com/" },
      // The hero's first photograph is the homepage LCP paint — preload it,
      // with the same srcset/sizes the <img> uses, so the browser fetches the
      // one file it will paint and not a second size of it.
      {
        rel: "preload",
        as: "image",
        href: heroSrc(HERO_SLIDES[0].file, 1024),
        imageSrcSet: heroSrcSet(HERO_SLIDES[0].file),
        imageSizes: HERO_SIZES,
        fetchPriority: "high",
      },
    ],
    scripts: [
      // The homepage is the page the brand name should resolve to, and it was
      // the only owned page that never said so. Measured live as Googlebot: the
      // four JSON-LD nodes on / were Organization, WebSite, Store and FAQPage —
      // zero WebPage nodes, zero `about`, zero `mainEntityOfPage` anywhere on
      // the page — while /about emits AboutPage.about → #organization and
      // /contact emits ContactPage.about + mainEntity → #organization. So the
      // two pages that DO claim the entity are the two you do not want ranking
      // for "חנות".
      //
      // Why that costs a position: "אור זרוע לצדיק קריית ביאליק" is decided by
      // the Store node's geo + address + the Business Profile (site ranks #1),
      // but "אור זרוע לצדיק חנות" has no local anchor, so it falls to whichever
      // property most explicitly presents itself as the brand's home. An
      // Instagram or Facebook profile IS structurally a brand page; this
      // homepage made no such claim in any machine-readable form (and the brand
      // is deliberately absent from the h1, so JSON-LD is the only place left to
      // assert it). Three properties, no copy change, no visual change.
      //
      // Both @ids referenced here already ship on this page from __root.tsx —
      // verified live. `primaryImageOfPage` is deliberately omitted: the logo
      // ImageObject in __root.tsx carries no @id, so a "#logo" reference would
      // dangle. The reciprocal `mainEntityOfPage: "https://orzadik.com/"` on the
      // Organization node belongs in __root.tsx and is not this route's to add.
      //
      // ——— ONE URL, ONE PAGE NODE ———
      // This shipped as TWO page-level nodes for one URL: a WebPage @id #webpage
      // with url "https://orzadik.com/", and a FAQPage @id #faq with no url at
      // all. FAQPage is a SUBTYPE of WebPage, so a consumer meeting an unnamed,
      // url-less page node binds it to the document it was found in — meaning
      // this page described itself twice, once as the brand's storefront and
      // once as a list of six questions. `isPartOf: #webpage` did not scope it:
      // isPartOf is a CreativeWork part-of edge, it cannot un-type a node, and
      // the FAQPage stayed exactly as eligible to answer "what is this URL
      // primarily about?" as the node above it.
      //
      // The FAQ collision and the `mainEntity` gap below are ONE decision, not
      // two. FAQPage's entire contract is `mainEntity` = the Questions; the
      // brand-entity claim's entire contract is `mainEntity` = the Organization.
      // No single node can hold both, so keeping the FAQPage type costs this
      // page the one property that says "this URL is the Organization's page" —
      // which is the whole reason this node was added. The FAQ gives up nothing
      // it was actually receiving: Google restricted FAQ rich results to
      // government and health sites in August 2023, so this store has been
      // ineligible for the rendering the type buys ever since, and the policy
      // that ships WITH the type (the answers must be present on the page) is
      // one the accordion cannot meet anyway — measured live as Googlebot
      // 2026-08-03, five of the six answers are absent from the served HTML,
      // because Radix unmounts closed panels (see the note at the accordion).
      //
      // NOT a site-wide verdict on FAQPage. category-faq.ts and
      // collection.$slug.tsx still emit it deliberately, and should: the type
      // still feeds passage understanding and answer engines even without the
      // rich result, and those pages have no competing entity claim to trade it
      // against. The trade only exists HERE, on the one URL the Organization's
      // own `url` names. If that ever stops being true, this decision should be
      // revisited rather than copied outward.
      //
      // So the page node keeps its identity properties and takes `mainEntity`,
      // and the six Q&A pairs ride on it as `hasPart`. Question is a subtype of
      // CreativeWork, which is precisely what hasPart ranges over, so this is a
      // legal edge rather than a workaround. Every answer string still ships in
      // the document byte-for-byte — which matters more than usual here, since
      // the JSON-LD is the only place a crawler can read five of them.
      //
      // ——— WHY `about` AND `mainEntity`, AND ONLY HERE ———
      //   about      — "the subject matter of this page is the Organization"
      //   mainEntity — "the Organization is the PRIMARY entity this page
      //                 describes" — the exclusive claim, and the one the brand
      //                 query needs some owned page to make
      // mainEntity is documented as the inverse of Thing.mainEntityOfPage, so
      // every page asserting it adds another candidate for "the page this entity
      // lives on". Measured live 2026-08-03: /about and /contact both asserted
      // it and / did not, which inverts the intended reading exactly — two
      // secondary pages each claimed to be the brand's page while the brand's
      // actual home claimed only to be about it.
      //
      // Which page genuinely IS the entity's page is already settled by this
      // graph and is not a matter of taste: the Organization node in __root.tsx
      // publishes `url: "https://orzadik.com/"`. Had /about kept the exclusive
      // claim, the entity's own `url` would name one canonical page while the
      // inverse of AboutPage.mainEntity named another — the same one-@id,
      // two-answers contradiction /contact was already repaired for. So / takes
      // mainEntity and /about drops it, keeping `about` + the AboutPage type,
      // which together already say "the about-page OF this organization" without
      // claiming to BE its home. /contact needs the identical removal and is
      // outside this change's files — it is the last page still competing.
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebPage",
          "@id": "https://orzadik.com/#webpage",
          url: "https://orzadik.com/",
          name: HOME_TITLE,
          description: HOME_DESCRIPTION,
          inLanguage: "he-IL",
          isPartOf: { "@id": "https://orzadik.com/#website" },
          about: { "@id": "https://orzadik.com/#organization" },
          mainEntity: { "@id": "https://orzadik.com/#organization" },
          hasPart: FAQ_ITEMS.map((item) => ({
            "@type": "Question",
            name: item.q,
            acceptedAnswer: { "@type": "Answer", text: item.a },
          })),
        }),
      },
    ],
  }),
});

// `w`/`h` are the tile image's real intrinsic pixels, so the browser can size
// the box before the file arrives. The tiles themselves are square (the CSS
// aspect + object-cover own the layout); these are not display dimensions.
//
// CatTile lives with <CollectionCard>, and <CategoryTile> takes the same shape —
// both rails on this page feed one of the two, so the shape is their contract,
// not this route's. Re-exported below because the loader's return type is public.
export type { CatTile };

// Curated featured categories. `slug` is hardcoded (verified against the DB) so
// the section renders at SSR — no client round-trip, no post-hydration CLS.
const FEATURED: { id: string; slug: string; name: string; img: string; w: number; h: number }[] = [
  {
    id: "ac72c907-8981-404d-b776-642467e43110",
    slug: "talitot",
    name: "טליתות",
    img: imgTallit,
    w: 800,
    h: 1000,
  },
  // Was marazim-chatanim. 7 of that category's 11 active products carry a null
  // thumbnail (measured 2026-08-09), so a homepage tile opened a grid that is
  // majority placeholder — a blocking owner input (photographs), not something
  // markup fixes. The groom sets keep their flagship band above, which uses the
  // real local photographs in public/groom-sets/, and the three product links
  // in that band still land on the photographed SKUs. This tile now opens the
  // wider חתן וכלה shelf: 45 active products, floor ₪28 effective, and its own
  // 7 image-less rows sink to the back under the shared shelf ordering.
  {
    id: "d2954417-843b-48fa-bf00-92a6dcf87d03",
    slug: "chatan-kala",
    name: "חתן וכלה",
    img: imgChatan,
    w: 800,
    h: 1067,
  },
  {
    id: "f48e44e3-eab6-4281-a09d-cac9a96a8e96",
    slug: "talit-tefillin-covers",
    name: "כיסויים לטלית ותפילין",
    img: imgTallitTefillinCovers,
    w: 800,
    h: 1067,
  },
  {
    id: "3109eed6-32e3-40eb-9fe4-874029b8ab4d",
    slug: "chalaka-set",
    name: "סט חלאקה",
    img: imgChalaka,
    w: 800,
    h: 1067,
  },
  {
    id: "c78aea58-8a38-43ee-a236-3aa2f1942225",
    slug: "yehudaika",
    name: "מוצרי יודאיקה",
    img: imgJudaica,
    w: 800,
    h: 800,
  },
  {
    id: "b6854069-9746-4490-b6ea-ef7debe4d795",
    slug: "sidurim",
    name: "סידורים ותהילים",
    img: imgSiddur,
    w: 800,
    h: 800,
  },
  {
    id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    slug: "esh-sheli-gold",
    name: "אש שלי - תכשיטי זהב",
    img: imgGoldJewelry,
    w: 800,
    h: 1144,
  },
];

// Light-ground button variants. Every band on this page is now white/glass, so
// the old dark-ground pair is gone: `bg-gold-bright` is 1.84:1 on white and
// `text-cream` ~1.1:1 — both were only ever legal over the deleted argaman.
//   solid   — #8A5A2B fill with white text = 5.87:1 (hover #6E4620 = 8.20:1)
//   outline — #8A5A2B text on white/glass = 5.87:1, boundary 5.87:1 (>3:1)
// Hover is media-gated; press feedback is not (it must work on touch).
// No `transition-colors` here on purpose: `.press` already owns
// transition-property (transform, 160ms) and, per the override contract in
// styles.css, beats a Tailwind transition-* utility at equal specificity. The
// hover tint therefore lands instantly — correct anyway for a control in the
// "done constantly" frequency band.
// Hero CTAs. Measured on a real phone (390x844) before this was rewritten: the
// row rendered as two near-identical 290px pills stacked 12px apart, carrying
// 14px labels — and "לחנות" is a FIVE-character word, so most of a 290px pill
// was empty. That emptiness is what read as unfinished, more than any colour
// choice. Three things were wrong and all three are fixed here:
//   • 14px type on a 43px target is under-set. Both are now 16px.
//   • The outline button was weight 400 against the solid's 600, so the
//     flagship groom-set link read as the disabled one. Both are 600 now.
//   • bg-white/60 over moving video let the secondary wash out to nothing on
//     the brighter frames. 85% holds it against every frame in the reel.
// A chevron gives each one a direction to go in — the single cheapest signal
// that a control is navigation rather than decoration.
//
// Deliberately NOT done: no gold gradient behind the primary. --gradient-gold
// is marked DECORATIVE ONLY / "never behind white text" at its token, and the
// white label needs the flat --accent fill to hold 5.87:1.
// No colour transition either: .press owns transition-property (transform), so
// pairing one with it would be a lie about what actually animates.
//
// min-h in rem, not px, so the control still grows with the accessibility
// widget's font-size zoom — 3.25rem is 52px at the default root, comfortably
// past the 44px floor.
const BTN_BASE =
  "press inline-flex items-center justify-center gap-2 rounded-full min-h-[3.25rem] px-8 text-base font-semibold";
const BTN_SOLID = `${BTN_BASE} bg-accent text-white shadow-[var(--glass-shadow)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong`;
const BTN_OUTLINE = `${BTN_BASE} border border-accent bg-white/85 text-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary`;
// Hero-only. The two doors sit directly on the photography with no card behind
// them, so the 0.50 tint is not decoration — it is half of the contrast budget
// (the bottom scrim is the other half; see the note on it). backdrop-blur only
// softens what shows through; it guarantees nothing on its own and must never
// be treated as the reason this is legible.
const BTN_GLASS = `${BTN_BASE} border border-white/70 bg-black/50 text-white backdrop-blur-md [@media(hover:hover)_and_(pointer:fine)]:hover:bg-black/65`;

// Curated groom-set thumbs under the flagship banner image.
// להחלפת פריטים: החליפו את `img` לכל קובץ תחת public/groom-sets/ (groom-01..17.jpeg)
// ואת `slug` ל-slug אמיתי של מוצר קיים. **אין לכתוב כאן מחיר** — הוא נמשך
// מהמאגר לפי ה-slug ומחושב חי, כמו בעמוד המוצר.
//
// All three carried a hardcoded "‏2,000 ₪" until 2026-07-28 — the catalogue list
// price, never run through getEffectivePrice(), so the badge overstated every
// one of them by 1/0.7 (₪2,000 shown vs ₪1,400 charged). Three different SKUs
// sharing one round number was the tell. Read the row instead.
//
// The three slugs below were personal names until 2026-07-31 (…/groom-set-yaron-biton
// — the customer whose bespoke box was photographed). They now describe the
// product; src/server.ts 301s the old URLs.
//
// THESE PAIRINGS WERE AUDITED 2026-08-03 (see src/lib/product-photos.ts) AND
// TWO OF THE THREE WERE WRONG — a photograph under the wrong slug is not a
// cosmetic slip, it tells someone spending ₪1,400-2,000 that a different box
// arrives. One is fixed here; one still is not:
//
//   groom-03 -> grey-melange     CORRECT (grey melange fabric, audited).
//   groom-05 -> brown-leather-look  FIXED 2026-08-19, by doing exactly what the
//     note here asked for: the override is dropped and the DB image comes
//     through. groom-05 is cream/beige quilted suede with a silver crown while
//     that product's own catalogue photograph is unambiguously BROWN suede, so
//     the local file was overriding a correct photo with an incorrect one.
//     Dropping the override changes only WHICH PHOTOGRAPH this slot shows, not
//     which product it promotes — the owner's call, the one this note was
//     waiting on, is untouched. `img` is optional below; a thumb without one
//     renders the product's own thumbnail_url.
//   groom-07 -> white-crown      FIXED 2026-08-09, was black-leather-look.
//     groom-07 is a WHITE set whose silver crown repeats on the atara, the
//     tallit corner and the kippah, while groom-set-black-leather-look is
//     charcoal. It now points at the product it actually photographs, which is
//     also the pairing the owner confirmed in product-photos.ts — so the
//     homepage thumb and the product page finally show the same box.
const GROOM_THUMBS: { img?: string; slug: string }[] = [
  { img: "/groom-sets/groom-03.jpeg", slug: "groom-set-grey-melange" },
  { slug: "groom-set-brown-leather-look" },
  { img: "/groom-sets/groom-07.jpeg", slug: "groom-set-white-crown" },
];

/**
 * Live price AND catalogue photograph for the three groom thumbs above. Same
 * price contract as the luxury showcase: fetch the RAW row price and apply
 * getEffectivePrice() at the render site, so the badge, the PDP and the cart all
 * run the one function.
 *
 * thumbnail_url rides along for thumbs that declare no local `img`. One query
 * either way — the row is already being read for its price.
 */
type GroomThumbRow = { price: number | null; thumb: string | null };

async function fetchGroomThumbPrices(): Promise<Record<string, GroomThumbRow>> {
  const { data, error } = await supabase
    .from("products")
    .select("slug, price, thumbnail_url")
    .in(
      "slug",
      GROOM_THUMBS.map((t) => t.slug),
    );
  if (error) throw error;
  const out: Record<string, GroomThumbRow> = {};
  for (const row of data ?? []) {
    const n = Number(row.price);
    out[row.slug] = {
      price: Number.isFinite(n) && n > 0 ? n : null,
      thumb: row.thumbnail_url || null,
    };
  }
  return out;
}

// Line-icons shared by the differentiators strip and the trust band. Kept
// size-agnostic (each caller passes its own `className` scale) so the same glyph
// reads at two tiers without duplicating the path data. Decorative — every use
// sits beside its own text label, so the SVGs stay unlabelled by design.
function IconTruck({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 7h11v10H3z" />
      <path d="M14 10h4l3 3v4h-7z" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </svg>
  );
}
function IconGem({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 2l2.39 4.84L20 7.74l-4 3.9.94 5.5L12 14.77l-4.94 2.37L8 11.64 4 7.74l5.61-.9z" />
    </svg>
  );
}
function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 22s-8-4.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-8 11-8 11z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

/**
 * RTL "forward" arrow — points to the reading start (right→left), and slides
 * further on hover where the caller wraps it in a `group`. Decorative: every
 * use sits inside a link whose own text says where it goes. Used by the guides
 * rail (the occasion rail shared it until it became photo tiles).
 */
function IconArrowStart({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

/**
 * The five published guides, as homepage links.
 *
 * Measured with a Googlebot UA: the homepage emitted 29 /category links, 8
 * /collection links and 16 product links — and ZERO /articles/<slug> links.
 * Meanwhile Search Console says the guides are the site's best-ranking surface
 * by a wide margin (positions 12.0 / 17.0 / 22.0 / 23.0, against page 3-9 for
 * every commercial head term), and each guide holds only 9-29 inbound internal
 * links, all from nav and footer boilerplate. With zero external links to the
 * domain, internal linking is the only PageRank distribution mechanism that
 * exists, and this is the most-linked page on the site: it was giving its own
 * best content nothing.
 *
 * Ordered by measured performance rather than by the GUIDES insertion order:
 * the kiddush-cup guide owns the two best positions on the site (12.0 and
 * 17.0), the tallit guide the next (22.0), and the חנוכיה guide goes last
 * because it is the one seasonal subject in the set. Pure config + a static
 * grid, so the anchors are in the server HTML — a link a crawler never sees
 * passes no authority.
 */
const HOME_GUIDES = [
  "kiddush-cup-guide",
  "bechira-talit",
  "mezuza-guide",
  "tefillin-guide",
  "hanukkia-guide",
]
  .map((slug) => GUIDES[slug])
  .filter(Boolean);

// SSR-safe prefers-reduced-motion check — only ever called from effects/handlers.
function prefersReducedMotion() {
  return (
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function HomePage() {
  const { otherCats, featuredProducts, reviews, groomPrices, giftPicks, occasionOrder } =
    Route.useLoaderData();
  const occasions = (occasionOrder ?? OCCASION_COLLECTIONS.map((c) => ({ slug: c.slug })))
    .map((slot: SeasonalSlot) => {
      const c = OCCASION_COLLECTIONS.find((x) => x.slug === slot.slug);
      return c ? { c, label: slot.label } : null;
    })
    .filter(
      (x): x is { c: (typeof OCCASION_COLLECTIONS)[number]; label: string | undefined } => !!x,
    );

  // The hero's photographs cycle only on the client and never for a
  // reduced-motion visitor; the pause is the WCAG 2.2.2 stop for everyone
  // else. Deliberately not persisted — a reading aid for this visit.
  const heroCycles = useHeroCycles();
  const [heroPaused, setHeroPaused] = useState(false);

  // Static — rendered at SSR from the curated FEATURED list (slugs hardcoded), so
  // the tiles are in the initial HTML and the section never shifts after hydration.
  const cats: CatTile[] = FEATURED.map((f) => ({
    slug: f.slug,
    name: f.name,
    img: f.img,
    w: f.w,
    h: f.h,
  }));

  return (
    <>
      {/* 1. Hero — the owner's own golden-hour shoot.
          Phone: the photographs fill the frame and the type sits ON them, as
          before — the owner's standing note against a boxed, cropped hero
          ("תמחק את הקוביה הלבנה") still holds there. Desktop: an editorial
          split — the selling block on the linen ground, the photographs in an
          arched gold frame beside it. Portrait photographs stretched across a
          1440px-wide frame would crop every head off; an arch keeps them whole.

          It replaced a product-mosaic video (2026-10, "הסרטון לא יפה"): white
          catalogue shots flicking past, some still stamped "for demonstration
          purposes", read as a dropshipper — the opposite of what a shop with
          a counter in קרית ביאליק should say first. */}
      {/* HEIGHT: viewport MINUS the header MINUS a deliberate peek — measured
          header heights per breakpoint (125px under 2xl, 93px from 2xl), and a
          strip of the next section left showing as the scroll cue. CSS-only
          on purpose: reading the real height would jump the LCP element after
          first paint. Re-measure whenever SiteHeader's rows change. */}
      <section className="relative flex h-[calc(100svh-125px-4.5rem)] min-h-[560px] flex-col justify-end overflow-hidden bg-[#3b2a17] lg:grid lg:h-[calc(100svh-125px-5rem)] lg:min-h-[620px] lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:bg-cream 2xl:h-[calc(100svh-93px-5rem)]">
        {/* The photographs. Absolute behind the type on a phone; their own
            column, inside the arch, from lg. One instance either way, so the
            browser fetches one set of files. */}
        <div className="absolute inset-0 lg:relative lg:inset-auto lg:order-2 lg:flex lg:h-full lg:min-h-0 lg:items-center lg:justify-center lg:py-12 lg:pe-10 xl:pe-20">
          <div className="relative h-full w-full lg:aspect-[3/4] lg:w-auto lg:max-w-full">
            {/* The offset gold line — a second arch drawn 14px outside the
                photograph, the frame-within-a-frame of a museum mount. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-3.5 hidden rounded-t-[999px] rounded-b-[1.75rem] border border-gold/70 lg:block"
            />
            <div className="absolute inset-0 overflow-hidden lg:rounded-t-[999px] lg:rounded-b-[1.25rem] lg:shadow-[0_30px_60px_-30px_rgba(59,42,23,0.55)]">
              <HeroSlides paused={heroPaused} cycles={heroCycles} />
            </div>
            {/* A detail, overlapping the frame's lower corner: the craft up
                close, where the large frame shows it worn. Desktop only — a
                phone has no room beside the copy for a second picture. */}
            <div
              aria-hidden="true"
              className="absolute -bottom-6 -start-16 hidden w-36 rotate-[-4deg] rounded-xl border border-gold/60 bg-card p-1.5 shadow-[0_18px_40px_-18px_rgba(59,42,23,0.6)] xl:block"
            >
              <img
                src="/product-photos/drive-2026-08/img_0107-400w.webp"
                alt=""
                width={400}
                height={533}
                loading="lazy"
                decoding="async"
                className="aspect-[3/4] w-full rounded-lg object-cover"
              />
              <div className="px-1 pb-0.5 pt-1.5 text-center font-display text-xs text-accent">
                בעיצוב אישי
              </div>
            </div>
          </div>
        </div>

        {/* Scrim — phone only, where the type sits on the photograph. The
            stops are in pixels and sized to the ~380px text block against the
            worst case of a bright frame: 0.84 over white leaves white text at
            4.88:1 (L_bg ≤ 0.183 needs α ≥ 0.82). The ramp above it dissolves
            into the untouched picture. From lg the type is on linen and this
            is not needed at all. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(22,15,4,0.90)_0px,rgba(22,15,4,0.84)_380px,rgba(22,15,4,0.30)_470px,transparent_560px)] lg:hidden"
        />

        {/* The selling block. Every claim is sourced, none invented: no free
            shipping (there is none), no star rating (Google reviews may not be
            marked up — see GOOGLE_PLACE_URL); the address and the cancellation
            window come from BUSINESS and CONSUMER_POLICY, the same constants
            the footer and /returns render. */}
        <div className="relative z-10 flex flex-col items-center px-5 pb-8 text-center sm:px-6 md:pb-12 lg:order-1 lg:items-start lg:justify-center lg:pb-0 lg:pe-8 lg:ps-12 lg:text-start xl:ps-20 2xl:ps-[max(5rem,calc((100vw-84rem)/2))]">
          <div className="stagger flex w-full max-w-2xl flex-col items-center lg:max-w-xl lg:items-start">
            {/* Eyebrow: where the shop is, between two hairlines — the one
                fact a dropshipper cannot claim. Gold is decorative-only on
                white, so on linen the eyebrow takes the bronze --accent; on
                the dark scrim the pale gold reads at well over 4.5:1. */}
            <p className="flex items-center gap-3 text-[0.75rem] font-semibold text-gold-bright lg:text-accent">
              <span aria-hidden="true" className="h-px w-8 bg-current opacity-70" />
              חנות יודאיקה ב{BUSINESS.address.split(",").pop()?.trim()}
              <span aria-hidden="true" className="h-px w-8 bg-current opacity-70 lg:hidden" />
            </p>
            {/* The brand name leads the H1 — an SEO decision: the Hebrew name is
                a verse from תהילים צ״ז and that query is contested by scripture
                sites, so the strongest heading on the page carries it. */}
            <h1 className="mt-3 font-display text-[1.6rem] font-semibold leading-[1.15] text-white sm:text-[2.1rem] lg:mt-5 lg:text-[3.1rem] lg:leading-[1.08] lg:text-foreground xl:text-[3.5rem]">
              אור זרוע לצדיק
              <span className="mt-1 block text-[0.62em] font-medium text-white/90 lg:mt-3 lg:text-accent">
                תשמישי קדושה ויודאיקה מהודרת
              </span>
            </h1>
            <span aria-hidden="true" className="gold-rule mt-5 hidden w-24 lg:block" />
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/95 sm:text-base lg:mt-5 lg:text-lg lg:text-muted-foreground">
              טליתות, מארזים לחתנים, כיסויי תפילין ונרתיקי מזוזה — נבחרים בהקפדה על כשרות והידור
            </p>

            {/* ONE primary, one secondary, side by side even on a phone
                (stacking cost 64px of photograph; both labels are short).
                ChevronLeft because the document is RTL: forward points left. */}
            <div className="mt-7 flex w-full flex-row justify-center gap-3 text-[0.9375rem] sm:w-auto sm:text-base lg:mt-9 lg:justify-start">
              <Link
                to="/shop"
                className={`${BTN_SOLID} flex-1 whitespace-nowrap px-5 text-inherit sm:flex-none sm:px-8`}
              >
                לחנות
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
              {/* /collection/chatan-kala, not the groom-box category: 7 of that
                  category's 11 products have no photograph yet. On a phone it is
                  the glass button over the photograph; on linen, the outline. */}
              <Link
                to="/collection/$slug"
                params={{ slug: "chatan-kala" }}
                className={`${BTN_GLASS} flex-1 whitespace-nowrap px-5 text-inherit sm:flex-none sm:px-8 lg:border-accent lg:bg-white/85 lg:text-accent lg:backdrop-blur-none lg:[@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary`}
              >
                לחתן ולכלה
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </div>

            {/* Three parallel facts, as a real list. Hairline dots between
                them are aria-hidden so the list is not read as bullets. */}
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-[0.8125rem] text-white/90 sm:gap-x-4 sm:text-sm lg:mt-8 lg:justify-start lg:text-muted-foreground">
              <li>משלוח או איסוף</li>
              <li aria-hidden="true" className="opacity-40">
                ·
              </li>
              <li>ביטול תוך {CONSUMER_POLICY.cancellationDays} יום</li>
              <li aria-hidden="true" className="opacity-40">
                ·
              </li>
              <li>תשלום מאובטח</li>
            </ul>
          </div>

          {/* The stop for the cycling photographs (WCAG 2.2.2). Rendered only
              when they actually cycle — never on the server, never for a
              reduced-motion visitor, who sees one still frame. */}
          {heroCycles ? (
            <button
              type="button"
              onClick={() => setHeroPaused((p) => !p)}
              aria-pressed={heroPaused}
              aria-label={heroPaused ? "הפעלת החלפת התמונות" : "עצירת החלפת התמונות"}
              className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-full text-white/85 transition-colors lg:absolute lg:bottom-6 lg:start-6 lg:mt-0 lg:text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-white lg:[@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
            >
              {heroPaused ? (
                <Play className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Pause className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          ) : null}
        </div>
      </section>

      {/* 2. הקולקציות שלנו — the curated collections as the reference's large
          framed cards (owner's screenshots, 2026-09-24).
          MOVED UP from ninth place to directly under the hero. A stranger who
          lands here came to see what the shop sells; the seven doors that
          answer that sat below the groom flagship, the trust band, the store
          card, the gift rail and the occasion rail — roughly 5,000px down a
          phone. The reference leads with them, and so does this.
          Two compact cards per row on a phone (one per row cost ~2,900px of
          scrolling before anything else), two from 640px, three from 1024px. flex-wrap + justify-center rather than a
          grid so the seventh card sits centred under the others instead of
          stranded in the first column. The phone cap (28rem) stops a large
          phone in landscape from rendering a 600px square. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader eyebrow="הקולקציות שלנו" title="מה תרצו לגלות?" />
          <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-3 sm:gap-6">
            {cats.map((c) => (
              <div
                key={c.slug}
                className="w-[calc(50%-0.375rem)] sm:w-[calc(50%-0.75rem)] lg:w-[calc(33.333%-1rem)]"
              >
                <CollectionCard cat={c} />
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 3. שאר הקטגוריות — every other category that has artwork, as a swipe
          rail of photo tiles. Moved up together with the collections above: the
          reference shows the two browse blocks back to back. A crawlable strip
          of internal /category/$slug links plus a browse-everything path to
          /categories. Server-rendered from the loader (otherCats resolved at
          SSR); on the rare loader failure it renders nothing rather than an
          empty box. */}
      <OtherCategoriesSection cats={otherCats ?? []} reserveSpace={false} />

      {/* 4. מארזי חתן — flagship band: the ivory ground carrying a single glass
          panel. Every descendant that once relied on a dark backing moved with
          it: cream → foreground/muted, gold-bright → --accent, gold-bright
          frames → .hairline-gold. */}
      <section className="min-h-[480px] flex items-center">
        {/* <Reveal>, not the load-time `.reveal` keyframe it used to carry. That
            keyframe was only honest while this band could be on screen at first
            paint; with the collections now above it, it would finish long before
            the shopper scrolled here. <Reveal> arms on scroll instead. */}
        <Reveal className="container mx-auto px-4 max-w-6xl py-14 md:py-20 w-full">
          <div className="glass glass-gold grid md:grid-cols-2 gap-10 items-center p-8 md:p-12 [--glass-radius:1.5rem]">
            {/* Text column (RTL start) */}
            <div>
              <p className="text-meta md:text-body tracking-[0.3em] text-accent mb-4">
                קולקציית החתנים
              </p>
              <h2 className="font-display text-3xl md:text-5xl text-foreground leading-tight mb-5">
                מארז חתן שמלווה אותו לכל החיים
              </h2>
              <div className="flex items-center gap-3 mb-5" aria-hidden="true">
                <span className="gold-rule w-10 shrink-0" />
                <span className="text-accent text-xs">✦</span>
                <span className="gold-rule w-10 shrink-0" />
              </div>
              {/* No "from ₪X" line here. The old one read "החל מ־2,000 ₪" — a bare
                  literal nothing computed, and 43% above what the cheapest set
                  actually costs. The CTA below lands on live prices; if a floor
                  is ever wanted, compute min(getEffectivePrice(price)) over the
                  wedding category in the loader rather than typing a number. */}
              <p className="text-muted-foreground text-[15px] leading-7 max-w-md mb-6">
                טלית מהודרת, עטרה וכלי קודש נבחרים — מוגשים במארז מעוצב. אפשר להוסיף רקמה או חריטה
                אישית בשם החתן.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                {/* The band's own CTA also leaves /category/marazim-chatanim —
                    see the hero note above for the measurement. The three thumb
                    links below still go straight to the photographed groom sets,
                    so a shopper who wants a groom box is one tap away; what is
                    gone is the door that opened on 7 placeholders. */}
                <Link to="/collection/$slug" params={{ slug: "chatan-kala" }} className={BTN_SOLID}>
                  לכל מתנות החתן והכלה
                </Link>
                {/* `inline-block py-1.5 -my-1.5`, here and on the two other
                  text links on this page (the shop phone number, the Instagram
                  handle): the padding grows the touch target from 16-20px tall
                  to ~32px, and the matching negative margin gives the same
                  6px back to the layout box, so nothing on the page moves.
                  Vertical padding on a bare inline element paints without
                  enlarging the hit box at all, which is why `inline-block`
                  is doing the work rather than the padding alone. */}
                <Link
                  to="/category/$slug"
                  params={{ slug: "chatan-kala" }}
                  className="inline-block py-1.5 -my-1.5 text-sm md:text-base text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                >
                  לכל מוצרי חתן וכלה
                </Link>
              </div>
            </div>

            {/* Image column */}
            <div>
              <div className="relative overflow-hidden rounded-lg">
                <img
                  src="/groom-sets/groom-01.jpeg"
                  alt="מארז חתן — טלית ועטרה"
                  loading="lazy"
                  decoding="async"
                  width={GROOM_IMG_W}
                  height={GROOM_IMG_H}
                  className="w-full aspect-[3/4] object-cover rounded-lg"
                />
                <span
                  aria-hidden="true"
                  className="hairline-gold absolute inset-3 rounded-lg pointer-events-none"
                />
              </div>
              {/* 3-up linked thumb strip — shown on mobile too so the flagship
                  reads as a set on a phone, not just one hero image. */}
              <div className="grid grid-cols-3 gap-2 mt-2">
                {GROOM_THUMBS.map((t) => {
                  const row = groomPrices?.[t.slug];
                  const price = row?.price != null ? formatILS(getEffectivePrice(row.price)) : null;
                  // A thumb with no local `img` shows the product's own
                  // catalogue photograph, width-transformed like every other
                  // tile on the site. Rendered at ~200 CSS px in a 3-up strip.
                  const src = t.img ?? thumbUrl(row?.thumb, 400);
                  // No photograph from either source: skip the tile rather than
                  // emit a broken <img>. Same instinct as the price badge above
                  // — nothing beats something wrong.
                  if (!src) return null;
                  return (
                    <Link
                      key={t.slug}
                      to="/product/$slug"
                      params={{ slug: t.slug }}
                      className="group relative block aspect-square overflow-hidden rounded-lg"
                    >
                      <img
                        src={src}
                        alt="מארז חתן — טלית ועטרה"
                        loading="lazy"
                        decoding="async"
                        width={GROOM_IMG_W}
                        height={GROOM_IMG_H}
                        className="h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
                      />
                      {/* The frame rides above the photo, so it is an overlay rather
                        than an inset ring on the tile itself. */}
                      <span
                        aria-hidden="true"
                        className="hairline-gold absolute inset-0 rounded-lg pointer-events-none"
                      />
                      {/* Live price — glass-strong because it sits on the photo
                        (--accent over it is 5.10:1 worst case). Visible by
                        DEFAULT so touch devices (no hover) always see the price;
                        only hover-capable pointers hide it and reveal it on
                        group-hover. Omitted entirely when the row is missing —
                        no badge beats a wrong badge. */}
                      {price && (
                        <span className="glass-strong absolute inset-x-2 bottom-2 py-1.5 text-sm font-semibold text-accent text-center opacity-100 transition-opacity duration-200 ease-out [--glass-radius:0.75rem] [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100">
                          {price}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 4.2. Personalization teaser — the store's moat (רקמה/חריטה) as a compact
          band, placed right after the flagship. (The three-card differentiators strip that
          used to sit here repeated the trust band below it almost word for word,
          and was removed.) Honest:
          it only restates what the PDP and /collection/personalized already
          promise — the personalization is coordinated with the customer AFTER the
          order. --accent is the only gold; the ✦ gold-rule bracket is the reused
          house motif; the CTA rides BTN_SOLID. SSR-safe: static markup, no
          browser globals. */}
      <section>
        <Reveal className="container mx-auto px-4 pb-14 md:pb-20 max-w-6xl">
          <div className="glass glass-gold [--glass-radius:1.5rem] px-6 py-7 md:px-10 md:py-8 flex flex-col items-center gap-6 text-center md:flex-row md:items-center md:justify-between md:gap-8 md:text-right">
            <div>
              <div
                className="flex items-center justify-center gap-3 mb-3 md:justify-start"
                aria-hidden="true"
              >
                <span className="gold-rule w-8 shrink-0" />
                <span className="text-accent text-sm">✦</span>
                <span className="gold-rule w-8 shrink-0" />
              </div>
              <h2 className="font-display text-2xl md:text-3xl text-foreground leading-tight">
                רקמה וחריטה אישית — הוסיפו שם על המתנה
              </h2>
              <p className="mt-2 text-sm md:text-base text-muted-foreground max-w-xl mx-auto md:mx-0 leading-7">
                על כיסויים לטלית ותפילין, תיקים וסידורים — את הגופן, הצבע והמיקום נתאם איתכם לאחר
                ההזמנה.
              </p>
            </div>
            <Link to="/collection/personalized" className={`${BTN_SOLID} shrink-0`}>
              לפריטים להתאמה אישית
            </Link>
          </div>
        </Reveal>
      </section>

      {/* 5. Trust badges — moved up out of the proof footer to break the run of
          browse-grids right after the flagship. No gold-rule bracket here: this
          is not an act boundary, so the ground stays continuous white. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          {/* Heading was "למה לקוחות בוחרים בנו". The three cards under it are
              each defensible (see the block comment below), but the heading
              itself asserted an existing body of customers who choose this shop
              — and the store has taken zero orders. It was the only unbacked
              claim left in this band. "מה מובטח לכם כאן" says the same thing as
              a promise the store makes rather than a fact about people who do
              not yet exist, and it matches the "ההבטחה שלנו" eyebrow that was
              already above it. Change it back only when there is something real
              to count. */}
          <SectionHeader eyebrow="ההבטחה שלנו" title="מה מובטח לכם כאן" />

          <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-border">
            {/* Every claim here has to be one the store can actually stand
                behind — this strip is the homepage's trust promise, and an
                unbacked line here is worse than no line at all.
                  · The delivery window is read from CONSUMER_POLICY, the same
                    constant /shipping, the terms and the checkout badges use.
                  · The middle card no longer claims hand-inspection or artisan
                    manufacture: this is a curated catalogue of 4,600+ supplier
                    items, not a workshop.
                  · The third card no longer promises "full warranty" — there is
                    no warranty page to back it. It now names what the store
                    genuinely offers: personal help, and the statutory right of
                    cancellation, which /returns documents in full. */}
            {[
              {
                title: "משלוח עד הבית",
                desc: `אספקה משוערת ${CONSUMER_POLICY.deliveryMinDays}-${CONSUMER_POLICY.deliveryMaxDays} ימי עסקים לכל הארץ, ארוז בקפידה — עם מעקב אחר ההזמנה בכל שלב.`,
                icon: <IconTruck className="w-10 h-10 md:w-12 md:h-12" />,
              },
              {
                title: "נבחר בקפידה",
                desc: "מבחר תשמישי קדושה ויודאיקה הנבחרים בהקפדה על כשרות והידור, עם תיאור ומפרט ברורים בעמוד המוצר.",
                icon: <IconGem className="w-10 h-10 md:w-12 md:h-12" />,
              },
              {
                title: "ליווי אישי וזכות ביטול",
                desc: `ליווי אישי לפני ואחרי הרכישה, וזכות ביטול תוך ${CONSUMER_POLICY.cancellationDays} יום מקבלת המוצר לפי חוק הגנת הצרכן.`,
                icon: <IconShieldCheck className="w-10 h-10 md:w-12 md:h-12" />,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group flex flex-col items-center text-center gap-5 px-6 py-10 md:py-6"
              >
                <div className="text-accent transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-1">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-display text-2xl md:text-[1.75rem] leading-tight mb-3">
                    {item.title}
                  </h3>
                  <p className="text-base text-muted-foreground leading-relaxed max-w-xs mx-auto">
                    {item.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 5.5. חנות אמיתית — the one piece of third-party proof this business
          has, finally rendered for humans.
          GOOGLE_PLACE_URL has existed in src/lib/business.ts since the entity
          work and was referenced in exactly ONE place in the codebase:
          __root.tsx's JSON-LD `hasMap`. So a crawler could see that this brand
          is a real place on Google's map and a shopper could not — and the
          opening hours were in the same position, present only in structured
          data. For a store with zero orders, whose whole problem is whether a
          stranger believes it is a real shop, that is the wrong way round.
          The address, the hours and the profile link are all verifiable facts;
          nothing here is a claim. Deliberately NOT here: any rating or review
          count. The 6 Google reviews are real but they are Google's, and review
          markup is only permitted for reviews a site collects itself — see the
          note on GOOGLE_PLACE_URL. The link lets a shopper go read them at the
          source, which is the honest version of the same reassurance.
          Hours come from OPENING_HOURS, the same constant the Store node reads,
          so the visible table and the structured data cannot drift. */}
      <section>
        <Reveal className="container mx-auto px-4 pb-14 md:pb-20 max-w-6xl">
          <div className="glass glass-gold [--glass-radius:1.5rem] px-6 py-7 md:px-10 md:py-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <div className="flex items-center gap-3 mb-3" aria-hidden="true">
                <span className="gold-rule w-8 shrink-0" />
                <span className="text-accent text-sm">✦</span>
              </div>
              <h2 className="font-display text-2xl md:text-3xl text-foreground leading-tight">
                יש לנו גם חנות פיזית — אפשר לבוא לראות
              </h2>
              <p className="mt-2 text-sm md:text-base text-muted-foreground leading-7">
                {BUSINESS.address} · {BUSINESS.legalId}
              </p>
              {/* A real <dl> rather than a table: two-column rows of day → hours,
                  with the numeric range written with an ASCII hyphen (see
                  openingHoursLabel — U+2013 has bidi class ON and reverses a
                  range in RTL). */}
              <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm text-muted-foreground max-w-sm">
                {OPENING_HOURS.map((h) => (
                  <div key={h.he} className="contents">
                    <dt className="text-foreground">{h.he}</dt>
                    <dd>{openingHoursLabel(h)}</dd>
                  </div>
                ))}
                <dt className="text-foreground">שבת</dt>
                <dd>סגור</dd>
              </dl>
            </div>
            <div className="flex flex-col items-start gap-3 md:items-end">
              {/* rel="noopener": external target. No `nofollow` — this is our own
                  Business Profile and the outbound link corroborates the sameAs
                  claim rather than passing equity to a third party. */}
              <a href={GOOGLE_PLACE_URL} target="_blank" rel="noopener" className={BTN_SOLID}>
                הפרופיל שלנו בגוגל מפות
              </a>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="inline-block py-1.5 -my-1.5 text-sm text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                {BUSINESS.phoneDisplay}
              </a>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 5.6. מתנות עד ₪150 — the low-risk entry point. See fetchGiftPicks for
          the measurement that motivates it. Rendered from loader data so the
          tiles are in the server HTML like every other rail on this page; on the
          rare loader failure the rail simply does not exist rather than
          injecting itself mid-page after hydration.
          The shipping line is on the RAIL, not the cart: a shopper who commits
          to a ₪106 item and first meets ₪37 of shipping at checkout has been
          surprised, and this is the one rail whose whole promise is "no
          surprise". SHIPPING_FLAT is read from the pricing module, so it cannot
          drift from what checkout charges. */}
      {giftPicks && giftPicks.length >= 4 && (
        <ProductRail
          eyebrow="בלי להתחייב בגדול"
          title={`מתנות עד ${formatILS(GIFT_CEILING)}`}
          sub={`כל המחירים כאן הם המחיר הסופי לפריט. משלוח עד הבית ${formatILS(SHIPPING_FLAT)} לכל הארץ, לכל הזמנה.`}
          products={giftPicks}
          moreLabel="לכל המוצרים, מהזול ליקר ←"
          moreSearch={{ sort: "price-asc" }}
        />
      )}

      {/* 5.7. קונים לפי אירוע — the occasion/holiday hubs (/collection/<slug>).
          Judaica is calendar- and lifecycle-driven, so shopping by occasion
          (בר מצווה, חתונה, בית חדש) and by holiday (ראש השנה, חנוכה, פסח) is a
          primary path. Text-only glass cards — no imagery to fetch — with the
          eyebrow in --accent (the only gold) and the shared .glass-lift hover
          motion. Swipeable on a phone via MobileCarousel, a grid from md up.
          SSR-safe: OCCASION_COLLECTIONS is pure data imported at module scope,
          so the rail is in the server HTML.

          It sat above both category rails until 2026-09-24, on the argument
          that a stranger wants a present for a simcha more than "a category".
          The owner's reference leads with the photographic collection doors
          instead, and they now open the page; this rail follows the proof
          blocks, still ahead of the product rails. Text-only cards cannot
          compete with photographs for the first screen. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader eyebrow="מתנה לכל שמחה" title="קונים לפי אירוע" />
          {/* Photographic portrait tiles (see <OccasionTile>). basis-[62%] on a
              phone: ~230px, one tile whole and the next peeking so the rail
              reads as swipeable.
              From md the rail is a grid, and seven tiles do not divide evenly
              into rows — a plain 3- or 4-column grid strands the last row at
              the start edge. So every tile spans TWO tracks of a doubled grid
              (6 tracks at md = 3 across, 8 at lg = 4 across) and one tile is
              nudged a track inward to centre the short last row: the 7th at md
              (3+3+1), the 5th at lg (4+3). This is tied to the seven entries in
              OCCASION_COLLECTIONS; if that count changes, re-derive the nudge. */}
          <MobileCarousel
            basis="basis-[62%]"
            mdGrid="md:grid-cols-6 md:*:col-span-2 md:[&>*:nth-child(7)]:col-start-3 lg:grid-cols-8 lg:[&>*:nth-child(7)]:col-start-auto lg:[&>*:nth-child(5)]:col-start-2"
            mdGap="md:gap-5"
            className="max-w-6xl mx-auto"
          >
            {/* Ordered for the season: the coming holiday's hub leads, with
                "לקראת חנוכה" as its eyebrow (holiday-season.ts). Same seven
                tiles, so the grid nudges above still hold. */}
            {occasions.map(({ c, label }) => (
              <OccasionTile key={c.slug} c={c} eyebrow={label} />
            ))}
          </MobileCarousel>
        </Reveal>
      </section>

      {/* 8. מומלצים באתר — pool איכות מסובב יומית */}
      <FeaturedProductsCarousel
        initialProducts={featuredProducts ?? undefined}
        reserveSpace={featuredProducts === null}
      />

      {/* 9. THE SLOT IS DELIBERATELY EMPTY.
          It held "פריטי יוקרה נבחרים" (three products from the top 0.6% of the
          catalogue), then ShelfDirectory (six text doors with live depth). Both
          are gone. The doors were removed on the owner's call: on a page where
          every other block carries a photograph, a text-only panel reads as
          unfinished rather than as restraint.
          Nothing replaces them, because nothing needs to. After PR #70 the
          header already carries those same six shelves with the same counts, so
          the doors were a second copy of the primary navigation two thirds of
          the way down the page. The shelves are still reachable from the header
          on every route, from "שאר הקטגוריות" above, and from /categories.
          If you put something back here, it needs artwork. */}

      {/* 10. חלאקה — promo band. The argaman half is now a glass panel beside the
          photo rather than a wine fill behind cream text. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-6 md:gap-8 items-stretch">
            <img
              src={imgChalaka}
              alt="סט חלאקה מהודר"
              loading="lazy"
              decoding="async"
              width={800}
              height={1067}
              className="w-full h-full aspect-[4/3] object-cover rounded-[1.5rem] border border-gold/40"
            />
            <div className="glass glass-gold p-10 md:p-14 flex flex-col justify-center [--glass-radius:1.5rem]">
              <p className="text-meta md:text-body tracking-[0.3em] text-accent mb-4">
                מסורת של שמחה
              </p>
              <h3 className="font-display text-3xl md:text-5xl text-foreground mb-4">
                חוגגים חלאקה?
              </h3>
              <div className="flex items-center gap-3 mb-4" aria-hidden="true">
                <span className="gold-rule w-10 shrink-0" />
                <span className="text-accent text-xs">✦</span>
                <span className="gold-rule w-10 shrink-0" />
              </div>
              <p className="text-muted-foreground leading-7 mb-7">
                סטים מהודרים לגיל שלוש — מבחר עיצובים וסגנונות לבחירה, ארוזים ומוכנים לחגיגה.
              </p>
              <div>
                <Link to="/category/$slug" params={{ slug: "chalaka-set" }} className={BTN_SOLID}>
                  לכל סטי החלאקה
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* 11. לקוחות ממליצים — real approved reviews */}
      <HomeReviews initialReviews={reviews ?? undefined} reserveSpace={reviews === null} />

      {/* 11.5. נצפו לאחרונה — client-only, personalized. Renders nothing on the
          server and for first-time visitors, so there is no reserved box and no
          layout shift; it mounts in low on the page only for returning shoppers
          whose recently-viewed store has items. */}
      <RecentlyViewedRail />

      {/* 12. Gallery — visual closer.
          Framed as OUR gallery, not as an Instagram feed: the tiles are a fixed
          set of stills and clips bundled with the site (see GALLERY_MEDIA), not
          posts pulled live from the account. Calling it a feed implied fresh
          posts and per-post links that do not exist; the Instagram handle is
          still here as what it actually is — a link to the profile. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader
            eyebrow="גלריה"
            title="מהפריטים שלנו"
            sub={
              <>
                מבחר צילומים וסרטונים של פריטים מהחנות. לעדכונים שוטפים ולתכנים נוספים — עקבו אחרינו
                באינסטגרם:{" "}
                <a
                  href={INSTAGRAM_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block py-1.5 -my-1.5 text-accent underline underline-offset-4 transition-[color] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
                >
                  @or_zarua_latzadik
                </a>
              </>
            }
          />

          <StoreGallery />
        </Reveal>
      </section>

      {/* 12.5. מדריכי קנייה — the homepage's first links into /articles. See
          HOME_GUIDES above for the measurement that motivates it (0 guide links
          from the site's most-linked page, while the guides hold its four best
          Search Console positions). Placed here, directly above the newsletter
          block that already promises "מדריכים ותוכן", so the reading order goes
          content → sign-up rather than interrupting the shopping rails. Same
          card as the occasion rail (glass-soft + glass-lift + one arrow glyph)
          so the page keeps a single card language; the GuideLinks component is
          the category/PDP density and would not carry blurbs at this width. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader
            eyebrow="לפני שקונים"
            title="מדריכי הקנייה שלנו"
            sub="חומרים, מידות ומנהגים — מה שכדאי לדעת לפני שבוחרים."
          />
          {/* basis-[68%] on mobile: one card fills the rail and the next peeks
              past the edge, exactly as the occasion rail above. */}
          <MobileCarousel
            basis="basis-[68%]"
            mdGrid="md:grid-cols-3"
            mdGap="md:gap-5"
            className="max-w-6xl mx-auto"
          >
            {HOME_GUIDES.map((g) => (
              <Link
                key={g.slug}
                to="/articles/$slug"
                params={{ slug: g.slug }}
                className="group block h-full"
              >
                <div className="glass-soft glass-lift flex h-full flex-col justify-between gap-6 p-6 md:p-7 [--glass-radius:1rem]">
                  <div>
                    <h3 className="font-display text-lg md:text-xl text-foreground leading-tight">
                      {g.title}
                    </h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{g.blurb}</p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm text-accent">
                    לקריאה
                    <IconArrowStart className="w-4 h-4 transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </MobileCarousel>
          <div className="mt-10 text-center">
            <Link to="/articles" className={BTN_OUTLINE}>
              לכל המדריכים
            </Link>
          </div>
        </Reveal>
      </section>

      {/* 13. Newsletter capture — moved down to the last quiet ask before the
          footer, once the visitor has seen the full catalog and the proof.
          Content/holiday value proposition, not deals. */}
      <section className="py-14 md:py-20">
        <Reveal className="container mx-auto px-4">
          <div className="glass glass-gold [--glass-radius:1.5rem] max-w-2xl mx-auto px-6 md:px-10 py-10 text-center">
            <div className="text-xs tracking-[0.35em] text-accent mb-3">הישארו מעודכנים</div>
            <h2 className="font-display text-2xl md:text-3xl text-foreground mb-2">
              מדריכים ותוכן לקראת החגים
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              ופריטים חדשים לפני כולם — בלי ספאם, אפשר להסיר בכל רגע.
            </p>
            <div className="mx-auto max-w-md">
              <NewsletterSignup source="home" />
            </div>
          </div>
        </Reveal>
      </section>

      {/* 14. SEO colophon + FAQ — demoted to the last content slot before the footer.
          The H1 and both paragraphs stay in the DOM for SEO; canonical address/phone
          live in the footer. */}
      <section>
        <span aria-hidden="true" className="gold-rule block w-full" />
        <div className="container mx-auto px-4 py-14 md:py-20 max-w-4xl">
          {/* Colophon heading — demoted to h2; the hero value-prop line owns the page's only h1. */}
          <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground text-center mb-4 tracking-wide">
            אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה מהודרת
          </h2>
          <p className="text-center text-sm text-muted-foreground leading-relaxed mb-4 max-w-3xl mx-auto">
            <strong>אור זרוע לצדיק</strong> היא חנות אונליין ישראלית לתשמישי קדושה ויודאיקה מהודרת —
            טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים. השם נלקח
            מהפסוק בתהילים (צ״ז), "אוֹר זָרֻעַ לַצַּדִּיק", ומבטא את רוח החנות: אור, הידור ואיכות.
            הפריטים נבחרים בהקפדה על כשרות והידור, ואנו מציעים רקמה וחריטה אישית ומשלוח עד הבית בכל
            הארץ.
          </p>
          <p className="text-center text-xs text-muted-foreground leading-relaxed mb-12 max-w-3xl mx-auto">
            הבעלים: ליאור בן עמי · דרך עכו 190, קרית ביאליק · טל׳ 054-581-8486.
          </p>

          {/* FAQ */}
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8 tracking-wide">
            שאלות נפוצות
          </h2>
          {/* The Question nodes in head() are the SEO carrier, because Radix
              unmounts closed panels rather than hiding them — measured live as
              Googlebot 2026-08-03, only the defaultValue answer (faq-0) is in
              the served HTML and the other five exist nowhere but the JSON-LD.
              That measurement is also why those Q&A are no longer marked up as
              a FAQPage: the type carries a "must be present on the page" policy
              this accordion cannot satisfy. Never delete an answer from
              FAQ_ITEMS assuming the DOM still carries it. */}
          <div className="glass p-4 md:p-8 [--glass-radius:1.5rem]">
            <Accordion type="single" collapsible defaultValue="faq-0" className="w-full">
              {FAQ_ITEMS.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border-gold/30 last:border-b-0"
                >
                  <AccordionTrigger className="text-right font-display text-base">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * "נצפו לאחרונה" — a client-only rail of the shopper's recently-viewed products,
 * read from the localStorage-backed store (readRecent). SSR-safe: the store is
 * touched only inside an effect, so the server and the first client render emit
 * nothing — no reserved box, no layout shift. It mounts in only for returning
 * shoppers who have items, placed low on the page so the post-hydration insert
 * stays below the fold. Reuses ProductCard + the shared Carousel exactly like
 * FeaturedProductsCarousel, so cards and arrows match the other product rails.
 */
function RecentlyViewedRail() {
  const [recent, setRecent] = useState<ProductCardData[]>([]);
  // localStorage is read only here, after mount — never during render or at
  // module scope — so this stays SSR-safe.
  useEffect(() => {
    setRecent(readRecent());
  }, []);

  // Nothing for the server or first-time visitors. A lone card reads as broken,
  // so this mirrors the product page's >=2 recently-viewed threshold.
  if (recent.length < 2) return null;

  return (
    <section className="py-14 md:py-20">
      <div className="container mx-auto px-4">
        <SectionHeader eyebrow="במיוחד בשבילכם" title="נצפו לאחרונה" />
        <Carousel
          dir="rtl"
          opts={{ direction: "rtl", align: "start", dragFree: true }}
          className="px-2"
          aria-label="נצפו לאחרונה"
        >
          <CarouselContent>
            {recent.map((p) => (
              <CarouselItem key={p.id} className="basis-[44%] md:basis-1/3 lg:basis-1/4">
                <ProductCard p={p} />
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious className="right-2 -translate-y-1/2 hidden md:inline-flex" />
          <CarouselNext className="left-2 -translate-y-1/2 hidden md:inline-flex" />
        </Carousel>
      </div>
    </section>
  );
}

/**
 * Height of the populated "שאר הקטגוריות" section, measured in-browser at the
 * widths where the fluid container changes size (max per range, so it can only
 * ever over-reserve). Re-measured 2026-08-09 after the tiles became
 * <CollectionCard>, which changed the basis chain and therefore the tile square:
 *
 *   <768px      390 -> 494 · 767 -> 500      max 500
 *   768-1279px  768 -> 577 · 1279 -> 583     max 583
 *   >=1280px    1280 -> 581 · 1536 -> 632    max 632
 *
 * The plate itself adds nothing: it is absolutely positioned inside the square,
 * so a two-line category name grows it upward and the section height is a pure
 * function of the tile width.
 *
 * NOTE THIS CONSTANT IS CURRENTLY UNREACHABLE. `reserveSpace` has one call site
 * and it passes `false` unconditionally, so both branches that read this are
 * dead. It is kept correct rather than deleted because it is the right guard if
 * the loader ever stops resolving the strip at SSR — but if you are here because
 * it went stale again, deleting it and the prop is a behaviour-preserving change.
 */
const OTHER_CATS_RESERVED_HEIGHT = " min-h-[500px] md:min-h-[590px] xl:min-h-[640px]";

/**
 * "שאר הקטגוריות" — the tile carousel for every category with artwork that is
 * not already in FEATURED.
 *
 * `reserveSpace` is set when the route loader could not resolve the strip, so
 * the ">0 categories" decision happens after hydration. In that case the
 * section keeps its height while the client query is in flight, instead of
 * appearing mid-page and pushing the rest down.
 */
function OtherCategoriesSection({
  cats,
  reserveSpace,
}: {
  cats: CatTile[];
  reserveSpace: boolean;
}) {
  if (cats.length === 0) {
    return reserveSpace ? (
      <section aria-hidden="true" className={OTHER_CATS_RESERVED_HEIGHT.trim()} />
    ) : null;
  }

  return (
    <section className={reserveSpace ? OTHER_CATS_RESERVED_HEIGHT.trim() : undefined}>
      <div className="container mx-auto px-4 py-14 md:py-20">
        <SectionHeader eyebrow="גלו עוד" title="שאר הקטגוריות" />

        <Carousel
          dir="rtl"
          opts={{ direction: "rtl", loop: true, dragFree: true, align: "center" }}
          aria-label="שאר הקטגוריות"
        >
          {/* The reference's rail: one tile centred and whole, its neighbours
              dissolving into the ground at both edges. align "center" puts a
              tile in the middle; the mask on the VIEWPORT (not the Carousel
              root, which also holds the arrows) does the dissolve. 44% on a
              phone is ~160px, the reference's tile, with ~a third of each
              neighbour showing. The chain stays monotonic upward, so no
              breakpoint hands a narrower tile than the one below it. */}
          <CarouselContent viewportClassName="[mask-image:linear-gradient(to_right,transparent,#000_3rem,#000_calc(100%-3rem),transparent)] md:[mask-image:linear-gradient(to_right,transparent,#000_5rem,#000_calc(100%-5rem),transparent)]">
            {cats.map((c) => (
              <CarouselItem
                key={c.slug}
                className="basis-[44%] sm:basis-[30%] md:basis-1/4 lg:basis-1/5 xl:basis-1/6"
              >
                <CategoryTile cat={c} />
              </CarouselItem>
            ))}
          </CarouselContent>
          {/* RTL side + arrow icon come from the carousel component; only the edge offset is tuned here */}
          <CarouselPrevious className="right-0 -translate-y-1/2 hidden md:inline-flex" />
          <CarouselNext className="left-0 -translate-y-1/2 hidden md:inline-flex" />
        </Carousel>

        {/* Browse-everything path — the crawlable link out to the full category
            hub (/categories lists all 105 categories). */}
        <div className="text-center">
          <Link
            to="/categories"
            className="mt-6 inline-block text-sm text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
          >
            לכל הקטגוריות ←
          </Link>
        </div>
      </div>
    </section>
  );
}

// A FIXED set of stills and clips bundled with the site — not a live feed, and
// deliberately not presented as one (see the gallery section above).
// `w`/`h` are the still's intrinsic pixels (src/assets/ig/post-1.jpg is
// 1080×1350); the tile's aspect-[4/5] box + object-cover own the layout.
// Each reel's `poster` is a real frame extracted from that exact clip, not a
// generic placeholder, so there is no blank tile while a slow connection
// buffers the video after it scrolls into view.
const GALLERY_MEDIA: {
  type: "video" | "image";
  src: string;
  poster?: string;
  w?: number;
  h?: number;
}[] = [
  { type: "video", src: igReel1, poster: igReel1Poster },
  { type: "video", src: igReel2, poster: igReel2Poster },
  { type: "image", src: igPost1, w: 1080, h: 1350 },
  { type: "video", src: igReel3, poster: igReel3Poster },
  { type: "video", src: igReel4, poster: igReel4Poster },
  { type: "video", src: igReel5, poster: igReel5Poster },
];

const INSTAGRAM_URL = "https://www.instagram.com/or_zarua_latzadik/";

/**
 * Reel that only downloads and plays once it scrolls near the viewport.
 * Avoids fetching ~23MB of below-the-fold video on initial page load. The
 * poster (a real frame from the same clip, ~30-130KB) is shown immediately
 * so the tile is never a blank/bg-muted square while the clip buffers.
 */
function LazyReel({ src, poster }: { src: string; poster?: string }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  // Respect "reduce motion": keep the first frame as a still instead of playing.
  useEffect(() => {
    if (visible && !prefersReducedMotion()) ref.current?.play().catch(() => {});
  }, [visible]);

  return (
    <video
      ref={ref}
      src={visible ? src : undefined}
      poster={poster}
      muted
      loop
      playsInline
      // "metadata" once visible so the first frame paints even when reduced
      // motion skips play(); "none" keeps the initial page load light. The
      // poster covers both cases visually either way.
      preload={visible ? "metadata" : "none"}
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
    />
  );
}

function StoreGallery() {
  return (
    <Carousel
      dir="rtl"
      opts={{ direction: "rtl", align: "start" }}
      className="max-w-6xl mx-auto"
      aria-label="גלריית פריטים של אור זרוע לצדיק"
    >
      <CarouselContent>
        {GALLERY_MEDIA.map((m, i) => (
          <CarouselItem key={i} className="basis-2/3 sm:basis-1/3">
            {/* Every tile links to the PROFILE, because that is the only real
                destination we have — there are no per-post URLs for these
                assets. The label says exactly that, so nobody taps expecting
                the individual post. */}
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="לפרופיל האינסטגרם של אור זרוע לצדיק"
              className="group relative block aspect-[4/5] overflow-hidden rounded-lg bg-muted shadow-[var(--shadow-card)]"
            >
              {m.type === "video" ? (
                <LazyReel src={m.src} poster={m.poster} />
              ) : (
                <img
                  src={m.src}
                  alt="אור זרוע לצדיק"
                  loading="lazy"
                  decoding="async"
                  width={m.w}
                  height={m.h}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
                />
              )}
              <div
                aria-hidden="true"
                className="absolute inset-0 bg-foreground/0 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-foreground/20"
              />
              <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-5 h-5 text-background drop-shadow"
                >
                  <rect x="3" y="3" width="18" height="18" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </div>
            </a>
          </CarouselItem>
        ))}
      </CarouselContent>
      <CarouselPrevious className="right-2 -translate-y-1/2 hidden md:inline-flex" />
      <CarouselNext className="left-2 -translate-y-1/2 hidden md:inline-flex" />
    </Carousel>
  );
}
