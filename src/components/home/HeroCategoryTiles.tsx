import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import imgSiddur from "@/assets/cat-siddur.webp";
import imgTallit from "@/assets/cat-tallit.webp";
import imgChatan from "@/assets/cat-chatan.webp";
import imgChalaka from "@/assets/cat-chalaka.webp";
import imgTallitTefillinCovers from "@/assets/cat-tallit-tefillin-covers.webp";

// The hero's doors (owner request, 27.10.2026): instead of two buttons, the
// shelves themselves as photo squares, so a visitor picks what they came for
// from the first screen. Same curated artwork as "מה תרצו לגלות?" below.
//
// Siddurim is the featured tile: it spans two rows and carries a slowly
// turning gold frame and a light sweep across the cover. Both animations are
// motion-safe only; a reduced-motion visitor gets the static gold frame.
type Tile = { slug: string; label: string; img: string };

const SIDDUR: Tile = { slug: "sidurim", label: "סידורים", img: imgSiddur };

const TILES: Tile[] = [
  { slug: "talitot", label: "טליתות", img: imgTallit },
  { slug: "chatan-kala", label: "חתן וכלה", img: imgChatan },
  { slug: "talit-tefillin-covers", label: "כיסויי טלית ותפילין", img: imgTallitTefillinCovers },
  { slug: "chalaka-set", label: "סט חלאקה", img: imgChalaka },
];

const TILE_CLS =
  "press group relative block overflow-hidden rounded-2xl border border-white/40 shadow-[0_14px_30px_-18px_rgba(22,15,4,0.8)] lg:border-gold/50";

function TileLabel({ label, big }: { label: string; big?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(22,15,4,0.85)_0%,rgba(22,15,4,0.35)_45%,transparent_70%)]"
      />
      <span
        className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 px-1.5 pb-2 text-center font-semibold leading-tight text-white ${big ? "text-lg sm:text-xl" : "text-[0.8125rem] sm:text-base"}`}
      >
        {label}
        <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
      </span>
    </>
  );
}

export function HeroCategoryTiles() {
  return (
    <nav aria-label="קטגוריות מובילות" className="w-full">
      <div className="grid grid-cols-3 grid-rows-2 gap-2 sm:gap-3">
        {/* Featured: siddurim, two rows tall, in a turning gold frame. */}
        <Link
          to="/category/$slug"
          params={{ slug: SIDDUR.slug }}
          className="press group relative row-span-2 block overflow-hidden rounded-2xl p-[2px] shadow-[0_18px_40px_-16px_rgba(196,160,116,0.75)]"
        >
          <span
            aria-hidden="true"
            className="absolute -inset-[60%] bg-[conic-gradient(from_0deg,#C4A074,#E3C995,#8A5A2B,#E3C995,#C4A074)] motion-safe:animate-[spin_7s_linear_infinite]"
          />
          <span className="relative block h-full overflow-hidden rounded-[0.9rem]">
            <img
              src={SIDDUR.img}
              alt=""
              width={800}
              height={800}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 -start-full w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,240,205,0.45),transparent)] motion-safe:animate-[orz-sheen_4.5s_ease-in-out_infinite]"
            />
            <span className="absolute inset-x-0 top-2 flex justify-center">
              <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-gold-bright backdrop-blur-sm">
                הטבעת שם
              </span>
            </span>
            <TileLabel label={SIDDUR.label} big />
          </span>
        </Link>

        {TILES.map((t) => (
          <Link
            key={t.slug}
            to="/category/$slug"
            params={{ slug: t.slug }}
            className={`${TILE_CLS} aspect-square`}
          >
            <img
              src={t.img}
              alt=""
              width={800}
              height={1000}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
            />
            <TileLabel label={t.label} />
          </Link>
        ))}
      </div>
      <Link
        to="/shop"
        className="mt-3 inline-flex min-h-11 items-center gap-1 text-base font-semibold text-white underline-offset-4 [@media(hover:hover)_and_(pointer:fine)]:hover:underline lg:text-accent"
      >
        לכל המוצרים בחנות
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
    </nav>
  );
}
