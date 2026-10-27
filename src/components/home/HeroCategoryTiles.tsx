import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import type { CatTile } from "@/components/home/CollectionCard";

// The hero's doors (owner requests, 27.10.2026): every category as a photo
// square, right in the first screen, replacing the button pair AND the two
// browse sections that used to follow the hero ("הקולקציות שלנו" and the
// "שאר הקטגוריות" rail) — the owner did not want the same doors twice.
//
// Siddurim is the featured tile: it spans two rows and carries a slowly
// turning gold frame and a light sweep across the cover. Both animations are
// motion-safe only; a reduced-motion visitor gets the static gold frame.
//
// /category/yehudaika 301s to /shop, so that door links /shop directly rather
// than paying a redirect on every tap.
const FEATURED_SLUG = "sidurim";

function hrefProps(slug: string) {
  return slug === "yehudaika"
    ? ({ to: "/shop" } as const)
    : ({ to: "/category/$slug", params: { slug } } as const);
}

function TileLabel({ label, big }: { label: string; big?: boolean }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(22,15,4,0.85)_0%,rgba(22,15,4,0.35)_45%,transparent_70%)]"
      />
      <span
        className={`absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 px-1.5 pb-2 text-center font-semibold leading-tight text-white ${big ? "text-lg sm:text-xl" : "text-[0.8125rem] sm:text-sm"}`}
      >
        {label}
        <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
      </span>
    </>
  );
}

export function HeroCategoryTiles({ cats }: { cats: CatTile[] }) {
  const featured = cats.find((c) => c.slug === FEATURED_SLUG);
  const rest = cats.filter((c) => c.slug !== FEATURED_SLUG);
  return (
    <nav aria-label="כל הקטגוריות" className="w-full">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 xl:grid-cols-5">
        {featured ? (
          <Link
            {...hrefProps(featured.slug)}
            className="press group relative row-span-2 block overflow-hidden rounded-2xl p-[2px] shadow-[0_18px_40px_-16px_rgba(196,160,116,0.75)]"
          >
            <span
              aria-hidden="true"
              className="absolute -inset-[60%] bg-[conic-gradient(from_0deg,#C4A074,#E3C995,#8A5A2B,#E3C995,#C4A074)] motion-safe:animate-[spin_7s_linear_infinite]"
            />
            <span className="relative block h-full overflow-hidden rounded-[0.9rem]">
              <img
                src={featured.img}
                alt=""
                width={featured.w}
                height={featured.h}
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
              <TileLabel label="סידורים" big />
            </span>
          </Link>
        ) : null}

        {rest.map((c, i) => (
          <Link
            key={c.slug}
            {...hrefProps(c.slug)}
            className="press group relative block aspect-square overflow-hidden rounded-2xl border border-white/40 shadow-[0_14px_30px_-18px_rgba(22,15,4,0.8)] lg:border-gold/50"
          >
            <img
              src={c.img}
              alt=""
              width={c.w}
              height={c.h}
              // The first rows are in the first screen; the rest of the wall
              // is below the fold on a phone and can wait.
              loading={i < 8 ? undefined : "lazy"}
              decoding="async"
              className="h-full w-full object-cover transition-transform duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
            />
            <TileLabel label={c.name} />
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
