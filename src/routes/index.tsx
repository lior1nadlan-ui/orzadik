import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FeaturedProductsCarousel } from "@/components/home/FeaturedProductsCarousel";
import { HomeReviews } from "@/components/content/HomeReviews";
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
import heroVideoAsset from "@/assets/hero-video.mp4.asset.json";
const heroVideo = heroVideoAsset.url;
import imgSiddur from "@/assets/cat-siddur.webp";
import imgTallit from "@/assets/cat-tallit.webp";
import imgChatan from "@/assets/cat-chatan.webp";
import imgChalaka from "@/assets/cat-chalaka.webp";
import imgBooks from "@/assets/cat-books.webp";
import imgGoldJewelry from "@/assets/cat-gold-jewelry.webp";
import imgTallitTefillinCovers from "@/assets/cat-tallit-tefillin-covers.webp";
import imgJudaica from "@/assets/cat-judaica.webp";
import imgWallArtAsset from "@/assets/categories/wall-art.jpeg.asset.json";
const imgWallArt = imgWallArtAsset.url;
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
  "%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa": oc_tallitTzitzit,
  "challah-covers": oc_challahCover,
  "%d7%9b%d7%99%d7%a4%d7%95%d7%aa": oc_kippot,
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



// Single source of truth for the homepage FAQ — feeds both the FAQPage JSON-LD
// in head() (the SEO carrier) and the visible accordion. The fuller answers
// (previously only in the JSON-LD) are canonical.
const FAQ_ITEMS: { q: string; a: string }[] = [
  {
    q: "האם המוצרים מהודרים ובעלי כשרות?",
    a: "כן. כל מוצר נבחר בקפידה ועומד בסטנדרטים גבוהים של כשרות ומהדרין. טליתות, תפילין ומזוזות מגיעים עם תעודות כשרות מגופים מוכרים.",
  },
  {
    q: "האם ניתן להוסיף שם אישי או רקמה על המוצרים?",
    a: "בהחלט! אנו מציעים שירות רקמה אישית וחריטת לייזר על מגוון רחב של מוצרים — כולל כיסויים לטלית ותפילין, תיקי תפילין וסידורים. ניתן להזמין בעת הרכישה.",
  },
  {
    q: "כמה זמן לוקח המשלוח?",
    a: "המשלוח מגיע תוך 3–14 ימי עסקים לכל רחבי הארץ. מוצרים עם רקמה אישית עשויים לקחת מעט יותר זמן. תקבלו מספר מעקב עם שיגור ההזמנה.",
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
    a: "אור זרוע לצדיק היא חנות אונליין ישראלית לתשמישי קדושה ויודאיקה מהודרת, בבעלות ליאור בן עמי מקרית ביאליק. השם נלקח מהפסוק בתהילים (צ\"ז), \"אוֹר זָרֻעַ לַצַּדִּיק\". החנות מתמחה בטליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות ומארזים לחתנים, עם אפשרות רקמה וחריטה אישית ומשלוח עד הבית בישראל.",
  },
];

export const Route = createFileRoute("/")({
  component: HomePage,
  head: () => ({
    meta: [
      { title: "אור זרוע לצדיק | תשמישי קדושה ויודאיקה מהודרת" },
      { name: "description", content: "חנות תשמישי קדושה ויודאיקה: טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, מארזים לחתנים וסטי חלאקה. כשרות מהודרת, רקמה אישית ומשלוח עד הבית." },
      { property: "og:title", content: "אור זרוע לצדיק | תשמישי קדושה ויודאיקה מהודרת" },
      { property: "og:description", content: "טליתות, תפילין, מזוזות, גביעי קידוש ומארזים לחתנים בכשרות מהודרת. רקמה אישית ומשלוח עד הבית." },
      { property: "og:url", content: "https://orzadik.com/" },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "אור זרוע לצדיק | תשמישי קדושה ויודאיקה מהודרת" },
      { name: "twitter:description", content: "טליתות, תפילין, מזוזות, גביעי קידוש ומארזים לחתנים בכשרות מהודרת." },
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

type CatTile = { slug: string; name: string; img: string };

// Curated featured categories. `slug` is hardcoded (verified against the DB) so
// the section renders at SSR — no client round-trip, no post-hydration CLS.
const FEATURED: { id: string; slug: string; name: string; img: string }[] = [
  { id: "ac72c907-8981-404d-b776-642467e43110", slug: "%d7%98%d7%9c%d7%99%d7%aa%d7%95%d7%aa-%d7%95%d7%a6%d7%99%d7%a6%d7%99%d7%95%d7%aa", name: "טליתות", img: imgTallit },
  { id: "51fd0522-192a-4ec2-bfc3-abf891b2e35e", slug: "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%97%d7%aa%d7%95%d7%a0%d7%94-%d7%95%d7%91%d7%a8-%d7%9e%d7%a6%d7%95%d7%95%d7%94", name: "מארזים לחתנים", img: imgChatan },
  { id: "f48e44e3-eab6-4281-a09d-cac9a96a8e96", slug: "talit-tefillin-sets", name: "כיסויים לטלית ותפילין", img: imgTallitTefillinCovers },
  { id: "3109eed6-32e3-40eb-9fe4-874029b8ab4d", slug: "chalaka-set", name: "סט חלאקה", img: imgChalaka },
  { id: "c78aea58-8a38-43ee-a236-3aa2f1942225", slug: "%d7%9e%d7%95%d7%a6%d7%a8%d7%99-%d7%99%d7%95%d7%93%d7%90%d7%99%d7%a7%d7%94", name: "מוצרי יודאיקה", img: imgJudaica },
  { id: "b6854069-9746-4490-b6ea-ef7debe4d795", slug: "%d7%a1%d7%99%d7%93%d7%95%d7%a8%d7%99%d7%9d", name: "סידורים ותהילים", img: imgSiddur },
  { id: "f356bae8-de78-45c6-ab68-f9b2e82444cf", slug: "study-books", name: "ספרי לימוד", img: imgBooks },
  { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", slug: "esh-sheli-gold", name: "אש שלי - תכשיטי זהב", img: imgGoldJewelry },
  { id: "b1e55fa1-0000-4000-8000-000000000002", slug: "laser-cut", name: "חיתוך בלייזר", img: imgWallArt },
];



// SSR-safe prefers-reduced-motion check — only ever called from effects/handlers.
function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function HomePage() {
  const featuredIds = FEATURED.map((f) => f.id);
  const heroVideoRef = useRef<HTMLVideoElement | null>(null);

  // Respect "reduce motion": stop the autoplaying hero loop after mount.
  useEffect(() => {
    if (prefersReducedMotion()) heroVideoRef.current?.pause();
  }, []);

  const { data: otherCats = [] } = useQuery({
    queryKey: ["home-other-categories-static", featuredIds],
    queryFn: async (): Promise<CatTile[]> => {
      const { data: cats, error } = await supabase
        .from("categories")
        .select("id, slug, name")
        .not("id", "in", `(${featuredIds.join(",")})`);
      if (error) throw error;

      const blacklist = new Set(["sale", "uncategorized"]);
      return (cats || [])
        .filter((c) => OTHER_CATS_IMAGES[c.slug] && !blacklist.has(c.slug))
        .map((c) => ({ slug: c.slug, name: c.name, img: OTHER_CATS_IMAGES[c.slug] }));
    },
  });




  // Static — rendered at SSR from the curated FEATURED list (slugs hardcoded), so
  // the tiles are in the initial HTML and the section never shifts after hydration.
  const cats: CatTile[] = FEATURED.map((f) => ({ slug: f.slug, name: f.name, img: f.img }));

  return (
    <>
      {/* Hero */}
      <section className="relative">
        <video
          ref={heroVideoRef}
          poster="/media/hero-poster.webp"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="אור זרוע לצדיק — תשמישי קדושה ויודאיקה מהודרת"
          className="block w-full h-[40vh] md:h-[60vh] object-cover bg-cream"
        >
          {/* WebM (VP9) first — ~66% smaller; browsers that can't play it fall back to the MP4. */}
          <source src="/media/hero-video.webm" type="video/webm" />
          <source src={heroVideo} type="video/mp4" />
        </video>

        {/* Scrim so the overlay text stays readable over any frame of the video */}
        <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-foreground/60 via-foreground/20 to-transparent pointer-events-none" />

        {/* Headline + CTAs over the video */}
        <div className="absolute inset-x-0 bottom-0 pb-10 md:pb-16 px-6 text-center">
          <h2 className="font-display text-3xl md:text-5xl text-white drop-shadow">
            אור זרוע לצדיק
          </h2>
          <p className="mt-2 text-white/90 text-sm md:text-lg">
            תשמישי קדושה ויודאיקה מהודרת — 15% הנחה על כל האתר
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <Link
              to="/shop"
              className="rounded-full bg-accent hover:bg-accent/90 text-accent-foreground px-8 py-3 text-sm md:text-base font-semibold transition-colors"
            >
              לכל המוצרים
            </Link>
            <Link
              to="/category/$slug"
              params={{ slug: FEATURED[0].slug }}
              className="rounded-full border border-white/80 text-white px-8 py-3 text-sm md:text-base hover:bg-white/10 transition-colors"
            >
              לקולקציית הטליתות
            </Link>
          </div>
        </div>
      </section>

      {/* Featured categories */}
      <section className="bg-cream/40">
        <div className="container mx-auto px-4 py-10 md:py-14">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-5 md:gap-8 max-w-5xl mx-auto">
            {cats.map((c) => (
              <Link
                key={c.slug}
                to="/category/$slug"
                params={{ slug: c.slug }}
                className="group block"
              >
                <div className="relative aspect-square overflow-hidden rounded-[28px] bg-muted shadow-[0_20px_60px_-20px_rgba(0,0,0,0.35)] ring-1 ring-accent/15 transition-all duration-700 group-hover:shadow-[0_30px_80px_-20px_rgba(0,0,0,0.5)] group-hover:ring-accent/40">
                  <img
                    src={c.img}
                    alt={c.name}
                    loading="lazy"
                    decoding="async"
                    width={1024}
                    height={1024}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1600ms] ease-out group-hover:scale-110"
                  />

                  {/* Subtle gold lens tint over the photo */}
                  <div aria-hidden="true" className="absolute inset-0 mix-blend-soft-light bg-[radial-gradient(ellipse_at_30%_20%,hsl(var(--accent)/0.85),transparent_65%)] opacity-100" />
                  <div aria-hidden="true" className="absolute inset-0 mix-blend-overlay bg-gradient-to-br from-accent/45 via-accent/15 to-accent/35 opacity-90" />
                  <div aria-hidden="true" className="absolute inset-0 mix-blend-color bg-accent/20 opacity-60" />

                  {/* Gold sheen sweep on hover */}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="absolute -inset-y-10 -left-1/3 w-2/3 rotate-12 bg-gradient-to-r from-transparent via-accent/60 to-transparent blur-2xl opacity-0 group-hover:opacity-100 group-hover:translate-x-[220%] transition-all duration-[1600ms] ease-out" />
                  </div>

                  {/* Inner gold frame hairline — bolder */}
                  <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-[22px] border-[1.5px] border-accent/60 transition-colors duration-700 group-hover:border-accent/90" />
                  <div aria-hidden="true" className="pointer-events-none absolute inset-[14px] rounded-[20px] border border-accent/25" />

                  {/* Discount badge — 15% off */}
                  <div className="absolute top-5 left-5 md:top-6 md:left-6 z-10">
                    <div className="relative flex flex-col items-center justify-center rounded-full bg-gradient-to-br from-accent via-[#D4AF37] to-[#A8862A] text-background shadow-[0_8px_24px_-6px_rgba(0,0,0,0.55)] ring-2 ring-background/80 w-16 h-16 md:w-20 md:h-20 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-[-6deg]">
                      <span className="font-display text-lg md:text-xl font-bold leading-none">15%</span>
                      <span className="text-[8px] md:text-[9px] tracking-[0.2em] uppercase mt-0.5 opacity-95">הנחה</span>
                      <span aria-hidden="true" className="absolute inset-1 rounded-full border border-background/40" />
                    </div>
                    <span className="sr-only">15% הנחה על כל הקולקציה</span>
                  </div>

                  {/* Layered gradient for depth */}
                  <div className="absolute inset-0 bg-gradient-to-t from-foreground/85 via-foreground/25 to-transparent" />
                  <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-accent/15 opacity-0 transition-opacity duration-700 group-hover:opacity-100" />

                  {/* Decorative corner ornaments — gold */}
                  <span aria-hidden="true" className="pointer-events-none absolute top-6 right-6 w-10 h-10 border-t-2 border-r-2 border-accent/70 rounded-tr-lg opacity-0 -translate-y-1 translate-x-1 transition-all duration-700 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />
                  <span aria-hidden="true" className="pointer-events-none absolute top-6 left-6 w-10 h-10 border-t-2 border-l-2 border-accent/70 rounded-tl-lg opacity-0 -translate-y-1 -translate-x-1 transition-all duration-700 group-hover:opacity-100 group-hover:translate-y-0 group-hover:translate-x-0" />

                  {/* Elegant label plaque */}
                  <div className="absolute inset-x-5 bottom-5 md:inset-x-7 md:bottom-7">
                    <div className="relative rounded-2xl bg-background/95 backdrop-blur-xl shadow-[0_12px_40px_-12px_rgba(0,0,0,0.45)] ring-1 ring-accent/25 transition-all duration-700 group-hover:bg-background group-hover:ring-accent/60 group-hover:shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] group-hover:-translate-y-1.5">
                      {/* Inner double-border (luxury frame) */}
                      <span aria-hidden="true" className="absolute inset-[5px] rounded-xl border border-accent/15 transition-colors duration-700 group-hover:border-accent/35" />

                      {/* Gold hairline accents */}
                      <span aria-hidden="true" className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-16 bg-gradient-to-r from-transparent via-accent to-transparent" />
                      <span aria-hidden="true" className="absolute bottom-0 left-1/2 -translate-x-1/2 h-px w-16 bg-gradient-to-r from-transparent via-accent to-transparent" />

                      <div className="relative flex flex-col items-center justify-center gap-2 py-5 px-6 md:py-6 md:px-8">
                        <span className="text-[9px] md:text-[10px] tracking-[0.45em] text-accent uppercase font-medium">
                          קולקציה
                        </span>

                        <div className="flex items-center gap-3 md:gap-3.5 w-full max-w-[180px]" aria-hidden="true">
                          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-accent/50" />
                          <span className="text-accent text-xs md:text-sm tracking-widest">✦</span>
                          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-accent/50" />
                        </div>

                        <span className="font-display text-xl md:text-2xl tracking-wide leading-tight text-center text-foreground transition-colors duration-500 group-hover:text-accent">
                          {c.name}
                        </span>

                        {/* CTA hint that appears on hover */}
                        <span className="overflow-hidden h-0 group-hover:h-5 transition-all duration-500 ease-out">
                          <span className="block text-[10px] md:text-xs tracking-[0.3em] text-muted-foreground uppercase pt-1">
                            לצפייה ←
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* חדש באתר — מוצרים אחרונים */}
      <FeaturedProductsCarousel />

      {/* קטגוריות נוספות */}
      {otherCats.length > 0 && (
        <section className="bg-cream/30">
          <div className="container mx-auto px-4 py-14 md:py-20">
            <div className="text-center mb-10 md:mb-14">
              <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
                <span className="h-px w-10 bg-accent/40" />
                <span className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase">
                  גלו עוד
                </span>
                <span className="h-px w-10 bg-accent/40" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl tracking-wide">
                שאר הקטגוריות
              </h2>
            </div>

            <Carousel dir="rtl" opts={{ direction: "rtl", loop: true, dragFree: true, align: "start" }}>
              <CarouselContent>
                {otherCats.map((c) => (
                  <CarouselItem key={c.slug} className="basis-1/2 sm:basis-1/3 lg:basis-1/5">
                    <Link
                      to="/category/$slug"
                      params={{ slug: c.slug }}
                      className="group/card relative block"
                    >
                      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-card)]">
                        <img
                          src={c.img}
                          alt={c.name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover/card:scale-110"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-foreground/80 via-foreground/20 to-transparent" />
                        <div className="absolute inset-x-0 bottom-0 p-3 md:p-4">
                          <span className="block font-display text-sm md:text-lg tracking-wide text-background text-center leading-tight">
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
          </div>
        </section>
      )}

      {/* Trust badges */}
      <section className="bg-cream/40 border-y border-accent/15">
        <div className="container mx-auto px-4 py-14 md:py-20">
          <div className="text-center mb-10 md:mb-14">
            <div className="flex items-center justify-center gap-3 mb-3" aria-hidden="true">
              <span className="h-px w-10 bg-accent/40" />
              <span className="text-[10px] md:text-xs tracking-[0.35em] text-accent uppercase">
                ההבטחה שלנו
              </span>
              <span className="h-px w-10 bg-accent/40" />
            </div>
            <h2 className="font-display text-2xl md:text-4xl tracking-wide">
              למה לקוחות בוחרים בנו
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 max-w-6xl mx-auto divide-y md:divide-y-0 md:divide-x md:divide-x-reverse divide-accent/20">
            {[
              {
                title: "משלוח מהיר עד הבית",
                desc: "תוך 3–14 ימי עסקים לכל הארץ, באריזה מהודרת ומאובטחת — עם מעקב מלא בכל שלב.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 md:w-12 md:h-12">
                    <path d="M3 7h11v10H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>
                  </svg>
                ),
              },
              {
                title: "איכות ללא פשרות",
                desc: "כל מוצר נבחר בקפידה ונבדק ידנית — עבודת יד של אומנים מנוסים, חומרי גלם מהמעלה הראשונה.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 md:w-12 md:h-12">
                    <path d="M12 2l2.39 4.84L20 7.74l-4 3.9.94 5.5L12 14.77l-4.94 2.37L8 11.64 4 7.74l5.61-.9z"/>
                  </svg>
                ),
              },
              {
                title: "שירות ואחריות מלאה",
                desc: "ליווי אישי לפני ואחרי הרכישה, אחריות מלאה על כל מוצר — אלפי לקוחות מרוצים בכל הארץ.",
                icon: (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" className="w-10 h-10 md:w-12 md:h-12">
                    <path d="M12 22s-8-4.5-8-11a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 6.5-8 11-8 11z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                ),
              },
            ].map((item) => (
              <div
                key={item.title}
                className="group flex flex-col items-center text-center gap-4 md:gap-5 px-6 py-8 md:py-4"
              >
                <div className="text-accent transition-transform duration-500 group-hover:-translate-y-1">
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
        </div>
      </section>

      {/* לקוחות ממליצים — real approved reviews */}
      <HomeReviews />

      {/* SEO text section + FAQ */}
      <section className="bg-background border-y border-accent/10">
        <div className="container mx-auto px-4 py-14 md:py-20 max-w-4xl">
          {/* Visible H1 for SEO — rendered as section header so it doesn't fight page hierarchy */}
          <h1 className="font-display text-3xl md:text-4xl font-bold text-foreground text-center mb-4 tracking-wide">
            אור זרוע לצדיק — חנות תשמישי קדושה ויודאיקה מהודרת
          </h1>
          <p className="text-center text-muted-foreground leading-relaxed mb-4 max-w-2xl mx-auto">
            <strong>אור זרוע לצדיק</strong> היא חנות אונליין ישראלית לתשמישי קדושה ויודאיקה מהודרת — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות ומארזים לחתנים. השם נלקח מהפסוק בתהילים (צ״ז), "אוֹר זָרֻעַ לַצַּדִּיק", ומבטא את רוח החנות: הידור, כשרות ואיכות. אנו מציעים רקמה וחריטה אישית, ומשלוח עד הבית בכל הארץ.
          </p>
          <p className="text-center text-muted-foreground leading-relaxed mb-12 max-w-2xl mx-auto">
            הבעלים: ליאור בן עמי · דרך עכו 190, קרית ביאליק · טל׳ 054-581-8486.
          </p>

          {/* FAQ */}
          <h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8 tracking-wide">
            שאלות נפוצות
          </h2>
          {/* The FAQPage JSON-LD in head() is the SEO carrier (Radix unmounts
              closed panels); defaultValue keeps one answer in the initial DOM. */}
          <Accordion type="single" collapsible defaultValue="faq-0" className="w-full">
            {FAQ_ITEMS.map((item, i) => (
              <AccordionItem key={i} value={`faq-${i}`}>
                <AccordionTrigger className="text-right font-medium">{item.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed">
                  {item.a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Instagram */}
      <section className="bg-background">
        <div className="container mx-auto px-4 py-14 md:py-20">
          <div className="text-center mb-10 md:mb-14">
            <p className="text-[10px] md:text-xs tracking-[0.4em] text-accent uppercase mb-4">
              @ Instagram
            </p>
            <h2 className="font-display italic text-4xl md:text-6xl tracking-wide mb-3 text-foreground">
              עקבו אחרינו
            </h2>
            <div className="flex items-center justify-center gap-3 mb-4" aria-hidden="true">
              <span className="h-px w-8 bg-accent/50" />
              <span className="text-accent text-xs">✦</span>
              <span className="h-px w-8 bg-accent/50" />
            </div>
            <a
              href="https://www.instagram.com/or_zarua_latzadik/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-base md:text-lg text-muted-foreground hover:text-accent transition-colors underline-offset-4 hover:underline"
            >
              @or_zarua_latzadik
            </a>
          </div>

          <InstagramFeed />
        </div>
      </section>
    </>
  );
}

const INSTAGRAM_MEDIA: { type: "video" | "image"; src: string }[] = [
  { type: "video", src: igReel1 },
  { type: "video", src: igReel2 },
  { type: "image", src: igPost1 },
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
      className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
    />
  );
}

function InstagramFeed() {
  return (
    <Carousel dir="rtl" opts={{ direction: "rtl", align: "start" }} className="max-w-6xl mx-auto">
      <CarouselContent>
        {INSTAGRAM_MEDIA.map((m, i) => (
          <CarouselItem key={i} className="basis-2/3 sm:basis-1/3">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`אור זרוע לצדיק באינסטגרם — ${m.type === "video" ? "סרטון" : "תמונה"} ${i + 1}`}
              className="group relative block aspect-[4/5] overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-card)]"
            >
              {m.type === "video" ? (
                <LazyReel src={m.src} />
              ) : (
                <img
                  src={m.src}
                  alt="אור זרוע לצדיק"
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-foreground/0 transition-colors duration-500 group-hover:bg-foreground/20" />
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
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
