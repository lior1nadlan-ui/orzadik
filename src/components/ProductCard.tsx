import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { formatILS, useCart, getEffectivePrice } from "@/lib/cart";
import { useFavorites } from "@/components/engagement/favorites";
import { ProductThumb } from "@/components/ProductThumb";
import { displayProductName, parseTileAttributes } from "@/lib/display-name";
import {
  isPersonalizableProduct,
  personalizationMethod,
  type PersonalizationMethod,
} from "@/lib/personalization";
import { Heart } from "lucide-react";
import { toast } from "sonner";

// =============================================================================
// THE TILE
// =============================================================================
//
// On a 390x844 phone this renders at 171px wide, two to a row, next to two dozen
// squares that look almost the same and cost almost the same. 66-72% of the
// masters are 500x500 and 45.6% of products have one photograph or none, so the
// picture cannot do the separating and will not be able to in any near future
// where nobody re-shoots 4,648 products. The CAPTION is the photograph. Its job,
// in order, is: which product is this (name), which VERSION of it is this
// (material · colour · size), can I put my name on it, and what does it cost.
//
// Everything below is designed for ABSENCE first, because the data is uneven:
// the attribute tail exists on 51% of products, colour on 45% overall but as low
// as 21% on gviei-kidush, and 7 products deliberately carry no price at all.
// Every optional row renders NOTHING when its fact is missing — never a label
// with an empty value, never an orphan separator, never "₪0".

export type ProductCardData = {
  id: string;
  slug: string;
  name: string;
  price: number;
  sale_price: number | null;
  thumbnail_url: string | null;
  stock_status?: string | null;
  /** How many same-name models this tile stands for. >1 collapses the group. */
  model_count?: number | null;

  // ---- OPTIONAL CAPTION DATA -----------------------------------------------
  // Every field below is optional and every one of them degrades to "render
  // nothing". A loader that does not select the column gets exactly the tile it
  // gets today; a loader that does select it gets a tile that answers "which
  // one". Listed with the column each one wants so wiring a route is a one-word
  // edit to its `.select(...)`:
  //
  //   short_description / description
  //       `select("… , short_description")`. The supplier writes the house spec
  //       tail (' | חומר: … | צבע: … | מידות: … ') into short_description on
  //       2,383 of 4,648 rows; `description` is accepted as a fallback because
  //       a handful of rows carry it there instead. Parsed by
  //       parseTileAttributes — never by this component.
  //
  //   category_slugs
  //       `select("…, product_categories(categories(slug))")` flattened to a
  //       string[], or the RPC's own array column. Drives the personalization
  //       marker through the SAME gate the PDP uses, so a tile can never promise
  //       embroidery the product page then refuses.
  //
  //   model_price_max
  //       The dearest price inside a collapsed same-name group, which only the
  //       collapse step (collapseSameName in src/lib/catalog-order.ts) can know.
  //       Without it a collapsed tile prints a bare number, which is the correct
  //       fail-closed: see the price row below.
  short_description?: string | null;
  description?: string | null;
  category_slugs?: string[] | null;
  model_price_max?: number | null;
};

/**
 * How the personalization marker is worded, per the method the PDP would offer.
 *
 * FREE AND EVERYDAY, never a premium tier. The personalizable cohort's median is
 * ₪159 and 61% of it is under ₪200 — this is "we can put a name on it", not a
 * bespoke service, and any word suggesting an upgrade misprices the shelf in the
 * shopper's head before she has seen a price. So: a plain capability sentence,
 * no "exclusive", no "premium", no price.
 *
 * Kept to <= 19 characters because the caption is 139px wide at 11px.
 */
const PERSONALIZATION_MARKER: Record<PersonalizationMethod, string> = {
  embroidery: "ניתן לרקום שם",
  print: "ניתן להטביע שם",
  both: "ניתן לרקום או לחרוט",
};

export function ProductCard({ p, priority = false, eager, highPriority }: { p: ProductCardData; priority?: boolean; eager?: boolean; highPriority?: boolean }) {
  const { add } = useCart();
  const { has, toggle } = useFavorites();
  const navigate = useNavigate();
  const [added, setAdded] = useState(false);
  // has(id) is false during SSR/first paint and flips after mount — an
  // acceptable unfilled→filled flash, same class as the header cart badge.
  const saved = has(p.id);

  // The name to PRINT. displayProductName strips the supplier's bookkeeping
  // (leading catalogue prefixes, trailing SKUs) and — the one that matters —
  // the string "אין החזרת סחורה", a blanket no-returns claim welded onto 13
  // product NAMES and appearing 46 times in the live /category/kipot HTML. It is
  // both not a product attribute and not true (Israeli law gives 14 days on
  // exactly these non-personalized ₪48-88 stock goods), and it was the last
  // thing a shopper read on the tile. Stripping at render is the code-side
  // mitigation; the rows themselves are an owner fix. See src/lib/display-name.ts
  // for the measurements and for the rule that was deliberately NOT added.
  //
  // Used for the caption, the alt text AND the cart line, so the cleaned name is
  // what the drawer, /cart and the order confirmation all carry — otherwise the
  // claim would reappear one screen later, in the two surfaces that sit directly
  // before card details.
  const displayName = displayProductName(p.name) || p.name;

  // "קטיפה · שחור · 19 ס\"מ", or "קטיפה", or null. The join is built by
  // parseTileAttributes from whatever of the three facts the row actually has,
  // so a shelf with no colour coverage collapses to material (and size) with no
  // dangling separator and no empty slot. Colour runs 84% on kipot but 33-38%
  // across the gift shelves, so the two-fact and one-fact shapes are the common
  // case, not the exception.
  const attributes = parseTileAttributes(p.short_description ?? p.description);

  // The PDP's own gate, imported rather than re-derived, so browse and detail
  // can never disagree about whether a product can carry a name. Silent when the
  // loader did not select category slugs.
  const categorySlugs = p.category_slugs ?? [];
  const personalizable =
    categorySlugs.length > 0 && isPersonalizableProduct(p.slug, categorySlugs);
  const personalizationText = personalizable
    ? PERSONALIZATION_MARKER[personalizationMethod(categorySlugs)]
    : null;

  // `price <= 0` is the catalogue's "call for a price" convention (7 gold-rate
  // products), and it is spelled the same way here as in catalog-order.ts and
  // the two price sorts. Previously `=== 0`, which let a null/NaN price fall
  // through to the priced branch and print "₪NaN".
  const isCallOnly = !(Number(p.price) > 0);
  const isOutOfStock = p.stock_status === "outofstock";
  const effective = getEffectivePrice(p.price);

  // The supplier gives many distinct SKUs the same name. Listings show one tile
  // per name; this says how many real models sit behind it.
  const modelCount = Number(p.model_count ?? 1);
  const hasModels = modelCount > 1;

  // "החל מ-₪24" instead of "₪24", and ONLY when both halves are true: the tile
  // stands for several models AND those models are not all the same price.
  // 185 of the 528 collapsed groups hide a real spread, up to 4.12x, and the
  // representative collapseSameName picks is the cheapest of the illustrated,
  // in-stock members — so the bare number was the group's FLOOR presented as its
  // price. The other 343 groups have no spread, and printing "החל מ-" on them
  // would invent a dearer model that does not exist, which is the same class of
  // lie in the other direction. Absent model_price_max we cannot tell the two
  // apart, so we print the bare number: fail closed, never fail flattering.
  //
  // The ceiling goes through getEffectivePrice too, so the comparison is between
  // two PAID prices — a group whose spread vanishes after the site-wide discount
  // rounds correctly reads as one price, which it is.
  const groupCeiling = Number(p.model_price_max ?? 0);
  const spansPriceRange =
    hasModels && !isCallOnly && groupCeiling > 0 && getEffectivePrice(groupCeiling) > effective;

  return (
    // Glass tile, spelled out rather than composed from `.glass`. DELIBERATE:
    // `.glass` carries `backdrop-filter: blur(16px) saturate(1.25)`, and this
    // component renders 24 tiles per /shop page (+24 per "load more") and up to
    // ~1000 at once on /category/$slug, which would put that many live
    // backdrop-filter layers on the two highest-traffic routes — the compositor
    // re-snapshots and re-blurs every one of them on every scrolled frame.
    // shop.tsx's skeleton block already refuses this for a mere 8 panes. The
    // blur also buys nothing here: the tiles sit on the flat near-white ground
    // plus a very low-alpha fixed mesh, so 72%-white-over-it is visually the
    // same as an opaque fill. So: `bg-card` + the SAME radius token + the SAME
    // three-part glass box-shadow (inset hairline + inner highlight + the wide
    // drop shadow), minus the two backdrop-filter declarations. Opaque white
    // also raises --accent from 5.71:1 to 5.81:1. Restating the vars rather
    // than hard-coding keeps `html.a11y-contrast` working (it repoints
    // --glass-line to #000 and --glass-highlight to transparent).
    // `isolate` restores the stacking context that backdrop-filter used to
    // create, so the z-10 badge/heart stay scoped to their own tile.
    // The hover lift restates the full shadow (inset rings + the LIFT drop
    // shadow) instead of a bare `shadow-*`, which would blow away the rings.
    // Hover is gated to real pointers; movement is additionally motion-safe
    // gated (reduced motion keeps colour/opacity, drops movement).
    // Tailwind v4 emits -translate-y-* to the standalone `translate` property,
    // so `translate` is named in the transition list alongside `transform`.
    <div className="group relative isolate flex flex-col h-full overflow-hidden rounded-[var(--glass-radius)] bg-card shadow-[inset_0_0_0_1px_var(--glass-line),inset_0_1px_0_var(--glass-highlight),var(--glass-shadow)] transition-[transform,translate,box-shadow] duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:shadow-[inset_0_0_0_1px_var(--glass-line),inset_0_1px_0_var(--glass-highlight),var(--glass-shadow-lift)] motion-safe:[@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1">
      {/* The badge slot. It holds ONE thing, and the personalization marker is
          deliberately not a candidate for it — see the caption below. */}
      {isOutOfStock ? (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-muted text-muted-foreground text-micro font-bold px-2.5 py-1 shadow">
          אזל מהמלאי
        </div>
      ) : hasModels ? (
        <div className="absolute top-3 right-3 z-10 rounded-full bg-argaman text-white text-micro font-bold px-2.5 py-1 shadow">
          {modelCount} דגמים
        </div>
      ) : null}

      {/* Favorites heart — a sibling of the image link (not inside it) so a
          click never navigates. Top-left is the one corner free both here
          (badges own the top-right) and on the product page.

          TOUCH: the visible disc is 36px and an INVISIBLE ::before takes the hit
          box to 44x44 (WCAG 2.5.5 / Apple HIG). It was 32px, and this component
          put 24 of those on one live /category page. The disc is not simply made
          44px because at 44 it is 26% of a 171px tile's width and starts reading
          as a control ON the photograph rather than a corner affordance; 36 is
          the largest disc that still reads as a corner. The ::before technique
          and the reasoning behind preferring it to padding are the same ones
          recorded at the two cart steppers (src/routes/cart.tsx). -inset-1 is
          4px on every edge: 36 + 8 = 44 exactly. It reaches into the tile's own
          corner margin, where nothing else is tappable, and stays inside the
          card's overflow-hidden. */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const wasAdded = toggle(p.id);
          if (wasAdded) {
            toast.success("נשמר במועדפים", {
              action: { label: "למועדפים", onClick: () => navigate({ to: "/favorites" }) },
            });
          }
        }}
        aria-pressed={saved}
        aria-label={saved ? "הסר מהמועדפים" : "הוסף למועדפים"}
        // Press + hover written out rather than composed from `.press`: that
        // utility declares `transition-property: transform` and, being emitted
        // after Tailwind's own utilities, it would win over `transition-colors`
        // and make the fill snap. Naming every property keeps both.
        className="absolute top-3 left-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow transition-[background-color,transform,scale] duration-160 ease-out before:absolute before:-inset-1 before:content-[''] [@media(hover:hover)_and_(pointer:fine)]:hover:bg-white motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
      >
        <Heart className={`h-[1.125rem] w-[1.125rem] ${saved ? "fill-accent text-accent" : "text-foreground/60"}`} />
      </button>

      {/* ---- IMAGE ------------------------------------------------------------
          THE ASPECT-RATIO DECISION, WRITTEN DOWN.

          ONE SHAPE ACROSS BROWSE AND DETAIL: aspect-square, object-contain, in
          both places. The PDP gallery is already `aspect-square` +
          `object-contain p-4`; this tile was `aspect-square` + `object-cover`.
          So the two surfaces already agreed about the SHAPE and disagreed about
          the FIT, and the fit is what was visibly wrong: a 175x233 portrait
          master lost 24.9% of its height to the tile's centre-crop and then
          appeared whole on the product page, so the thing a shopper tapped and
          the thing she landed on were different pictures.

          WHY SQUARE, not a portrait tile: 66-72% of the masters ARE 500x500. A
          4:5 tile would letterbox two-thirds of the catalogue to flatter the
          minority, and it would add ~25% to the height of every tile in a grid
          whose first job is to start above 300px and put two complete tiles on
          the first screen.

          WHY CONTAIN, not cover: contain is the only fit that agrees with what
          the server now sends. src/lib/img.ts appends `resize=contain`
          (load-bearing, fixed 2026-08-03) so the transform returns the WHOLE
          photograph; cover then threw part of it away again in CSS. Contain also
          cannot enlarge anything — it scales to fit, which is always <= the
          scale cover used — so this satisfies "do not enlarge product imagery"
          on both surfaces. For the 66-72% of square masters it changes nothing
          at all: contain and cover are identical in a square box.

          NO `p-4` here, unlike the PDP. A 171px tile cannot spend 32px of its
          width on inset, and contain already guarantees the image is inside the
          box.

          THE LETTERBOX BAND: `bg-card` (the tile's own white) when there IS a
          photo, so the bars beside a portrait read as tile rather than as a
          grey band around the product; `bg-muted` when there is not, so the
          "אין תמונה" placeholder still reads as a pane. */}
      <Link
        to="/product/$slug"
        params={{ slug: p.slug }}
        className={`relative aspect-square overflow-hidden block ${p.thumbnail_url ? "bg-card" : "bg-muted"}`}
      >
        <ProductThumb
          url={p.thumbnail_url}
          // Lets a row with no thumbnail_url fall back to a bundled photograph
          // instead of "אין תמונה" — the groom sets are the only such rows.
          slug={p.slug}
          alt={displayName}
          width={400}
          priority={priority}
          eager={eager}
          highPriority={highPriority}
          // 700ms was well over the 300ms UI ceiling. v4 emits scale-* to the
          // standalone `scale` property, so it is named in the transition list.
          className="h-full w-full object-contain transition-[transform,scale] duration-300 ease-out motion-safe:[@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-105"
        />
      </Link>

      {/* ---- CAPTION ----------------------------------------------------------
          name -> attribute line -> personalization -> price -> action.
          `mt-auto` on the action pins every CTA in a row to the same baseline,
          which is what keeps a grid readable when one tile has three caption
          rows and its neighbour has one. */}
      <div className="flex flex-col flex-1 px-4 pt-4 pb-5 text-center">
        <Link
          to="/product/$slug"
          params={{ slug: p.slug }}
          className="font-display text-lead leading-snug text-foreground transition-colors duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:text-accent line-clamp-2 min-h-[2.75em]"
        >
          {displayName}
        </Link>

        {/* The attribute line — the closest thing this catalogue has to a second
            photograph. ONE line, clamped: the longest measured material+colour
            string is 40 characters and the box is 139px, so some of them will
            not fit, and display-name.ts records the deliberate choice that an
            ellipsis is a truncation the reader can SEE, where dropping a fact
            silently is a claim. `title` gives the whole string back on a
            pointer. Renders nothing at all when the row carries no spec tail. */}
        {attributes && (
          <p className="mt-1.5 truncate text-meta text-muted-foreground" title={attributes}>
            {attributes}
          </p>
        )}

        {/* Personalization, in the CAPTION and never in the badge slot: that
            corner already carries "N דגמים" and "אזל מהמלאי", both of which
            change what a tap will do, and a third competing chip on a 171px
            square is the density failure this direction is most at risk of. Here
            it reads as one more fact about the product, at 11px, in the one gold
            that is legal as text (--accent, 5.81:1 on white). The ✦ is the
            house's existing personalization ornament — the same one /cart and
            the mini-cart put in front of a custom line. */}
        {personalizationText && (
          <p className="mt-1 text-micro text-accent">✦ {personalizationText}</p>
        )}

        {isCallOnly ? (
          // FIRST-CLASS, not a fallback. 7 gold-rate products deliberately carry
          // no price and no add-to-cart, and a caption built around a number
          // renders "₪0" on them. So the price slot keeps its position, its
          // spacing and a comparable weight, and simply says what is true. The
          // sentence is the one this tile already used, promoted from a muted
          // aside to the price row; --foreground rather than --accent because it
          // is a statement about pricing, not a price.
          <div className="mt-3">
            <span className="text-body font-semibold leading-snug text-foreground">
              מחיר משתנה לפי שער הזהב
            </span>
          </div>
        ) : (
          <div className="mt-3">
            {/* One text run, one <span>: the prefix is a NESTED inline span, not
                a flex sibling, so "החל מ-" and the amount stay inside a single
                bidi run and UAX#9 resolves them together. The hyphen is ASCII
                U+002D (bidi class ES). An en dash here is class ON and rule N1
                would reverse the number beside it — the bug this repo has
                shipped three times. */}
            <span className="text-lead font-bold text-accent">
              {spansPriceRange && (
                <span className="font-normal text-meta text-muted-foreground">החל מ-</span>
              )}
              {formatILS(effective)}
            </span>
          </div>
        )}

        {/* ---- ACTION -------------------------------------------------------
            `mt-auto pt-4` on the wrapper, not a margin on each branch: auto
            eats the slack so every CTA in a grid row lands on the same
            baseline however many caption rows its tile happened to have, and
            the pt-4 guarantees the old 16px gap survives on the tallest tile in
            the row, where there is no slack left to eat.

            All four branches are 44px tall — min-h, not h, so the control still
            grows under the accessibility widget's font-size zoom. They were
            42px (`py-2.5` around a 14px line): 2px under the touch floor, on the
            one control a tile exists to offer. Links need inline-flex to centre
            a label inside a min-height. */}
        <div className="mt-auto pt-4">
          {isOutOfStock ? (
            <Link
              to="/product/$slug"
              params={{ slug: p.slug }}
              className="w-full inline-flex min-h-[2.75rem] items-center justify-center rounded-full border border-muted-foreground/40 text-muted-foreground text-body text-center transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
            >
              אזל מהמלאי — לפרטים
            </Link>
          ) : isCallOnly ? (
            <Link
              to="/product/$slug"
              params={{ slug: p.slug }}
              className="w-full inline-flex min-h-[2.75rem] items-center justify-center rounded-full bg-accent text-accent-foreground text-body text-center transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
            >
              צרו קשר להזמנה
            </Link>
          ) : hasModels ? (
            // This tile stands for several distinct SKUs. Adding to cart here
            // would silently pick one of them for the shopper, so send them to
            // the product page to choose.
            <Link
              to="/product/$slug"
              params={{ slug: p.slug }}
              className="w-full inline-flex min-h-[2.75rem] items-center justify-center rounded-full bg-accent text-accent-foreground text-body text-center transition-[background-color,transform,scale] duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong motion-safe:active:scale-[0.97] focus-visible:active:scale-100"
            >
              לבחירת דגם
            </Link>
          ) : (
            // NO QUANTITY STEPPER HERE, deliberately. It is the one Open Shelf
            // move with no evidence behind it — the shop has 0 orders, so the
            // case for it is arithmetic rather than observation — and it would
            // be real interactive code on the two highest-traffic routes.
            // Excluded on purpose; this comment is the record so it is not
            // "fixed" later as an oversight.
            <button
              onClick={(e) => {
                e.preventDefault();
                // add() opens the mini-cart drawer as the persistent confirmation
                // (running subtotal + a direct path to checkout), so the old
                // transient toast is gone. The button keeps its brief "נוסף ✓"
                // state, which also debounces a rapid double-add.
                //
                // `displayName`, not p.name: the cleaned string is what the
                // drawer, /cart and the order email then carry.
                add({ productId: p.id, slug: p.slug, name: displayName, price: p.price, salePrice: p.sale_price, thumbnail: p.thumbnail_url });
                setAdded(true);
                window.setTimeout(() => setAdded(false), 1500);
              }}
              disabled={added}
              className={`w-full inline-flex min-h-[2.75rem] items-center justify-center rounded-full border text-body transition-[color,background-color,border-color,transform,scale] duration-160 ease-out motion-safe:active:scale-[0.97] focus-visible:active:scale-100 ${
                added
                  ? "border-foreground bg-foreground text-background"
                  : "border-foreground/80 text-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
              }`}
            >
              {added ? "נוסף ✓" : "הוסף לעגלה"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
