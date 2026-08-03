import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { useEffect, useRef, useState } from "react";
import { trackSearch } from "@/lib/analytics";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ProductGridSkeleton } from "@/components/Skeletons";
import { QueryErrorState } from "@/components/QueryErrorState";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
import { BUSINESS } from "@/lib/business";

// "recommended" is the default. It used to be "newest", but 4,184 of the 4,641
// active products were bulk-imported inside a single minute, so created_at
// carries no signal and the RPC's ORDER BY fell through to the id tiebreak —
// /shop was effectively presenting the catalog in random UUID order. The
// 'recommended' branch (see the list_products_collapsed migration) sorts by
// in-stock → has photo → has copy → price, which is also what /category has
// always meant by "מומלץ", so the two discovery pages finally agree.
type ShopSort = "recommended" | "newest" | "price-asc" | "price-desc" | "name";

function isShopSort(v: unknown): v is ShopSort {
  return v === "recommended" || v === "newest" || v === "price-asc"
    || v === "price-desc" || v === "name";
}

// Fetch a page at a time rather than the whole catalog. This used to pull a
// flat .limit(500) and slice it client-side, which capped /shop at 500 of the
// 4,672 products and made the header report "500 מוצרים". Paging server-side
// keeps the DOM light *and* reachable across the full catalog.
const PAGE = 24;
// The clamp keeps a hand-typed or crawler-invented ?page=999999 from turning into
// an absurd DB offset (999,998 * 24 ≈ 24 million rows to skip). It is a floodgate,
// NOT the end-of-catalog check: the real listing is 3,540 collapsed rows ≈ 148
// pages, so a clamped ?page= still lands well past the end. The loader's
// out-of-range redirect below is what sends it back to the last real page.
const MAX_PAGE = 500;

const SITE = "https://orzadik.com";

// ?page=N is the crawlable half of the listing: infinite scroll alone leaves
// everything past the first 24 products unreachable by URL. Page 1 is
// represented as `undefined` so the canonical /shop URL stays parameter-free.
function parsePage(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return undefined;
  const i = Math.floor(n);
  if (i <= 1) return undefined;
  return Math.min(i, MAX_PAGE);
}

// Escape PostgREST `.or()` reserved characters in user input so a search term
// can never inject additional filter clauses, then map the whole quote family
// (ASCII quotes, geresh/gershayim, curly quotes) to an ilike `%` wildcard so a
// typed ס"מ matches the DB's ס״מ and vice versa. The injected % is safe: it is
// only ever used as a filter VALUE (supabase-js URL-encodes it) — clause
// injection needs `,` or `()`, which are stripped first, along with any
// user-typed % or \.
export function sanitizeTerm(raw: string): string {
  return raw
    .replace(/[,()%\\]/g, " ")    // strip clause-injection + user-typed % first
    .replace(/["'`׳״‘’“”]/g, "%") // quote family → wildcard
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Fold Hebrew spelling variants that the catalogue does not contain into the
 * ones it does, BEFORE the term reaches list_products_collapsed.
 *
 * The search backend is already good at Hebrew MORPHOLOGY — he_variants()
 * expands plurals to singular stems, which is what the 20260730 migration was
 * for. What it cannot bridge is ORTHOGRAPHY: כתיב חסר and כתיב מלא are both in
 * everyday Israeli use, the supplier wrote the catalogue in one of them, and
 * trigram similarity does not span a missing ו. Measured live on the RPC
 * 2026-08-03 (result-set sizes, and set-difference against the rewritten term):
 *
 *     בר מצוה     8   →  בר מצווה   105   (loses 1: an unrelated fuzzy hit)
 *     בת מצוה     6   →  בת מצווה    43   (loses 1: the same fuzzy hit)
 *     מצוה        8   →  מצווה      122   (loses 1)
 *     סדור        3   →  סידור      110   (loses 2: "סדר קידוש" ברכונים)
 *     סדורים      1   →  סידורים     81   (loses 0)
 *     בר-מצווה    3   →  בר מצווה   105   (loses 0 — pure maqaf damage)
 *     חנוכיה    111   →  חנוכיות    119   (loses 0)
 *
 * bar mitzvah is the highest-intent query in Judaica and it was returning 8
 * results out of 105 for half the country's spelling of it.
 *
 * WHY חנוכיה MAPS TO A PLURAL AND NOT TO חנוכייה. Both spellings genuinely
 * occur in the product names (the he_variants migration says so in as many
 * words), so rewriting one singular to the other TRADES results instead of
 * adding them — measured, חנוכייה→חנוכיות gains 4 and loses 3. The plural is
 * the one form the DB function already expands to BOTH spellings, so routing
 * the singular through it is strictly additive and uses the mechanism that is
 * already deployed rather than inventing a second one. חנוכייה is left alone:
 * at 118 results it is not broken, and rewriting it is a net wash.
 *
 * DELIBERATELY NOT a general plural→singular rewrite. ברכונים (52) → ברכון (89)
 * would look like a win, but that gap is the documented, intentional cost of
 * matching variants against name_norm instead of search_blob — undoing it here
 * would silently reverse a migration-level decision from the wrong layer.
 *
 * Applied to the RPC path AND the ILIKE fallback, so a search cannot mean two
 * different things depending on whether the search function is available.
 *
 * ⚠️ The header's search dropdown (SiteHeader.tsx) calls the same RPC with its
 * own raw `debounced` term and so does NOT get this treatment — its preview
 * will still under-report for these spellings until it routes through here.
 * That file was outside this change's scope; the export exists for it.
 */
const HE_SPELLING_SYNONYMS: Record<string, string> = {
  // כתיב חסר → כתיב מלא, as the catalogue spells it.
  מצוה: "מצווה",
  סדור: "סידור",
  סדורים: "סידורים", // measured 1 → 81
  // Singular ־יה → the plural the DB expands to BOTH spellings (see above).
  חנוכיה: "חנוכיות",
};

// ⚠️ DO NOT add מצות → מצוות here, however tempting the symmetry looks. It is
// the one word in this family that is genuinely ambiguous, and the catalogue
// uses it in the OTHER sense: measured live, מצות returns 38 rows led by
// "קופסת פח למצות" and "כיסוי מצות" — Passover matzah goods — while מצוות
// returns 44 rows led by "ספר ראשית מצוות הסידור הראשון שלי", a children's
// book. Folding them would take a Passover shopper off matzah tins and onto
// mitzvah books. Every other entry above was checked for exactly this and has
// no second meaning in a Judaica catalogue.

export function normalizeSearchTerm(raw: string): string {
  return raw
    // Maqaf / hyphen / dash between letters → a space. The RPC splits the term
    // on spaces and bool_ands the words, so "בר-מצווה" arrives as ONE token and
    // matched 3 rows; as two tokens it matches 105. Any dash the shopper types
    // is a word separator here, never part of a Hebrew word.
    .replace(/[-‐-―־]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((w) => HE_SPELLING_SYNONYMS[w] ?? w)
    .join(" ");
}

type ShopPageData = { rows: ProductCardData[]; total: number; next: number };

// Single source of truth for a page of /shop results, shared by the SSR route
// loader and the client-side infinite query so both produce byte-identical
// pages (same filter, same order, same size).
async function fetchShopPage(opts: {
  rawQ: string;
  sort: ShopSort;
  offset: number;
}): Promise<ShopPageData> {
  const { rawQ, sort, offset } = opts;
  // Spelling normalisation runs FIRST, so both search paths below (the RPC and
  // the ILIKE fallback) look for the same words — see normalizeSearchTerm.
  const normalizedQ = normalizeSearchTerm(rawQ);
  const term = sanitizeTerm(normalizedQ);

  // "recommended" is the right default for BROWSING, but it must not survive a
  // search term. Its ordering is in-stock → has-photo → has-copy → price DESC, and
  // since every active product is in stock and has a thumbnail, the first keys are
  // constant and PRICE decides. The effect on a real query was severe: /shop?q=כיפה
  // returned four ₪2,000 groom boxes, then talitot, then velvet sets — the first
  // actual kippah was result #9 of 688, in a store whose largest category is 743
  // kippot. The RPC's relevance ranking (name_norm LIKE, word_similarity) was dead
  // code for every default search.
  //
  // The header's search dropdown already sends "relevance" to this same RPC, so the
  // two disagreed with each other: the preview was ranked and the results page was
  // not. An explicit user sort still wins — this only replaces the default.
  const rpcSort = rawQ.trim() && sort === "recommended" ? "relevance" : sort;

  // Preferred path: the pg_trgm hybrid RPC. It is word-order independent,
  // folds gershayim/nikud, and tolerates a one-letter typo — none of which
  // the ILIKE fallback below can do. Parameters are bound, so the raw term
  // goes in unsanitized (sanitizeTerm exists for the ILIKE path only, where
  // the term is interpolated into a PostgREST filter string).
  // Preferred path for BOTH browse and search: list_products_collapsed. On top
  // of the trgm search it returns one row per name group with model_count, so
  // the 527 supplier name-collisions (1,630 products) render as one tile each
  // instead of 43 identical-looking ones. Collapsing must happen in the DB —
  // doing it on a fetched page would turn 24 tiles into 3 and break the count
  // and "load more".
  {
    const { data: rpcRows, error: rpcErr } = await supabase.rpc("list_products_collapsed", {
      p_term: normalizedQ.slice(0, 100),
      p_limit: PAGE,
      p_offset: offset,
      p_sort: rpcSort,
    });
    if (!rpcErr) {
      const rows = (rpcRows ?? []) as Array<ProductCardData & { total_count: number }>;
      return {
        rows: rows as ProductCardData[],
        total: Number(rows[0]?.total_count ?? 0),
        next: offset + PAGE,
      };
    }
    // Never fail the page on a search-backend problem: log it and drop through
    // to the plain query below, which needs no server-side function (it does
    // not collapse — correctness of the listing beats tidiness of it).
    console.warn("[shop] list_products_collapsed unavailable, using fallback:", rpcErr);
  }

  let query = supabase
    .from("products")
    .select("id, slug, name, price, sale_price, thumbnail_url, stock_status", { count: "exact" })
    .eq("is_active", true);

  // Server-side (DB) search across the whole catalog — name, both
  // description fields and SKU — not just the names already loaded.
  if (term) {
    const words = term.split(" ").filter(Boolean);
    const fields = ["name", "description", "short_description", "sku"];
    if (words.length > 1) {
      // Multi-word queries: every word must appear in the SAME field
      // (order-independent) — per-field and() groups nested inside or().
      const groups = fields.map(
        (f) => `and(${words.map((w) => `${f}.ilike.%${w}%`).join(",")})`,
      );
      query = query.or(groups.join(","));
    } else {
      const like = `%${term}%`;
      query = query.or(fields.map((f) => `${f}.ilike.${like}`).join(","));
    }
  }

  // Server-side ordering — the page is fetched 24 rows at a time via
  // .range(), so the DB must produce the order; client-side sorting can
  // only ever see the pages already loaded. Ordering by the raw `price`
  // column matches what users see: the displayed selling price is
  // getEffectivePrice(price), a monotonic transform of price.
  if (sort === "price-asc") query = query.order("price", { ascending: true });
  else if (sort === "price-desc") query = query.order("price", { ascending: false });
  else if (sort === "name") query = query.order("name", { ascending: true });
  else if (sort === "newest") query = query.order("created_at", { ascending: false });
  // "recommended" fallback. PostgREST cannot order by the computed in-stock /
  // has-photo booleans the RPC uses, so approximate with price DESC — the same
  // final term, and still far better than created_at, which is one timestamp
  // for 90% of the catalog and therefore no order at all.
  else query = query.order("price", { ascending: false });

  const { data, error, count } = await query
    // Deterministic tiebreaker: thousands of rows share identical prices,
    // and .range() paging needs a total order to avoid dupes/gaps.
    .order("id", { ascending: true })
    .range(offset, offset + PAGE - 1);
  if (error) throw error;
  return { rows: (data ?? []) as ProductCardData[], total: count ?? 0, next: offset + PAGE };
}

export const Route = createFileRoute("/shop")({
  component: ShopPage,
  validateSearch: (s: Record<string, unknown>): { q?: string; sort?: ShopSort; page?: number; instock?: boolean } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    // Unknown values narrow to undefined and render as the default ("recommended").
    sort: isShopSort(s.sort) ? s.sort : undefined,
    page: parsePage(s.page),
    // Client-side view filter only (see displayProducts) — deliberately kept OUT
    // of loaderDeps, so toggling it never re-runs the SSR loader or refetches.
    instock: s.instock === true || s.instock === "true" ? true : undefined,
  }),
  loaderDeps: ({ search }) => ({
    q: search.q ?? "",
    sort: search.sort ?? ("recommended" as ShopSort),
    page: search.page ?? 1,
  }),
  // Server-render the first (or requested) page. Without this the route emitted
  // nothing but a skeleton grid, so the non-JS crawlers robots.txt explicitly
  // welcomes saw zero product links on a page advertised at sitemap priority 0.9.
  loader: async ({ deps, location }) => {
    const offset = (deps.page - 1) * PAGE;
    // A search term or a non-default sort makes the URL a facet of /shop, not a
    // page of it: those views stay canonical to the bare /shop (unchanged from
    // before) and get no rel=prev/next, which would otherwise point at the
    // unfiltered page 2.
    const filtered = deps.q.trim().length > 0 || deps.sort !== "recommended";
    let first: ShopPageData;
    try {
      first = await fetchShopPage({ rawQ: deps.q, sort: deps.sort, offset });
    } catch (err) {
      // Degrade to the client-side query + its existing retry UI rather than
      // blowing the whole route into the error boundary on a transient DB blip.
      // The fetch is awaited HERE rather than inline in the return below so the
      // out-of-range branch that follows sits outside this catch — a thrown
      // redirect must never be swallowed and turned into "first: null".
      console.warn("[shop] loader failed, falling back to client fetch:", err);
      return { page: deps.page, offset, filtered, q: deps.q, first: null as ShopPageData | null };
    }

    // Past the end of the listing. The collapsed catalog is 3,540 rows, so page 148
    // is the last real one; every page from 149 to MAX_PAGE used to answer HTTP 200
    // with zero products, "index, follow" and a rel=canonical pointing at itself —
    // 352 crawlable soft-404s, advertised by the rel=next chain and reached from
    // ?page=999999 by the MAX_PAGE clamp's own 307. The body read the
    // self-contradicting "עמוד 195 מתוך 1" for anyone who hand-edited the number.
    //
    // Redirect rather than notFound(): the last page is not a fixed address, it
    // moves with the catalog (this route has already seen 4,672 / 4,641 / 4,648
    // products), so a 404 would harden a boundary that shifts on the next supplier
    // import — and it would leave a shopper who edited ?page= on a dead end instead
    // of on products. 302 rather than 301 for the same reason: a permanent redirect
    // is cached by browsers and proxies long after page 149 becomes real, while a
    // temporary one still drops the empty URL from the index in favour of the
    // target and is re-checked on every crawl.
    if (deps.page > 1 && first.rows.length === 0) {
      // The empty response carries no total — total_count rides on row 0 of the
      // RPC result — so re-probe offset 0 to learn where the listing actually ends.
      // The extra round trip only ever runs on a page that had nothing to show.
      let lastPage = 1;
      try {
        const probe = await fetchShopPage({ rawQ: deps.q, sort: deps.sort, offset: 0 });
        lastPage = Math.max(1, Math.ceil(probe.total / PAGE));
      } catch (err) {
        console.warn("[shop] out-of-range probe failed, redirecting to page 1:", err);
      }
      // Loop-breaker: we already know deps.page is empty, so the target must be
      // strictly below it. Without this, a total that disagreed between the two
      // calls could redirect a page to itself forever.
      const target = lastPage < deps.page ? lastPage : 1;
      throw redirect({
        to: "/shop",
        search: {
          q: deps.q.trim() || undefined,
          sort: deps.sort === "recommended" ? undefined : deps.sort,
          page: target > 1 ? target : undefined,
          // instock is a client-side view filter and is deliberately kept out of
          // loaderDeps, so read it off the location — otherwise the redirect would
          // silently clear the shopper's "במלאי בלבד" checkbox.
          instock: (location.search as { instock?: boolean }).instock ? true : undefined,
        },
        statusCode: 302,
      });
    }

    return {
      page: deps.page,
      offset,
      filtered,
      // Echoed for head() so the doc title can reflect an active search term.
      q: deps.q,
      first,
    };
  },
  head: ({ loaderData }) => {
    const page = loaderData?.page ?? 1;
    const offset = loaderData?.offset ?? 0;
    const filtered = loaderData?.filtered ?? false;
    const rows = loaderData?.first?.rows ?? [];
    const total = loaderData?.first?.total ?? 0;
    const lastPage = Math.max(1, Math.ceil(total / PAGE));
    const paged = !filtered;
    // Braces to the loader redirect's belt. The redirect cannot fire when the DB
    // fetch itself failed (first === null → rows is []), and that degraded SSR
    // response has no products in it either. Whatever produced an empty page past
    // page 1, it is never worth indexing and must not claim itself as canonical —
    // that combination is exactly what made ?page=149-500 soft-404s.
    const emptyPastFirst = page > 1 && rows.length === 0;

    // A ?q= search is a facet of /shop, so its title reflects the term. The
    // canonical still points at the bare /shop below (paged is false when
    // filtered), so this affects the SERP/tab title only, not indexing.
    const searchTerm = (loaderData?.q ?? "").trim();
    const title = searchTerm
      ? `תוצאות עבור "${searchTerm}" | אור זרוע לצדיק`
      : page > 1
        ? `כל המוצרים — עמוד ${page} | אור זרוע לצדיק`
        : "כל המוצרים | אור זרוע לצדיק";
    // Page 1 keeps the bare /shop canonical; deeper pages are canonical to
    // themselves so their products are indexable in their own right.
    //
    // An empty page past page 1 stays SELF-canonical rather than pointing at
    // /shop, even though it is the one case we do not want indexed. Pairing
    // `noindex` (emitted below) with a canonical to a DIFFERENT URL is the one
    // combination Google explicitly warns about: the two are contradictory, and
    // the documented failure mode is that the noindex is applied to the
    // canonical TARGET — which here would be /shop, the listing's own root. A
    // self-canonical keeps the noindex scoped to the degraded URL that earned it.
    const canonical =
      paged && page > 1 ? `${SITE}/shop?page=${page}` : `${SITE}/shop`;

    const itemListLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: title,
      numberOfItems: rows.length,
      itemListElement: rows.map((p, i) => ({
        "@type": "ListItem",
        position: offset + i + 1,
        url: `${SITE}/product/${p.slug}`,
        name: p.name,
      })),
    };
    const breadcrumbLd = {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "בית", item: `${SITE}/` },
        // "מוצרים" — matches the visible trail below and the /shop node label the
        // category route already emits, so one URL isn't named two ways.
        { "@type": "ListItem", position: 2, name: "מוצרים", item: `${SITE}/shop` },
      ],
    };

    return {
      meta: [
        { title },
        // "follow", not "nofollow": the page is empty but its prev link is still a
        // legitimate route back into the catalog. Meta is merged leaf→root with
        // first-seen winning (see __root.tsx), so this overrides the site-wide
        // "index, follow".
        ...(emptyPastFirst ? [{ name: "robots", content: "noindex, follow" }] : []),
        { name: "description", content: "כל מוצרי תשמישי הקדושה והיודאיקה של אור זרוע לצדיק — טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות, פמוטים ומארזים לחתנים. נבחרים בהקפדה על כשרות והידור, עם משלוח עד הבית." },
        { property: "og:title", content: title },
        { property: "og:description", content: "טליתות, כיסויי טלית ותפילין, נרתיקי מזוזה, גביעי קידוש, חנוכיות ומארזים לחתנים — כל המוצרים במקום אחד." },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: "כל מוצרי תשמישי הקדושה והיודאיקה במקום אחד." },
      ],
      links: [
        { rel: "canonical", href: canonical },
        // An empty page is not a member of the prev/next chain — advertising one
        // is what invited crawlers into the dead zone in the first place.
        ...(paged && !emptyPastFirst && page > 1 ? [{ rel: "prev", href: page - 1 > 1 ? `${SITE}/shop?page=${page - 1}` : `${SITE}/shop` }] : []),
        ...(paged && !emptyPastFirst && page < lastPage ? [{ rel: "next", href: `${SITE}/shop?page=${page + 1}` }] : []),
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(itemListLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
});

function ShopPage() {
  const { q: qFromUrl, sort: sortFromUrl, page: pageFromUrl, instock: instockFromUrl } = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(qFromUrl || "");
  const [debouncedQ, setDebouncedQ] = useState(qFromUrl || "");
  // "In stock only" is a client-side view filter over the loaded pages, seeded
  // from the URL so it survives reload/share (mirrors /category's instock).
  const [inStockOnly, setInStockOnly] = useState(instockFromUrl ?? false);
  // Sort is read straight off the URL (not mirrored into state) so the route
  // loader, the head tags and the query key can never disagree about it.
  const sort: ShopSort = sortFromUrl ?? "recommended";

  // Keep the box and the effective term in step with the URL, including
  // back/forward and the pagination links below.
  useEffect(() => {
    setQ(qFromUrl || "");
    setDebouncedQ(qFromUrl || "");
  }, [qFromUrl]);

  // Keep the checkbox in step with the URL on back/forward.
  useEffect(() => {
    setInStockOnly(instockFromUrl ?? false);
  }, [instockFromUrl]);

  const changeSort = (v: ShopSort) => {
    navigate({
      // A different order means a different page 1 — drop ?page= so the user
      // does not land mid-catalog after re-sorting.
      search: (prev) => ({ ...prev, sort: v === "recommended" ? undefined : v, page: undefined }),
      replace: true,
      resetScroll: false,
    });
  };

  const changeInStockOnly = (v: boolean) => {
    setInStockOnly(v);
    navigate({
      search: (prev) => ({ ...prev, instock: v ? true : undefined }),
      replace: true,
      resetScroll: false,
    });
  };

  // Clear the active search: reset the box + debounced term, and drop ?q= (and
  // ?page=, which belonged to that search) from the URL when present.
  const clearSearch = () => {
    setQ("");
    setDebouncedQ("");
    if ((qFromUrl ?? "").trim()) {
      navigate({
        search: (prev) => ({ ...prev, q: undefined, page: undefined }),
        replace: true,
        resetScroll: false,
      });
    }
  };

  // Debounce keystrokes so we hit the DB at most a few times per search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const urlQ = (qFromUrl ?? "").trim();
    // Push the debounced term INTO the url. Without this the search box filtered the
  // list but never touched the URL, so the <h1> and <title> — which read the URL —
  // said "כל המוצרים" while the page showed "111 תוצאות עבור …", and reload,
  // bookmark, share and Back all silently discarded the search. Guarded on
  // inequality so it cannot ping-pong with the url→state effect above.
  useEffect(() => {
    const inUrl = (qFromUrl || "").trim();
    const typed = debouncedQ.trim();
    if (typed === inUrl) return;
    navigate({
      search: (prev) => ({ ...prev, q: typed || undefined, page: undefined }),
      replace: true,
      resetScroll: false,
    });
  }, [debouncedQ]);

const activeQ = debouncedQ.trim();
  const term = sanitizeTerm(debouncedQ);
  // While the user is typing a term that is not (yet) in the URL, the ?page=
  // offset belongs to a different result set — restart that search at page 1.
  const seededFromUrl = activeQ === urlQ;
  const page = seededFromUrl ? (pageFromUrl ?? 1) : 1;
  const pageStart = (page - 1) * PAGE;

  const {
    data, isLoading, isFetching, isError, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["shop-products", term, sort, pageStart],
    placeholderData: keepPreviousData,
    initialPageParam: pageStart,
    queryFn: ({ pageParam }) => fetchShopPage({ rawQ: debouncedQ, sort, offset: pageParam }),
    getNextPageParam: (last) => (last.next < last.total ? last.next : undefined),
    // Hand the SSR loader's page to react-query so the server HTML and the
    // hydrated app render the same 24 cards with no extra round-trip. Returns
    // undefined (→ normal client fetch) as soon as the live term/page drifts
    // from what the loader was asked for.
    initialData: () =>
      seededFromUrl && loaderData.first
        ? { pages: [loaderData.first], pageParams: [pageStart] }
        : undefined,
  });

  const products = data?.pages.flatMap((p) => p.rows) ?? [];
  // Client-side "in stock only" view filter. /shop is server-paged — the
  // collapse RPC hands back 24 rows at a time with its own total and takes no
  // stock argument — so this can only hide out-of-stock tiles from the pages
  // already loaded. The catalog total and the load-more math below stay keyed
  // off the unfiltered server result on purpose.
  const displayProducts = inStockOnly
    ? products.filter((p) => p.stock_status !== "outofstock")
    : products;
  // Total across the whole result set, not just what has been loaded.
  const total = data?.pages[0]?.total ?? 0;
  // Echo the user's raw input in copy — the sanitized term may contain
  // injected % wildcards that should never be shown.
  const rawTerm = debouncedQ.trim();

  // Report the search to analytics once the results for a term have SETTLED —
  // including a zero-result term (the highest-signal input: unmet demand or a
  // naming gap). activeQ already tracks the debounced box, so this is debounced;
  // the ref keys on term::total so it fires once per settled result set and not
  // on unrelated re-renders (e.g. the in-stock view toggle).
  const lastTrackedSearchRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activeQ) {
      lastTrackedSearchRef.current = null;
      return;
    }
    if (isLoading || isFetching) return; // wait for the query to settle
    const key = `${activeQ}::${total}`;
    if (lastTrackedSearchRef.current === key) return;
    lastTrackedSearchRef.current = key;
    trackSearch(activeQ, total);
  }, [activeQ, total, isLoading, isFetching]);

  // The denominator can never sit below the page being displayed. `total` is 0
  // while the client query is still in flight AND whenever the SSR loader had to
  // degrade to a client fetch, so the old Math.max(1, ceil(0 / 24)) rendered the
  // self-contradicting "עמוד 195 מתוך 1" that /shop?page=195 served live. The
  // loader now 302s out-of-range pages away before they can render; this keeps the
  // sentence honest on every other path that reaches it with an unknown total.
  const lastPage = Math.max(1, Math.ceil(total / PAGE), page);
  // "Next" skips past everything already rendered, so a visitor who pressed
  // "load more" twice does not get a link back to products they can see.
  const nextPage = Math.min(MAX_PAGE, Math.floor((pageStart + products.length) / PAGE) + 1);
  const hasMorePages = pageStart + products.length < total;
  const pageSearch = (n: number): { q?: string; sort?: ShopSort; page?: number; instock?: boolean } => ({
    q: activeQ || undefined,
    sort: sort === "recommended" ? undefined : sort,
    page: n <= 1 ? undefined : n,
    instock: inStockOnly ? true : undefined,
  });
  // Glass-era pagination chip. No gold anywhere on /shop by design — this page
  // scores Lighthouse Accessibility 100 precisely because it contains none, and
  // gold-on-glass is the easiest way to lose that. Ink-on-white only: the resting
  // chip is foreground on a 70% white pane (~17:1), the hover swap is
  // background-on-foreground (16.7:1). The hairline is an inset ring, so it adds
  // no layout size and cannot shift the row the way the old 1px border did.
  const pageLinkClass =
    "press rounded-full bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background";

  return (
    <div className="container mx-auto px-4 py-10">
      {/* Location trail + title band. Note the pagination-chip comment further
          down: /shop is deliberately gold-free (it scores Lighthouse A11y 100
          for it), so this is a plain ink title band, NOT the gold-ruled
          PageHeader the rest of the site adopts — and the toolbar's own h1 is
          retired in favour of this single one. */}
      <Breadcrumb items={[{ label: "בית", to: "/" }, { label: "מוצרים" }]} />
      <div className="mt-4 mb-8 text-center">
        {/* Query-aware heading: an active ?q= search reads as a results page,
            matching the doc title in head(); the bare /shop keeps its catalog
            heading. Uses the URL term (urlQ), so the H1 agrees with the SSR
            head/canonical on first paint. */}
        <h1 className="font-display text-3xl md:text-4xl tracking-wide text-foreground">
          {urlQ ? <>תוצאות עבור "{urlQ}"</> : "כל המוצרים"}
        </h1>
        <p className="mt-3 text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
          {urlQ
            ? "המוצרים התואמים את החיפוש שלכם."
            : "כל תשמישי הקדושה והיודאיקה של אור זרוע לצדיק במקום אחד."}
        </p>
      </div>

      {/* Toolbar as a single glass pane over the light ground. .glass owns
          background-color, border-radius and box-shadow (see the override
          contract in styles.css) — retune it through its variables, not through
          background or radius utilities, which it outranks. Controls mirror
          /category: result count, then search + 'במלאי בלבד' + sort. */}
      <div className="glass mb-8 flex flex-wrap items-center justify-between gap-4 p-5 md:p-6 [--glass-radius:1.25rem]">
        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {term ? `${total} תוצאות עבור "${rawTerm}"` : `${total} מוצרים`}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          {/* A real <form>: without one the input had no ancestor form, so pressing
              Enter did nothing at all. Submitting commits the term immediately
              instead of waiting out the 300ms debounce. */}
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              setDebouncedQ(q);
            }}
          >
            <Input
              placeholder="חיפוש מוצר..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="חיפוש מוצר בקטלוג"
              className="max-w-xs"
            />
          </form>
          {/* Default (ink --primary) checkbox — no accent override, so /shop
              stays gold-free. */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={inStockOnly}
              onCheckedChange={(v) => changeInStockOnly(!!v)}
              aria-label="הצגת מוצרים במלאי בלבד"
            />
            במלאי בלבד
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">מיון:</span>
            <Select value={sort} onValueChange={(v) => changeSort(v as ShopSort)}>
              {/* Radix renders a <button role="combobox"> whose only content is
                  the current value, which axe reports as a button with no
                  accessible name. */}
              <SelectTrigger className="w-[200px]" aria-label="מיון תוצאות">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="recommended">מומלץ</SelectItem>
                <SelectItem value="newest">תאריך: מהחדש לישן</SelectItem>
                <SelectItem value="price-asc">מחיר: מהנמוך לגבוה</SelectItem>
                <SelectItem value="price-desc">מחיר: מהגבוה לנמוך</SelectItem>
                <SelectItem value="name">א-ב</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {isLoading ? (
        // Shared product-grid skeleton: same columns + tile height as the real
        // grid, so real cards drop in with zero CLS. animate-pulse animates
        // opacity ONLY — nothing moves — so it already satisfies
        // prefers-reduced-motion (keep opacity, drop movement).
        <ProductGridSkeleton count={8} />
      ) : isError ? (
        // Lifted into a shared component: /category/$slug had no error branch at
        // all and rendered its "אין כרגע מוצרים בקטגוריה הזו" empty state for a
        // failed query. One component, so the two discovery pages cannot drift
        // again — see QueryErrorState.
        <QueryErrorState onRetry={() => refetch()} retrying={isFetching} />
      ) : products.length === 0 ? (
        // Designed glass empty state (icon + display heading + body), kept
        // gold-free per the /shop invariant. /category renders the same card so
        // the two discovery pages read consistently. The 'נקה חיפוש' chip is
        // ink-on-white for the same gold-free reason.
        <div className="glass max-w-2xl mx-auto my-12 text-center p-10 md:p-14 [--glass-radius:1.5rem]">
          <div className="mx-auto mb-5 w-14 h-14 rounded-full bg-secondary hairline flex items-center justify-center">
            <span className="text-3xl">🔍</span>
          </div>
          <h2 className="font-display text-2xl md:text-3xl font-bold mb-3">לא נמצאו מוצרים</h2>
          <p className="text-muted-foreground leading-relaxed">
            {term ? (
              <>לא מצאנו תוצאות עבור <span className="font-semibold text-foreground">"{rawTerm}"</span>. נסו מונח חיפוש אחר.</>
            ) : (
              "לא נמצאו מוצרים תואמים כרגע. נסו שוב מאוחר יותר."
            )}
          </p>
          {/* A dead end used to be the whole experience here: one "נקה חיפוש"
              chip, which returns the shopper to the same 4,648-item grid they
              could not find anything in. Give them the two things that actually
              resolve a failed search — somewhere to browse, and a human to ask.
              Both are already on this page in other forms (the occasion hubs are
              a homepage rail, the WhatsApp FAB floats over every route); this
              only puts them where the shopper has just been stopped. */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {term && (
              <button
                onClick={clearSearch}
                className="press rounded-full bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
              >
                נקה חיפוש
              </button>
            )}
            {/* Pre-filled with the term they searched for, so the shop owner
                opens a conversation that already says what they were after. */}
            <a
              href={`https://wa.me/${BUSINESS.whatsapp}?text=${encodeURIComponent(
                term ? `שלום, חיפשתי באתר "${rawTerm}" ולא מצאתי. אפשר עזרה?` : "שלום, אשמח לעזרה במציאת מוצר",
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="press rounded-full bg-accent px-6 py-2.5 text-sm font-medium text-accent-foreground transition-[background-color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-accent-strong"
            >
              שאלו אותנו בוואטסאפ
            </a>
          </div>

          {/* Occasion hubs — pure module-scope data (no fetch, so this renders
              server-side too) and the closest thing this catalogue has to
              "start here". */}
          <div className="mt-8 pt-8 border-t border-glass-line">
            <p className="text-sm text-muted-foreground mb-4">או התחילו מאחת מאלה:</p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {OCCASION_COLLECTIONS.slice(0, 6).map((c) => (
                <Link
                  key={c.slug}
                  to={"/collection/$slug" as never}
                  params={{ slug: c.slug } as never}
                  className="press rounded-full bg-card/70 px-4 py-2 text-sm text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
                >
                  {c.title}
                </Link>
              ))}
              <Link
                to="/categories"
                className="press rounded-full bg-card/70 px-4 py-2 text-sm text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background"
              >
                כל הקטגוריות
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}>
            {displayProducts.map((p, i) => (
              <ProductCard key={p.id} p={p} eager={i < 4} highPriority={i < 2} />
            ))}
          </div>
          {/* The in-stock view filter hides tiles from the loaded pages; if it
              empties them all, say so rather than showing a blank grid. */}
          {inStockOnly && displayProducts.length === 0 && (
            <p className="py-10 text-center text-muted-foreground">
              אין מוצרים במלאי בין התוצאות שנטענו.
            </p>
          )}
          {hasNextPage && (
            <div className="mt-10 text-center">
              <button
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="press rounded-full bg-card/70 px-8 py-3 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-background disabled:opacity-60"
              >
                {isFetchingNextPage ? "טוען..." : `טען עוד מוצרים (${Math.max(0, total - pageStart - products.length)})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Real <a href> pagination next to the infinite scroll: it is the only
          thing that makes products past the first page reachable by URL for a
          crawler that never clicks "load more". */}
      {(page > 1 || hasMorePages) && (
        <nav aria-label="ניווט בין עמודי המוצרים" className="mt-10 flex items-center justify-between gap-4">
          {page > 1 ? (
            <Link to="/shop" search={pageSearch(page - 1)} rel="prev" className={pageLinkClass}>
              הקודם
            </Link>
          ) : (
            <span />
          )}
          <span className="text-sm text-muted-foreground">
            עמוד {page} מתוך {lastPage}
          </span>
          {hasMorePages ? (
            <Link to="/shop" search={pageSearch(nextPage)} rel="next" className={pageLinkClass}>
              הבא
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
