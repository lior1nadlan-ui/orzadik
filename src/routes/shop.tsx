import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, ProductCardData } from "@/components/ProductCard";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ShopSort = "newest" | "price-asc" | "price-desc" | "name";

function isShopSort(v: unknown): v is ShopSort {
  return v === "newest" || v === "price-asc" || v === "price-desc" || v === "name";
}

// Fetch a page at a time rather than the whole catalog. This used to pull a
// flat .limit(500) and slice it client-side, which capped /shop at 500 of the
// 4,672 products and made the header report "500 מוצרים". Paging server-side
// keeps the DOM light *and* reachable across the full catalog.
const PAGE = 24;
// 4,672 products / 24 ≈ 195 pages today. The clamp keeps a hand-typed or
// crawler-invented ?page=999999 from turning into an absurd DB offset.
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
  const term = sanitizeTerm(rawQ);

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
      p_term: rawQ.trim().slice(0, 100),
      p_limit: PAGE,
      p_offset: offset,
      p_sort: sort,
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
  else query = query.order("created_at", { ascending: false });

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
  validateSearch: (s: Record<string, unknown>): { q?: string; sort?: ShopSort; page?: number } => ({
    q: typeof s.q === "string" ? s.q : undefined,
    // Unknown values narrow to undefined and render as the default ("newest").
    sort: isShopSort(s.sort) ? s.sort : undefined,
    page: parsePage(s.page),
  }),
  loaderDeps: ({ search }) => ({
    q: search.q ?? "",
    sort: search.sort ?? ("newest" as ShopSort),
    page: search.page ?? 1,
  }),
  // Server-render the first (or requested) page. Without this the route emitted
  // nothing but a skeleton grid, so the non-JS crawlers robots.txt explicitly
  // welcomes saw zero product links on a page advertised at sitemap priority 0.9.
  loader: async ({ deps }) => {
    const offset = (deps.page - 1) * PAGE;
    // A search term or a non-default sort makes the URL a facet of /shop, not a
    // page of it: those views stay canonical to the bare /shop (unchanged from
    // before) and get no rel=prev/next, which would otherwise point at the
    // unfiltered page 2.
    const filtered = deps.q.trim().length > 0 || deps.sort !== "newest";
    try {
      return {
        page: deps.page,
        offset,
        filtered,
        first: await fetchShopPage({ rawQ: deps.q, sort: deps.sort, offset }),
      };
    } catch (err) {
      // Degrade to the client-side query + its existing retry UI rather than
      // blowing the whole route into the error boundary on a transient DB blip.
      console.warn("[shop] loader failed, falling back to client fetch:", err);
      return { page: deps.page, offset, filtered, first: null as ShopPageData | null };
    }
  },
  head: ({ loaderData }) => {
    const page = loaderData?.page ?? 1;
    const offset = loaderData?.offset ?? 0;
    const filtered = loaderData?.filtered ?? false;
    const rows = loaderData?.first?.rows ?? [];
    const total = loaderData?.first?.total ?? 0;
    const lastPage = Math.max(1, Math.ceil(total / PAGE));
    const paged = !filtered;

    const title = page > 1 ? `כל המוצרים — עמוד ${page} | אור זרוע לצדיק` : "כל המוצרים | אור זרוע לצדיק";
    // Page 1 keeps the bare /shop canonical; deeper pages are canonical to
    // themselves so their products are indexable in their own right.
    const canonical = paged && page > 1 ? `${SITE}/shop?page=${page}` : `${SITE}/shop`;

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
        { "@type": "ListItem", position: 2, name: "חנות", item: `${SITE}/shop` },
      ],
    };

    return {
      meta: [
        { title },
        { name: "description", content: "כל מוצרי תשמישי הקדושה והיודאיקה של אור זרוע לצדיק — טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות, פמוטים ומארזים לחתנים. כשרות מהודרת ומשלוח עד הבית." },
        { property: "og:title", content: title },
        { property: "og:description", content: "טליתות, תפילין, מזוזות, גביעי קידוש, חנוכיות ומארזים לחתנים — כל המוצרים במקום אחד." },
        { property: "og:url", content: canonical },
        { property: "og:type", content: "website" },
        { name: "twitter:title", content: title },
        { name: "twitter:description", content: "כל מוצרי תשמישי הקדושה והיודאיקה במקום אחד." },
      ],
      links: [
        { rel: "canonical", href: canonical },
        ...(paged && page > 1 ? [{ rel: "prev", href: page - 1 > 1 ? `${SITE}/shop?page=${page - 1}` : `${SITE}/shop` }] : []),
        ...(paged && page < lastPage ? [{ rel: "next", href: `${SITE}/shop?page=${page + 1}` }] : []),
      ],
      scripts: [
        { type: "application/ld+json", children: JSON.stringify(itemListLd) },
        { type: "application/ld+json", children: JSON.stringify(breadcrumbLd) },
      ],
    };
  },
});

function ShopPage() {
  const { q: qFromUrl, sort: sortFromUrl, page: pageFromUrl } = Route.useSearch();
  const loaderData = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const [q, setQ] = useState(qFromUrl || "");
  const [debouncedQ, setDebouncedQ] = useState(qFromUrl || "");
  // Sort is read straight off the URL (not mirrored into state) so the route
  // loader, the head tags and the query key can never disagree about it.
  const sort: ShopSort = sortFromUrl ?? "newest";

  // Keep the box and the effective term in step with the URL, including
  // back/forward and the pagination links below.
  useEffect(() => {
    setQ(qFromUrl || "");
    setDebouncedQ(qFromUrl || "");
  }, [qFromUrl]);

  const changeSort = (v: ShopSort) => {
    navigate({
      // A different order means a different page 1 — drop ?page= so the user
      // does not land mid-catalog after re-sorting.
      search: (prev) => ({ ...prev, sort: v === "newest" ? undefined : v, page: undefined }),
      replace: true,
      resetScroll: false,
    });
  };

  // Debounce keystrokes so we hit the DB at most a few times per search.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const urlQ = (qFromUrl ?? "").trim();
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
  // Total across the whole result set, not just what has been loaded.
  const total = data?.pages[0]?.total ?? 0;
  // Echo the user's raw input in copy — the sanitized term may contain
  // injected % wildcards that should never be shown.
  const rawTerm = debouncedQ.trim();

  const lastPage = Math.max(1, Math.ceil(total / PAGE));
  // "Next" skips past everything already rendered, so a visitor who pressed
  // "load more" twice does not get a link back to products they can see.
  const nextPage = Math.min(MAX_PAGE, Math.floor((pageStart + products.length) / PAGE) + 1);
  const hasMorePages = pageStart + products.length < total;
  const pageSearch = (n: number): { q?: string; sort?: ShopSort; page?: number } => ({
    q: activeQ || undefined,
    sort: sort === "newest" ? undefined : sort,
    page: n <= 1 ? undefined : n,
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
      {/* Toolbar as a single glass pane over the light ground. .glass owns
          background-color, border-radius and box-shadow (see the override
          contract in styles.css) — retune it through its variables, not through
          background or radius utilities, which it outranks. */}
      <div className="glass mb-8 flex flex-wrap items-end justify-between gap-4 p-5 md:p-6 [--glass-radius:1.25rem]">
        <div>
          <h1 className="font-display text-3xl md:text-4xl font-bold">כל המוצרים</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {term ? `${total} תוצאות עבור "${rawTerm}"` : `${total} מוצרים`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="חיפוש מוצר..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="max-w-xs"
          />
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">מיון:</span>
            <Select value={sort} onValueChange={(v) => changeSort(v as ShopSort)}>
              {/* Radix renders a <button role="combobox"> whose only content is
                  the current value, which axe reports as a button with no
                  accessible name. */}
              <SelectTrigger className="w-[180px]" aria-label="מיון תוצאות">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">החדשים ביותר</SelectItem>
                <SelectItem value="price-asc">מחיר: מהנמוך לגבוה</SelectItem>
                <SelectItem value="price-desc">מחיר: מהגבוה לנמוך</SelectItem>
                <SelectItem value="name">א-ב</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      {isLoading ? (
        // Skeleton panes: quiet surface + hairline ring, matching the glass
        // vocabulary without the cost of 8 simultaneous backdrop-filters.
        // animate-pulse animates opacity ONLY — nothing moves — so it is already
        // correct under prefers-reduced-motion, which keeps opacity and drops
        // movement. Do not swap this for a translating shimmer.
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-2xl bg-muted hairline" />
          ))}
        </div>
      ) : isError ? (
        <div className="py-20 text-center space-y-3">
          <p className="text-muted-foreground">אירעה שגיאה בטעינת המוצרים. בדקו את החיבור ונסו שוב.</p>
          <button
            onClick={() => refetch()}
            className="press rounded-full bg-card/70 px-6 py-2.5 text-sm font-medium text-foreground hairline transition-[background-color,color,transform] duration-150 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-secondary"
          >
            נסו שוב
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="py-20 text-center text-muted-foreground">
          לא נמצאו מוצרים{term ? ` עבור "${rawTerm}"` : ""}. נסו מונח חיפוש אחר.
        </div>
      ) : (
        <>
          <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}>
            {products.map((p, i) => (
              <ProductCard key={p.id} p={p} priority={i < 8} />
            ))}
          </div>
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
