import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useMemo } from "react";
import { heroTiles, type HeroTile } from "@/lib/hero-tiles";
import { HERO_SQUARES, HERO_TILE_ART, HERO_TILE_LABELS } from "@/components/home/hero-tile-art";
import { useNavDepartments } from "@/hooks/use-nav-departments";

// The hero's doors: photo squares right in the first screen, replacing the
// button pair AND the two browse sections that used to follow the hero.
//
// A FEW CLEAR SQUARES (owner video, 08.11.2026). The owner first asked for every
// category as a square (27.10.2026); at 36 squares he found them confusing
// ("ממש מבולבלות") and asked for a few, one topic each. HERO_SQUARES lists them
// (featured siddurim + ten), and a "לכל המוצרים" row closes the grid. Labels come
// from the menu map, and a square drops out when the menu does
// (useNavDepartments), so the two never disagree.
//
// Siddurim is the featured square: it spans two rows inside a gold frame, and a
// light sweeps across the cover twice and stops (motion-safe only).
const FEATURED_SLUG = "sidurim";

// A dark chip under the label instead of a gradient over the whole picture,
// so the product stays visible. 0.62 over the palest ground (#F3EDE3) still
// leaves white text above 6:1.
function TileLabel({ label, big }: { label: string; big?: boolean }) {
  return (
    <span
      className={`absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-0.5 rounded-lg bg-[rgba(22,15,4,0.62)] px-1.5 py-1 text-center font-semibold leading-tight text-white ${big ? "text-base sm:text-lg" : "text-[0.8125rem]"}`}
    >
      <span className="line-clamp-2">{label}</span>
      <ChevronLeft className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden="true" />
    </span>
  );
}

function Tile({ tile, eager }: { tile: HeroTile; eager: boolean }) {
  return (
    <Link
      to="/category/$slug"
      params={{ slug: tile.slug }}
      className={`press group relative isolate block aspect-square overflow-hidden rounded-2xl border border-white/40 shadow-[0_14px_30px_-18px_rgba(22,15,4,0.8)] lg:border-gold/50 ${tile.contain ? "bg-[#F3EDE3]" : "bg-[#3b2a17]"}`}
    >
      <img
        src={tile.img}
        alt=""
        width={tile.w}
        height={tile.h}
        // The first rows are in the first screen; the rest of the wall is
        // below the fold on a phone and can wait.
        loading={eager ? undefined : "lazy"}
        decoding="async"
        style={tile.position ? { objectPosition: tile.position } : undefined}
        // A catalogue shot on white is multiplied onto the linen, so the white
        // box disappears and the whole product shows above the label.
        className={`h-full w-full transition-transform duration-500 ease-out [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105 ${tile.contain ? "object-contain p-3 pb-8 mix-blend-multiply" : "object-cover"}`}
      />
      <TileLabel label={tile.name} />
    </Link>
  );
}

export function HeroCategoryTiles() {
  const departments = useNavDepartments();
  const tiles = useMemo(
    () => heroTiles(HERO_SQUARES, departments, HERO_TILE_ART, HERO_TILE_LABELS),
    [departments],
  );
  const featured = tiles.find((t) => t.slug === FEATURED_SLUG);
  const rest = tiles.filter((t) => t.slug !== FEATURED_SLUG);
  return (
    <nav aria-label="כל הקטגוריות" className="w-full">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
        {featured ? (
          <Link
            to="/category/$slug"
            params={{ slug: featured.slug }}
            className="press group relative row-span-2 block overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#E3C995,#C4A074_45%,#8A5A2B_70%,#E3C995)] p-[2px] shadow-[0_18px_40px_-16px_rgba(196,160,116,0.75)]"
          >
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
                className="pointer-events-none absolute inset-y-0 -start-full w-1/2 -skew-x-12 bg-[linear-gradient(90deg,transparent,rgba(255,240,205,0.45),transparent)] motion-safe:[animation:orz-sheen_4.5s_ease-in-out_2]"
              />
              <span className="absolute inset-x-0 top-2 flex justify-center">
                <span className="rounded-full bg-black/55 px-2.5 py-0.5 text-[0.6875rem] font-semibold text-gold-bright backdrop-blur-sm">
                  הטבעת שם
                </span>
              </span>
              <TileLabel label={featured.name} big />
            </span>
          </Link>
        ) : null}

        {rest.map((t) => (
          <Tile key={t.slug} tile={t} eager />
        ))}

        {/* A full row under the squares: the whole catalogue, one tap from the
            first screen. As a row it closes the grid whatever the column count,
            so the squares alone have to fill it: 1 featured (two cells) + 10 =
            12 cells, i.e. 4 rows of 3 on a phone and 3 rows of 4 from sm. */}
        <Link
          to="/shop"
          className="press group col-span-full flex min-h-[3.25rem] items-center justify-center gap-2 rounded-2xl border border-gold/60 bg-[#F3EDE3] px-4 text-center shadow-[0_14px_30px_-18px_rgba(22,15,4,0.8)]"
        >
          <span className="font-display text-lg leading-tight text-foreground sm:text-xl">
            לכל המוצרים בחנות
          </span>
          <ChevronLeft
            className="h-4 w-4 text-accent transition-transform duration-200 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:-translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </nav>
  );
}
