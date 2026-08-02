import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FeaturedProductsCarousel,
  fetchHomeFeaturedProducts,
} from "@/components/home/FeaturedProductsCarousel";
import { MobileCarousel } from "@/components/MobileCarousel";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { readRecent } from "@/components/engagement/recently-viewed";
import { NewsletterSignup } from "@/components/NewsletterSignup";
import { LuxuryShowcase, fetchLuxuryShowcaseCards } from "@/components/home/LuxuryShowcase";
import { HomeReviews, fetchHomeReviews } from "@/components/content/HomeReviews";
import { SectionHeader } from "@/components/home/SectionHeader";
import { Reveal } from "@/components/Reveal";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
import { CONSUMER_POLICY } from "@/lib/business";
import { formatILS, getEffectivePrice } from "@/lib/cart";
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
import oc_polyrasin from "@/assets/other-cats/polyrasin-stone.webp";
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
  "polyrasin-stone": oc_polyrasin,
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

// Single source of truth for the homepage FAQ — feeds both the FAQPage JSON-LD
// in head() (the SEO carrier) and the visible accordion. The fuller answers
// (previously only in the JSON-LD) are canonical.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "האם המוצרים מהודרים ובעלי כשרות?",
    // Truthful scope. The catalog holds נרתיקי מזוזה, תיקי תפילין and כיסויים —
    // NOT written klaf or sofer-made tefillin — so the previous answer ("תפילין
    // ומזוזות מגיעים עם תעודות כשרות") named products the store does not sell.
    // This string is ALSO emitted as FAQPage JSON-LD, so it was eligible to show
    // verbatim as a Google rich result. Part of the tzitzit/talit range does
    // carry hashgacha, which is why that is stated separately rather than dropped.
    a: "אנו בוחרים כל פריט בקפידה, בהקפדה על איכות והידור. חשוב לדעת: בחנות נמכרים נרתיקי מזוזה, תיקי תפילין וכיסויים לטלית ולתפילין — ולא קלף כתוב או תפילין מסופר סת\"ם. חלק מהטליתות והציציות מגיעות בהשגחה רבנית. לפרטים על ההכשר של פריט מסוים נשמח לענות בטלפון או בוואטסאפ.",
  },
  {
    q: "האם ניתן להוסיף שם אישי או רקמה על המוצרים?",
    a: "בהחלט! אנו מציעים שירות רקמה אישית וחריטת לייזר על מגוון רחב של מוצרים — כולל כיסויים לטלית ותפילין, תיקי תפילין וסידורים. ניתן להזמין בעת הרכישה.",
  },
  {
    q: "כמה זמן לוקח המשלוח?",
    a: `המשלוח מגיע תוך ${CONSUMER_POLICY.deliveryMinDays}–${CONSUMER_POLICY.deliveryMaxDays} ימי עסקים לכל רחבי הארץ. מוצרים עם רקמה אישית עשויים לקחת מעט יותר זמן. אפשר לעקוב אחר מצב ההזמנה בעמוד "מעקב הזמנה" עם מספר ההזמנה וכתובת הדוא"ל, וכאשר מתקבל מספר מעקב מחברת השילוח הוא מופיע שם.`,
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

export const Route = createFileRoute("/")({
  component: HomePage,
  // Everything below the hero used to be fetched only after hydration, which
  // meant three whole sections injected themselves mid-page and shifted the
  // rest down. Resolving them here puts them in the server-rendered HTML.
  // Each fetch is independently fault-tolerant — see settle().
  loader: async () => {
    const [otherCats, featuredProducts, luxuryCards, reviews, groomPrices] = await Promise.all([
      settle(fetchOtherCategories()),
      settle(fetchHomeFeaturedProducts()),
      settle(fetchLuxuryShowcaseCards()),
      settle(fetchHomeReviews()),
      settle(fetchGroomThumbPrices()),
    ]);
    return { otherCats, featuredProducts, luxuryCards, reviews, groomPrices };
  },
  head: () => ({
    meta: [
      { title: "אור זרוע לצדיק | תשמישי קדושה ויודאיקה מהודרת" },
      // "נבחרים בהקפדה על כשרות והידור" — a selection claim, matching llms.txt
      // and FAQ item 1. The previous "כשרות מהודרת" asserted certification for
      // every SKU (candlesticks and gold jewelry included) in the SERP snippet.
      { name: "description", content: "חנות תשמישי קדושה ויודאיקה: טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים. נבחרים בהקפדה על כשרות והידור, רקמה אישית ומשלוח עד הבית." },
      { property: "og:title", content: "אור זרוע לצדיק | תשמישי קדושה ויודאיקה מהודרת" },
      { property: "og:description", content: "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש ומארזים לחתנים — נבחרים בהקפדה על כשרות והידור. רקמה אישית ומשלוח עד הבית." },
      { property: "og:url", content: "https://orzadik.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "אור זרוע לצדיק | תשמישי קדושה ויודאיקה מהודרת" },
      { name: "twitter:description", content: "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש ומארזים לחתנים — נבחרים בהקפדה על כשרות והידור." },
    ],
    links: [
      { rel: "canonical", href: "https://orzadik.com/" },
      // The hero poster is the homepage LCP paint — preload it so it shows fast.
      { rel: "preload", as: "image", href: "/media/hero-poster.webp", fetchpriority: "high" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: FAQ_ITEMS.map((item) => ({
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
type CatTile = { slug: string; name: string; img: string; w: number; h: number };

// Curated featured categories. `slug` is hardcoded (verified against the DB) so
// the section renders at SSR — no client round-trip, no post-hydration CLS.
const FEATURED: { id: string; slug: string; name: string; img: string; w: number; h: number }[] = [
  { id: "ac72c907-8981-404d-b776-642467e43110", slug: "talitot", name: "טליתות", img: imgTallit, w: 800, h: 1000 },
  { id: "51fd0522-192a-4ec2-bfc3-abf891b2e35e", slug: "marazim-chatanim", name: "מארזים לחתנים", img: imgChatan, w: 800, h: 1067 },
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
const BTN_SOLID =
  "press inline-block rounded-full bg-accent text-white px-8 py-3 text-sm md:text-base font-semibold [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong";
const BTN_OUTLINE =
  "press inline-block rounded-full border border-accent bg-white/60 text-accent px-8 py-3 text-sm md:text-base [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary";

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
const GROOM_THUMBS: { img: string; slug: string }[] = [
  { img: "/groom-sets/groom-03.jpeg", slug: "groom-set-grey-melange" },
  { img: "/groom-sets/groom-05.jpeg", slug: "groom-set-brown-leather-look" },
  { img: "/groom-sets/groom-07.jpeg", slug: "groom-set-black-leather-look" },
];

/**
 * Live prices for the three groom thumbs above. Same contract as the luxury
 * showcase: fetch the RAW row price and apply getEffectivePrice() at the render
 * site, so the badge, the PDP and the cart all run the one function.
 */
async function fetchGroomThumbPrices(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from("products")
    .select("slug, price")
    .in("slug", GROOM_THUMBS.map((t) => t.slug));
  if (error) throw error;
  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const n = Number(row.price);
    if (Number.isFinite(n) && n > 0) out[row.slug] = n;
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

// SSR-safe prefers-reduced-motion check — only ever called from effects/handlers.
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HomePage() {
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);
  const { otherCats, featuredProducts, luxuryCards, reviews, groomPrices } = Route.useLoaderData();

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
            <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
              <Link to="/shop" className={`${BTN_SOLID} w-full sm:w-auto`}>
                לחנות
              </Link>
              <Link
                to="/category/$slug"
                params={{ slug: "marazim-chatanim" }}
                className={`${BTN_OUTLINE} w-full sm:w-auto`}
              >
                למארזי החתן
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
                <Link to="/category/$slug" params={{ slug: "marazim-chatanim" }} className={BTN_SOLID}>
                  לצפייה במארזי החתן
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
                  const raw = groomPrices?.[t.slug];
                  const price =
                    raw !== undefined && Number.isFinite(raw) && raw > 0
                      ? formatILS(getEffectivePrice(raw))
                      : null;
                  return (
                  <Link
                    key={t.slug}
                    to="/product/$slug"
                    params={{ slug: t.slug }}
                    className="group relative block aspect-square overflow-hidden rounded-lg"
                  >
                    <img
                      src={t.img}
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
          <SectionHeader eyebrow="ההבטחה שלנו" title="למה לקוחות בוחרים בנו" />

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
                desc: `אספקה משוערת ${CONSUMER_POLICY.deliveryMinDays}–${CONSUMER_POLICY.deliveryMaxDays} ימי עסקים לכל הארץ, ארוז בקפידה — עם מעקב אחר ההזמנה בכל שלב.`,
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

      {/* 6. Featured categories */}
      <section>
        <Reveal className="container mx-auto px-4 py-14 md:py-20">
          <SectionHeader eyebrow="הקולקציות שלנו" title="מה תרצו לגלות?" />
          {/* basis-[43%] on mobile: a third tile peeks past the edge so the rail
              reads as swipeable. md:/lg: layout is owned by MobileCarousel. */}
          <MobileCarousel
            basis="basis-[43%]"
            mdGrid="md:grid-cols-3"
            mdGap="md:gap-6"
            className="max-w-6xl mx-auto"
          >
            {cats.map((c) => (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group block"
              >
                <div className="glass-lift relative aspect-square overflow-hidden rounded-lg bg-muted">
                  <img
                    src={c.img}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    width={c.w}
                    height={c.h}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
                  />
                  {/* Photo scrim stays dark — it is the one dark surface the
                      direction keeps — but re-pointed from warm #2A211A to the
                      cool ink --argaman-deep. */}
                  <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-argaman-deep/70 via-transparent to-transparent" />
                  {/* Single label plaque — glass-strong, since it sits on a photo.
                      Lifts with the same hover gate as the img (transform-only,
                      200ms, --ease-out) so photo + label move as one object. */}
                  <div className="absolute inset-x-0 bottom-4 flex justify-center px-3">
                    <span className="glass-strong px-5 py-2 font-display text-base text-foreground text-center leading-tight [--glass-radius:9999px] transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-y-0.5">
                      {c.name}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </MobileCarousel>
        </Reveal>
      </section>

      {/* 7. קונים לפי אירוע — the occasion/holiday hubs (/collection/<slug>) as
          first-screen discovery, right after the featured categories. Judaica is
          calendar- and lifecycle-driven, so shopping by occasion (בר מצווה, חתונה,
          בית חדש) and by holiday (ראש השנה, חנוכה, פסח) is a primary path. Text-only
          glass cards — no imagery to fetch — with the eyebrow in --accent (the only
          gold) and the shared .glass-lift hover motion. Swipeable on a phone via
          MobileCarousel, a grid from md up. SSR-safe: OCCASION_COLLECTIONS is pure
          data imported at module scope, so the rail is in the server HTML. */}
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
                to={"/collection/$slug" as any}
                params={{ slug: c.slug } as any}
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
                    {/* RTL "forward" arrow — points to the reading start, and slides
                        further on hover (motion-safe + hover-gated). Decorative. */}
                    <svg
                      aria-hidden="true"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="w-4 h-4 transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-1"
                    >
                      <path d="M19 12H5" />
                      <path d="M12 19l-7-7 7-7" />
                    </svg>
                  </span>
                </div>
              </Link>
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

      {/* 9. פריטי יוקרה — curated luxury showcase */}
      <LuxuryShowcase initialCards={luxuryCards ?? undefined} />

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
          {/* The FAQPage JSON-LD in head() is the SEO carrier (Radix unmounts
              closed panels); defaultValue keeps one answer in the initial DOM. */}
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
 * ever over-reserve): <768px 528 · 768-1279px 536 · >=1280px 589.
 */
const OTHER_CATS_RESERVED_HEIGHT = " min-h-[530px] md:min-h-[540px] xl:min-h-[590px]";

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
          <CarouselContent>
            {cats.map((c) => (
              <CarouselItem key={c.slug} className="basis-1/2 sm:basis-1/3 lg:basis-1/5">
                <Link
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="group/card relative block"
                >
                  <div className="relative aspect-square overflow-hidden rounded-lg border border-gold/30 bg-muted">
                    <img
                      src={c.img}
                      alt={c.name}
                      loading="lazy"
                      decoding="async"
                      width={c.w}
                      height={c.h}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover/card:scale-105"
                    />
                    {/* Cool-ink photo scrim (was warm #2A211A) */}
                    <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-argaman-deep/70 via-transparent to-transparent" />
                    {/* Plaque label — glass-strong, it sits on a photo */}
                    <div className="absolute inset-x-0 bottom-3 flex justify-center px-2">
                      <span className="glass-strong px-4 py-1.5 font-display text-xs md:text-sm text-foreground text-center leading-tight [--glass-radius:9999px]">
                        {c.name}
                      </span>
                    </div>
                  </div>
                </Link>
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
