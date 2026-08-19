import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  FeaturedProductsCarousel,
  ProductRail,
  diversifyRail,
  fetchHomeFeaturedProducts,
  rotateDaily,
} from "@/components/home/FeaturedProductsCarousel";
import { thumbUrl } from "@/lib/img";
import { MobileCarousel } from "@/components/MobileCarousel";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { readRecent } from "@/components/engagement/recently-viewed";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { HomeReviews, fetchHomeReviews } from "@/components/content/HomeReviews";
import { SectionHeader } from "@/components/home/SectionHeader";
import { CollectionCard, type CatTile } from "@/components/home/CollectionCard";
import { Reveal } from "@/components/Reveal";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
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
import igReel2 from "@/assets/ig/reel-2.mp4";
import igReel3 from "@/assets/ig/reel-3.mp4";
import igReel4 from "@/assets/ig/reel-4.mp4";
import igReel5 from "@/assets/ig/reel-5.mp4";

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
import oc_passover from "@/assets/other-cats/passover.webp";
import oc_talitClips from "@/assets/other-cats/talit-clips.webp";
import oc_roshHashana from "@/assets/other-cats/rosh-hashana.webp";
import oc_pvcBags from "@/assets/other-cats/pvc-bags.webp";
import oc_tefillinCases from "@/assets/other-cats/tefillin-cases.webp";

const OTHER_CATS_IMAGES: Record<string, string> = {
  "aluminum": oc_aluminum,
  "%d7%90%d7%a7%d7%a1%d7%a1%d7%95%d7%a8%d7%99%d7%96": oc_accessories,
  "blessings": oc_blessings,
  "metal-kiddush-cups": oc_metalKiddush,
  "crystal-ceramic-kiddush-cups": oc_crystalKiddush,
  "havdalah": oc_havdalah,
  "hanukkah": oc_hanukkah,
  "wedding": oc_wedding,
  "talitot": oc_tallitTzitzit,
  "challah-covers": oc_challahCover,
  "kipot": oc_kippot,
  "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%92%d7%99%d7%9d": oc_holidays,

  "wine-dividers": oc_wineDividers,
  "maim-achronim": oc_maimAchronim,
  "%d7%9e%d7%99%d7%aa%d7%95%d7%92": oc_branding,
  "bencher-stands": oc_bencherStands,
  "mirrors": oc_mirrors,
  "washing-cups": oc_washingCups,
  "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f": oc_talitTefillinSet,
  "talit-tefillin-sets": oc_talitTefillinSets,
  "liqueur-sets": oc_liqueurSets,
  "atara": oc_atara,
  // "polyrasin-stone" is deliberately absent. The artwork that sat here was an
  // AI-generated robed figure with hands clasped in prayer — Marian iconography
  // with pseudo-Hebrew glyphs painted on the robe. A figurative devotional
  // statue is the one image a תשמישי קדושה shop can never show, and this map is
  // what puts a tile on the homepage, so the key is the removal. The category
  // itself is real (12 polymer/stone mezuza cases with genuine supplier photos)
  // and still lives at /category/polyrasin-stone.
  "purim": oc_purim,
  "plastic": oc_mezuzot,
  "candlesticks": oc_candlesticks,
  "passover": oc_passover,
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
    "wine-dividers",                                                        // מחלקי יין — 0
    "birkat-habayit",                                                       // תמונות בלייזר — 0
    "study-books",                                                          // ספרי לימוד — 0
    "%d7%90%d7%a7%d7%a1%d7%a1%d7%95%d7%a8%d7%99%d7%96",                     // אקססוריז — 0
    "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%92%d7%99%d7%9d",              // מוצרי חגים — 0
    "%d7%9e%d7%99%d7%aa%d7%95%d7%92",                                       // מיתוג — 0
    "%d7%a1%d7%98-%d7%98%d7%9c%d7%99%d7%aa-%d7%aa%d7%a4%d7%99%d7%9c%d7%99%d7%9f", // סט טלית תפילין — 0
    "aluminum",                                                             // 1 product, duplicate
    "bencher-stands",                                                       // 1 product, duplicate
    "liqueur-sets",                                                         // 1 product, duplicate
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
    a: "אנו בוחרים כל פריט בקפידה, בהקפדה על איכות והידור. חשוב לדעת: בחנות נמכרים נרתיקי מזוזה, תיקי תפילין וכיסויים לטלית ולתפילין — ולא קלף כתוב או תפילין מסופר סת\"ם. חלק מהטליתות והציציות מגיעות בהשגחה רבנית. לפרטים על ההכשר של פריט מסוים נשמח לענות בטלפון או בוואטסאפ.",
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
    a: "כרגע אנו משלחים בתוך ישראל בלבד. למשלוחים לחו\"ל, אנא צרו קשר ישיר בוואטסאפ ונשמח לסייע.",
  },
  {
    q: "מה זה \"אור זרוע לצדיק\" ומי עומד מאחורי החנות?",
    // Product list matches FAQ item 1 and the catalog: כיסויים/נרתיקים, not klaf.
    a: "אור זרוע לצדיק היא חנות אונליין ישראלית לתשמישי קדושה ויודאיקה מהודרת, בבעלות ליאור בן עמי מקרית ביאליק. השם נלקח מהפסוק בתהילים (צ\"ז), \"אוֹר זָרֻעַ לַצַּדִּיק\". החנות מתמחה בטליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים, עם אפשרות רקמה וחריטה אישית ומשלוח עד הבית בישראל.",
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
    const [otherCats, featuredProducts, reviews, groomPrices, giftPicks] =
      await Promise.all([
        settle(fetchOtherCategories()),
        settle(fetchHomeFeaturedProducts()),
        settle(fetchHomeReviews()),
        settle(fetchGroomThumbPrices()),
        settle(fetchGiftPicks()),
      ]);
    return { otherCats, featuredProducts, reviews, groomPrices, giftPicks };
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
      { property: "og:description", content: "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש ומארזים לחתנים — נבחרים בהקפדה על כשרות והידור. רקמה אישית ומשלוח עד הבית." },
      { property: "og:url", content: "https://orzadik.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: HOME_TITLE },
      { name: "twitter:description", content: "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש ומארזים לחתנים — נבחרים בהקפדה על כשרות והידור." },
    ],
    links: [
      { rel: "canonical", href: "https://orzadik.com/" },
      // The hero poster is the homepage LCP paint — preload it so it shows fast.
      { rel: "preload", as: "image", href: "/media/hero-poster.webp", fetchpriority: "high" },
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
// CatTile now lives with the component that renders it — both rails on this
// page feed the same <CollectionCard>, so the shape is its contract, not this
// route's. Re-exported below because the loader's return type is public.
export type { CatTile };

// Curated featured categories. `slug` is hardcoded (verified against the DB) so
// the section renders at SSR — no client round-trip, no post-hydration CLS.
const FEATURED: { id: string; slug: string; name: string; img: string; w: number; h: number }[] = [
  { id: "ac72c907-8981-404d-b776-642467e43110", slug: "talitot", name: "טליתות", img: imgTallit, w: 800, h: 1000 },
  // Was marazim-chatanim. 7 of that category's 11 active products carry a null
  // thumbnail (measured 2026-08-09), so a homepage tile opened a grid that is
  // majority placeholder — a blocking owner input (photographs), not something
  // markup fixes. The groom sets keep their flagship band above, which uses the
  // real local photographs in public/groom-sets/, and the three product links
  // in that band still land on the photographed SKUs. This tile now opens the
  // wider חתן וכלה shelf: 45 active products, floor ₪28 effective, and its own
  // 7 image-less rows sink to the back under the shared shelf ordering.
  { id: "d2954417-843b-48fa-bf00-92a6dcf87d03", slug: "chatan-kala", name: "חתן וכלה", img: imgChatan, w: 800, h: 1067 },
  { id: "f48e44e3-eab6-4281-a09d-cac9a96a8e96", slug: "talit-tefillin-sets", name: "כיסויים לטלית ותפילין", img: imgTallitTefillinCovers, w: 800, h: 1067 },
  { id: "3109eed6-32e3-40eb-9fe4-874029b8ab4d", slug: "chalaka-set", name: "סט חלאקה", img: imgChalaka, w: 800, h: 1067 },
  { id: "c78aea58-8a38-43ee-a236-3aa2f1942225", slug: "yehudaika", name: "מוצרי יודאיקה", img: imgJudaica, w: 800, h: 800 },
  { id: "b6854069-9746-4490-b6ea-ef7debe4d795", slug: "sidurim", name: "סידורים ותהילים", img: imgSiddur, w: 800, h: 800 },
  { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", slug: "esh-sheli-gold", name: "אש שלי - תכשיטי זהב", img: imgGoldJewelry, w: 800, h: 1144 },
];

// Light-ground button variants. Every band on this page is now white/glass, so
// the old dark-ground pair is gone: `bg-gold-bright` is 1.84:1 on white and
// `text-cream` ~1.1:1 — both were only ever legal over the deleted argaman.
//   solid   — #7E611E fill with white text = 5.81:1 (hover #6B5219 = 7.38:1)
//   outline — #7E611E text on white/glass = 5.81:1, boundary 5.81:1 (>3:1)
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
// white label needs the flat --accent fill to hold 5.81:1.
// No colour transition either: .press owns transition-property (transform), so
// pairing one with it would be a lie about what actually animates.
//
// min-h in rem, not px, so the control still grows with the accessibility
// widget's font-size zoom — 3.25rem is 52px at the default root, comfortably
// past the 44px floor.
const BTN_BASE =
  "press inline-flex items-center justify-center gap-2 rounded-full min-h-[3.25rem] px-8 text-base font-semibold";
const BTN_SOLID =
  `${BTN_BASE} bg-accent text-white shadow-[var(--glass-shadow)] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong`;
const BTN_OUTLINE =
  `${BTN_BASE} border border-accent bg-white/85 text-accent [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary`;

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
    .in("slug", GROOM_THUMBS.map((t) => t.slug));
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
    </svg>
  );
}
function IconGem({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 2l2.39 4.84L20 7.74l-4 3.9.94 5.5L12 14.77l-4.94 2.37L8 11.64 4 7.74l5.61-.9z"/>
    </svg>
  );
}
function IconShieldCheck({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 22s-8-4.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-8 11-8 11z"/><path d="M9 12l2 2 4-4"/>
    </svg>
  );
}

// Three house facts, each already asserted in FAQ_ITEMS: personal embroidery &
// engraving, careful selection, and 3-14-day home delivery. Nothing new is
// claimed here — the strip only restates truths stated in the FAQ.
// The middle badge used to read "כשרות מהודרת עם תעודות", which asserted a
// certificate for EVERY product — candlesticks and gold jewelry included — and
// contradicted the FAQ answer above it. Keep this strip and FAQ_ITEMS in step:
// this comment is exactly the link that let the two drift apart before.
const DIFFERENTIATORS = [
  { title: "רקמה וחריטה אישית", icon: <IconGem className="w-8 h-8 md:w-9 md:h-9" /> },
  { title: "פריטים נבחרים בקפידה", icon: <IconShieldCheck className="w-8 h-8 md:w-9 md:h-9" /> },
  { title: "משלוח עד הבית 3-14 ימים", icon: <IconTruck className="w-8 h-8 md:w-9 md:h-9" /> },
];

/**
 * RTL "forward" arrow — points to the reading start (right→left), and slides
 * further on hover where the caller wraps it in a `group`. Decorative: every
 * use sits inside a link whose own text says where it goes. Extracted so the
 * occasion rail and the guides rail below it share one glyph instead of two
 * byte-identical inline copies.
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
].map((slug) => GUIDES[slug]).filter(Boolean);

// SSR-safe prefers-reduced-motion check — only ever called from effects/handlers.
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HomePage() {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const { otherCats, featuredProducts, reviews, groomPrices, giftPicks } =
    Route.useLoaderData();

  // Defer the hero video off the mobile critical path. The poster is the LCP
  // paint; with the <source> children present at first render, autoPlay would
  // override preload="metadata" and immediately stream the 1.2MB WebM / 3.0MB
  // MP4, competing with hero-poster.webp on mobile. So the sources are withheld
  // from the initial render (poster only) and attached after the browser goes
  // idle — requestIdleCallback, with a ~1200ms setTimeout fallback. The whole
  // attach is gated behind a reduced-motion check, so those users get the poster
  // only and never download the video at all. Mirrors LazyReel's below-the-fold
  // lazy pattern. SSR-safe: requestIdleCallback is touched only inside the
  // effect, never at module top-level or during render.
  const [heroSourcesReady, setHeroSourcesReady] = useState(false);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    let idleId: number | undefined;
    let timerId: ReturnType<typeof setTimeout> | undefined;
    const attach = () => setHeroSourcesReady(true);
    if (typeof w.requestIdleCallback === "function") {
      idleId = w.requestIdleCallback(attach, { timeout: 1200 });
    } else {
      timerId = setTimeout(attach, 1200);
    }
    return () => {
      if (idleId !== undefined) w.cancelIdleCallback?.(idleId);
      if (timerId !== undefined) clearTimeout(timerId);
    };
  }, []);

  // Once the <source> children are in the DOM, load() re-selects the resource so
  // the just-attached sources are picked up; autoPlay + muted then starts the
  // loop on its own.
  useEffect(() => {
    if (heroSourcesReady) {
      heroVideoRef.current?.load();
      heroVideoRef.current?.play()?.catch(() => {});
    }
  }, [heroSourcesReady]);

  // Static — rendered at SSR from the curated FEATURED list (slugs hardcoded), so
  // the tiles are in the initial HTML and the section never shifts after hydration.
  const cats: CatTile[] = FEATURED.map((f) => ({ slug: f.slug, name: f.name, img: f.img, w: f.w, h: f.h }));

  return (
    <>
      {/* 1. Hero */}
      <section className="relative">
        <video
          ref={heroVideoRef}
          poster="/media/hero-poster.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          // Decorative background footage: it carries no information the plaque
          // below does not already state in text (brand line, h1, sub-line), it
          // has no controls and is permanently muted, so it is hidden from the
          // accessibility tree rather than given a name that a screen reader
          // would read out as a second, duplicate brand announcement. This is
          // what the accessibility statement (§4.5) declares — keep them in sync.
          aria-hidden="true"
          // Bespoke 16:9 landscape loop, built for this hero (HyperFrames): a
          // seamless ~10.5s montage — tallit portrait → gold flame pendant →
          // siddur → crystal candlesticks → wrap back to the tallit — already
          // warm-graded with a baked-in sun-bloom + vignette, so it needs no CSS
          // treatment. It's SHARP on every viewport: on desktop the wide frame
          // fits the landscape band; on mobile object-cover center-crops onto the
          // flagship tallit portrait (face + embroidered atara), which opens and
          // closes the loop. The crisp warm POSTER (frame 0 of this same video)
          // carries first paint (LCP), so when the loop attaches it starts on the
          // identical frame — zero pop. object-position biases the crop a touch
          // high so faces stay in view. Reduced-motion users never load the video
          // and keep the poster. All decorative — contrast lives on the plaque.
          style={{ objectPosition: "50% 42%" }}
          className="block w-full min-h-[520px] h-[62svh] md:min-h-0 md:h-[60vh] md:max-h-[720px] object-cover bg-cream"
        >
          {/* Sources are attached only after the browser is idle (see the effect
              above) so they never compete with the LCP poster on first paint, and
              are skipped entirely for reduced-motion users. WebM (VP9) first —
              ~60% smaller (1.2MB vs 3.0MB); browsers that can't play it fall back
              to the MP4. */}
          {heroSourcesReady && (
            <>
              <source src="/media/hero-video.webm" type="video/webm" />
              <source src="/media/hero-video.mp4" type="video/mp4" />
            </>
          )}
        </video>

        {/* Depth stack over the footage — three decorative layers, none
            load-bearing for contrast (every glyph below sits on .glass-strong).
            Replaces the old flat white frost, which washed the whole hero cold
            and gray. */}
        {/* 1) Light pool + vignette: a pool of cream light at the plaque's
            position that the panel floats in (the "pane of light"), fading to
            warm-dark edges so the frame has depth instead of reading flat. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-[radial-gradient(118%_88%_at_50%_40%,rgba(255,251,242,0.60)_0%,rgba(252,245,230,0.14)_40%,transparent_58%,rgba(42,29,9,0.34)_100%)]"
        />
        {/* 2) A whisper of brand gold top-to-bottom, tying the mixed cool/warm
            reel to the warm identity. Low enough that crystal sparkle survives. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none bg-gradient-to-b from-[#7E611E]/22 via-[#7E611E]/10 to-[#4A360E]/34"
        />

        {/* Centered headline + CTAs over the video.
            The value-prop line is the page's only h1 (the colophon heading was demoted to h2).
            .glass-strong is the only glass that is contrast-safe over unknown
            backdrops: at 94% white the worst-case backing is #F0F0F0, where the
            foreground ink is 15.8:1, muted-foreground 5.75:1 and --accent 5.10:1 —
            all AA even over the video's darkest frames. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <div className="glass-strong stagger max-w-md md:max-w-2xl mx-auto px-6 py-5 md:px-12 md:py-8 [--glass-radius:1.5rem]">
            <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-3">
              אור זרוע לצדיק
            </p>
            <h1 className="font-display text-4xl md:text-6xl leading-[1.08] [text-wrap:balance] text-foreground">
              תשמישי קדושה ויודאיקה מהודרת
            </h1>
            <span aria-hidden="true" className="gold-rule block w-24 mx-auto my-4" />
            <p className="text-muted-foreground text-sm md:text-lg">
              טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה ומארזי חתן — עם רקמה וחריטה אישית
            </p>
            {/* ChevronLeft, not Right: the document is dir=rtl, so "forward"
                points LEFT — the same convention the RTL carousel uses when it
                puts "previous" on the right edge. aria-hidden because the link
                text already names the destination; the icon is affordance, not
                information. */}
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/shop" className={`${BTN_SOLID} w-full sm:w-auto`}>
                לחנות
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
              {/* Was /category/marazim-chatanim. Same button, same geometry —
                  only the destination moved, and only because 7 of that
                  category's 11 products have no photograph, so the hero's
                  second door opened on a wall of placeholders. /collection/
                  chatan-kala unions חתן כלה, חתונה, מארזים לחתנים, כיסויים
                  לטלית and ברכונים, so the groom boxes are still in there —
                  they are simply no longer the first thing a stranger meets,
                  and the shared shelf ordering sinks the image-less rows last.
                  The label moved with the destination: a CTA must name where it
                  goes. */}
              <Link
                to="/collection/$slug"
                params={{ slug: "chatan-kala" }}
                className={`${BTN_OUTLINE} w-full sm:w-auto`}
              >
                לחתן ולכלה
                <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. מארזי חתן — flagship band. Was the page's largest dark surface; it is
          now the white ground carrying a single glass panel. Every descendant that
          relied on the argaman backing moved with it: cream → foreground/muted,
          gold-bright → --accent, gold-bright frames → .hairline-gold. */}
      <section className="min-h-[480px] flex items-center">
        <div className="container mx-auto px-4 max-w-6xl py-14 md:py-20 w-full">
          {/* Section entrance, staged 120ms behind the hero plaque so the two
              read as one arrival rather than two competing fades. This is the
              last band that can still be on screen at first paint (the hero is
              60vh), so it is the last place a reveal is honest: `.reveal` is a
              load-time keyframe with no IntersectionObserver, and anything
              further down the page would have finished long before the shopper
              scrolled to it. `both` fill means the panel is never left
              invisible if the animation does not run. */}
          <div className="glass glass-gold reveal [--reveal-delay:120ms] grid md:grid-cols-2 gap-10 items-center p-8 md:p-12 [--glass-radius:1.5rem]">
            {/* Text column (RTL start) */}
            <div>
              <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-4">
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
                טלית מהודרת, עטרה וכלי קודש נבחרים — מוגשים במארז מעוצב. אפשר להוסיף רקמה או חריטה אישית בשם החתן.
              </p>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
                {/* The band's own CTA also leaves /category/marazim-chatanim —
                    see the hero note above for the measurement. The three thumb
                    links below still go straight to the photographed groom sets,
                    so a shopper who wants a groom box is one tap away; what is
                    gone is the door that opened on 7 placeholders. */}
                <Link
                  to="/collection/$slug"
                  params={{ slug: "chatan-kala" }}
                  className={BTN_SOLID}
                >
                  לכל מתנות החתן והכלה
                </Link>
                <Link
                  to="/category/$slug"
                  params={{ slug: "chatan-kala" }}
                  className="text-sm md:text-base text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
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
                <span aria-hidden="true" className="hairline-gold absolute inset-3 rounded-lg pointer-events-none" />
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
                    <span aria-hidden="true" className="hairline-gold absolute inset-0 rounded-lg pointer-events-none" />
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
        </div>
      </section>

      {/* 3. Differentiators — three TRUE house facts on a glass-soft strip that
          hugs the flagship and leads into the trust band. The only motion is the
          shared hover-lift (.glass-lift); no new claim is made. */}
      <section>
        <Reveal className="container mx-auto px-4 pb-14 md:pb-20 max-w-6xl">
          <div className="grid grid-cols-3 gap-3 md:gap-6">
            {DIFFERENTIATORS.map((d) => (
              <div
                key={d.title}
                className="glass-soft glass-lift flex flex-col items-center text-center gap-3 md:gap-4 px-3 py-6 md:px-6 md:py-8 [--glass-radius:1rem]"
              >
                <span className="text-accent">{d.icon}</span>
                <span className="font-display text-xs md:text-lg text-foreground leading-tight">
                  {d.title}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* 4. Personalization teaser — the store's moat (רקמה/חריטה) as a compact
          band, placed right after the differentiators strip that names it. Honest:
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
                על כיסויים לטלית ותפילין, תיקים וסידורים — את הגופן, הצבע והמיקום נתאם איתכם לאחר ההזמנה.
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
                className="group flex flex-col items-center text-center gap-4 md:gap-5 px-6 py-8 md:py-4"
              >
                <div className="text-accent transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-1">
                  {item.icon}
                </div>
                <div>
                  <h3 className="font-display text-xl md:text-2xl mb-2 md:mb-3 tracking-wide">
                    {item.title}
                  </h3>
                  <p className="text-sm md:text-[15px] text-muted-foreground leading-relaxed max-w-xs mx-auto">
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
              <a
                href={GOOGLE_PLACE_URL}
                target="_blank"
                rel="noopener"
                className={BTN_SOLID}
              >
                הפרופיל שלנו בגוגל מפות
              </a>
              <a
                href={`tel:${BUSINESS.phone}`}
                className="text-sm text-accent underline underline-offset-4 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
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

          MOVED UP, above both category rails. It used to sit between them, in
          third place among three browse blocks, which put the shop's only
          rankable gift-guide surfaces behind two grids of category tiles. A
          stranger arriving here rarely wants "a category" — they want a present
          for a specific simcha, and this is the one rail on the page that is
          organised the way they are thinking. The two category rails below are
          the fallback for everything the shop has not curated an occasion for,
          which is the right order of specificity. */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader eyebrow="מתנה לכל שמחה" title="קונים לפי אירוע" />
          {/* basis-[68%] on mobile: one card fills the rail and the next peeks past
              the edge so it reads as swipeable. md:/lg: layout is owned by MobileCarousel. */}
          <MobileCarousel
            basis="basis-[68%]"
            mdGrid="md:grid-cols-3 lg:grid-cols-4"
            mdGap="md:gap-5"
            className="max-w-6xl mx-auto"
          >
            {OCCASION_COLLECTIONS.map((c) => (
              // /collection/$slug — `to`/`params` cast as categories.tsx does, so the
              // link does not depend on the router's path union being regenerated.
              <Link
                key={c.slug}
                to="/collection/$slug"
                params={{ slug: c.slug }}
                className="group block h-full"
              >
                <div className="glass-soft glass-lift flex h-full flex-col justify-between gap-6 p-6 md:p-7 [--glass-radius:1rem]">
                  <div>
                    <p className="mb-2 text-[10px] md:text-xs tracking-[0.22em] text-accent">
                      {c.eyebrow}
                    </p>
                    <h3 className="font-display text-lg md:text-xl text-foreground leading-tight">
                      {c.title}
                    </h3>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm text-accent">
                    לצפייה
                    <IconArrowStart className="w-4 h-4 transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-1" />
                  </span>
                </div>
              </Link>
            ))}
          </MobileCarousel>
        </Reveal>
      </section>

      {/* 6. Featured categories */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader eyebrow="הקולקציות שלנו" title="מה תרצו לגלות?" />
          {/* basis-[62%], not the 43% this rail used to carry. 43% of a 390px
              phone renders a 144.8px card, and <CollectionCard>'s plate cannot
              be built at that width without dropping the category name to the
              11px legal-text floor to make room for the decoration above it.
              62% gives 216px, which is the narrowest the card is designed for.
              The next tile still peeks, so the rail still reads as swipeable —
              just less of it. md:/lg: layout is owned by MobileCarousel. */}
          <MobileCarousel
            basis="basis-[62%]"
            mdGrid="md:grid-cols-3"
            mdGap="md:gap-6"
            className="max-w-6xl mx-auto"
          >
            {cats.map((c) => (
              <CollectionCard key={c.slug} cat={c} />
            ))}
          </MobileCarousel>
        </Reveal>
      </section>

      {/* 7.5. שאר הקטגוריות — the remaining categories that have artwork, grouped
          with the two browse rails above it. A crawlable strip of internal
          /category/$slug links plus a browse-everything path to /categories.
          Server-rendered from the loader (otherCats resolved at SSR); on the rare
          loader failure it renders nothing rather than an empty box. */}
      <OtherCategoriesSection cats={otherCats ?? []} reserveSpace={false} />

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
              <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-4">
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
          <div className="text-center mb-10 md:mb-14">
            <p className="text-[10px] md:text-xs tracking-[0.35em] text-accent mb-3">
              גלריה
            </p>
            <h2 className="font-display text-3xl md:text-4xl tracking-wide mb-3 text-foreground">
              מהפריטים שלנו
            </h2>
            <div className="flex items-center justify-center gap-3 mb-4" aria-hidden="true">
              <span className="gold-rule w-8 shrink-0" />
              <span className="text-accent text-xs">✦</span>
              <span className="gold-rule w-8 shrink-0" />
            </div>
            <p className="mx-auto max-w-xl text-sm md:text-[15px] text-muted-foreground leading-relaxed">
              מבחר צילומים וסרטונים של פריטים מהחנות. לעדכונים שוטפים ולתכנים נוספים —
              עקבו אחרינו באינסטגרם:{" "}
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent underline underline-offset-4 transition-[color] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent-strong"
              >
                @or_zarua_latzadik
              </a>
            </p>
          </div>

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
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                      {g.blurb}
                    </p>
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
            <div className="text-xs tracking-[0.35em] text-accent mb-3">
              הישארו מעודכנים
            </div>
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
            <strong>אור זרוע לצדיק</strong> היא חנות אונליין ישראלית לתשמישי קדושה ויודאיקה מהודרת — טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים. השם נלקח מהפסוק בתהילים (צ״ז), "אוֹר זָרֻעַ לַצַּדִּיק", ומבטא את רוח החנות: אור, הידור ואיכות. הפריטים נבחרים בהקפדה על כשרות והידור, ואנו מציעים רקמה וחריטה אישית ומשלוח עד הבית בכל הארץ.
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
                <AccordionItem key={i} value={`faq-${i}`} className="border-gold/30 last:border-b-0">
                  <AccordionTrigger className="text-right font-display text-base">{item.q}</AccordionTrigger>
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
          opts={{ direction: "rtl", loop: true, dragFree: true, align: "start" }}
          aria-label="שאר הקטגוריות"
        >
          {/* The basis chain below replaces basis-1/2 sm:basis-1/3 lg:basis-1/5.
              The old one was NON-MONOTONIC: 234.7px at a 1023px viewport,
              185.6px at 1024px, because the basis dropped a whole column at lg
              while the container only grew 256px. That 1024-1279 band is iPad
              landscape and small laptops, and 185.6px was the site's narrowest
              desktop card — 8% wider than the phone. Stepping through
              md:1/3 -> lg:1/4 -> xl:1/5 keeps every band at or above 216px and
              removes the pinch. Cost: 4 tiles per row instead of 5 between
              1024 and 1535. */}
          <CarouselContent>
            {cats.map((c) => (
              <CarouselItem
                key={c.slug}
                className="basis-[62%] sm:basis-[38%] md:basis-1/3 lg:basis-1/4 xl:basis-1/5"
              >
                <CollectionCard cat={c} />
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
const GALLERY_MEDIA: { type: "video" | "image"; src: string; w?: number; h?: number }[] = [
  { type: "video", src: igReel1 },
  { type: "video", src: igReel2 },
  { type: "image", src: igPost1, w: 1080, h: 1350 },
  { type: "video", src: igReel3 },
  { type: "video", src: igReel4 },
  { type: "video", src: igReel5 },
];

const INSTAGRAM_URL = "https://www.instagram.com/or_zarua_latzadik/";

/**
 * Reel that only downloads and plays once it scrolls near the viewport.
 * Avoids fetching ~23MB of below-the-fold video on initial page load.
 */
function LazyReel({ src }: { src: string }) {
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
      muted
      loop
      playsInline
      // "metadata" once visible so the first frame paints even when reduced
      // motion skips play(); "none" keeps the initial page load light.
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
                <LazyReel src={m.src} />
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
              <div aria-hidden="true" className="absolute inset-0 bg-foreground/0 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:bg-foreground/20" />
              <div className="absolute top-3 right-3 opacity-0 transition-opacity duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-background drop-shadow">
                  <rect x="3" y="3" width="18" height="18" rx="5"/>
                  <circle cx="12" cy="12" r="4"/>
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor"/>
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
