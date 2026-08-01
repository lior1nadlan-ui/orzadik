import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { OCCASION_COLLECTIONS } from "@/lib/collections";
// One shared "is this category real?" predicate — the same one the /categories
// hub, the header drawer and the category page's robots tag read, so the
// sitemap can never advertise a URL the site itself refuses to link.
import { CATEGORY_COUNT_EMBED, listableCategories } from "@/routes/categories";

// Dynamic sitemap served at /sitemap.xml (referenced by public/robots.txt).
// Uses the service-role client so it can read regardless of RLS/grant nuances.

const SITE = "https://orzadik.com";

const STATIC: Array<{ path: string; freq: string; pri: string }> = [
  { path: "/", freq: "daily", pri: "1.0" },
  { path: "/shop", freq: "daily", pri: "0.9" },
  { path: "/categories", freq: "weekly", pri: "0.8" },
  { path: "/articles", freq: "weekly", pri: "0.8" },
  { path: "/about", freq: "monthly", pri: "0.5" },
  { path: "/contact", freq: "monthly", pri: "0.5" },
  // /track is deliberately absent: it is noindex and only ever renders a
  // specific customer's order.
  { path: "/club", freq: "monthly", pri: "0.6" },
  // Shipping/returns rank above the other policy pages: they answer real
  // pre-purchase queries ("החזרות", "זמני משלוח"), unlike privacy/terms.
  { path: "/shipping", freq: "monthly", pri: "0.5" },
  { path: "/returns", freq: "monthly", pri: "0.5" },
  { path: "/privacy", freq: "yearly", pri: "0.3" },
  { path: "/terms", freq: "yearly", pri: "0.3" },
  { path: "/accessibility", freq: "yearly", pri: "0.3" },
];

// Curated landing pages under /collection: the bespoke personalization guide
// plus every occasion/holiday hub (slugs sourced from OCCASION_COLLECTIONS so a
// new hub is indexed the moment it is added there). These are rankable content
// pages that curate real category products, hence a higher priority than a leaf
// category and a monthly refresh cadence.
const COLLECTIONS: Array<{ path: string; freq: string; pri: string }> = [
  { path: "/collection/personalized", freq: "monthly", pri: "0.7" },
  ...OCCASION_COLLECTIONS.map((c) => ({
    path: `/collection/${c.slug}`,
    freq: "monthly",
    pri: "0.7",
  })),
];

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

const loc = (path: string) => `${SITE}${path.startsWith("/") ? path : "/" + path}`;

// PostgREST caps an unbounded select at 1000 rows. That was invisible while the
// catalog was small, but after the supplier import only 1000 of 4672 products
// reached the sitemap — the rest were silently missing from indexing. Page
// through explicitly instead of trusting the default.
const PAGE = 1000;
// `error` is checked, not discarded. Swallowing it turned any query failure into
// `data: null` -> `[]` -> a 200 sitemap that silently omits a whole entity type
// with nothing logged — and the category query is no longer the trivially safe
// `select("slug, image_url")` it used to be: it now depends on PostgREST
// resolving a many-to-many aggregate embed. Throwing puts that failure into the
// route's existing catch block instead of shipping Google a category-free
// sitemap that looks perfectly healthy.
async function fetchAll<T>(
  build: () => {
    range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error?: unknown }>;
  },
  label = "rows",
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build().range(from, from + PAGE - 1);
    if (error) {
      console.error(`[sitemap] ${label} query failed at offset ${from}:`, error);
      throw error;
    }
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) return out;
  }
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const [products, categories, articles] = await Promise.all([
            fetchAll<any>(() =>
              supabaseAdmin
                .from("products")
                // name_norm/stock/price/id are needed to pick one representative
                // per duplicate-name family (see the dedupe below).
                .select("slug, updated_at, thumbnail_url, name_norm, stock_status, price, id")
                .eq("is_active", true)
                .order("slug"),
            ),
            fetchAll<any>(() =>
              supabaseAdmin
                .from("categories")
                // parent_slug + the active-product count feed listableCategories()
                // below. Without them this select could only be filtered by a
                // two-slug blacklist, which is how seven zero-product categories
                // ended up submitted for indexing — four of them at URLs that
                // answer 404.
                .select(`slug, image_url, parent_slug, ${CATEGORY_COUNT_EMBED}`)
                .eq("products.is_active", true)
                .order("slug"),
            ),
            fetchAll<any>(() =>
              supabaseAdmin
                .from("articles")
                .select("slug, published_at, featured_image")
                .eq("is_published", true)
                .order("slug"),
            ),
          ]);

          // Google Image sitemap extension helper.
          const imgTag = (u: unknown) =>
            typeof u === "string" && u.startsWith("http")
              ? `<image:image><image:loc>${esc(u)}</image:loc></image:image>`
              : "";

          // Freshest content date across the catalog — used as lastmod for the
          // homepage/shop/etc. so crawlers see a real freshness signal.
          const contentDates = [
            ...(products ?? []).map((p) => (p as any).updated_at),
            ...(articles ?? []).map((a) => (a as any).published_at),
          ]
            .filter(Boolean)
            .map((d) => new Date(d as string).getTime())
            .filter((t) => !Number.isNaN(t));
          const freshest = (
            contentDates.length ? new Date(Math.max(...contentDates)) : new Date()
          )
            .toISOString()
            .slice(0, 10);

          const urls: string[] = [];
          for (const s of STATIC) {
            urls.push(
              `<url><loc>${loc(s.path)}</loc><lastmod>${freshest}</lastmod><changefreq>${s.freq}</changefreq><priority>${s.pri}</priority></url>`,
            );
          }
          // Collection landing pages curate live catalog products, so the
          // freshest content date is the honest lastmod for them too.
          for (const s of COLLECTIONS) {
            urls.push(
              `<url><loc>${esc(loc(s.path))}</loc><lastmod>${freshest}</lastmod><changefreq>${s.freq}</changefreq><priority>${s.pri}</priority></url>`,
            );
          }
          // Only categories that both resolve and hold products. The old
          // two-slug blacklist submitted 100 category URLs, of which four were
          // hard 404s (percent-encoded slugs) and three more were live but
          // empty — seven soft-404/thin-content candidates competing for crawl
          // budget with the ~3,540 real product pages below.
          for (const c of listableCategories(categories ?? [])) {
            urls.push(
              `<url><loc>${esc(loc(`/category/${c.slug}`))}</loc>${imgTag((c as any).image_url)}<changefreq>weekly</changefreq><priority>0.7</priority></url>`,
            );
          }
          // Submit ONE URL per name group. 528 supplier name-collisions cover
          // 1,636 active products (largest family: 43) that differ only by
          // photo, so listing them all asked Google to index 1,108 duplicates of
          // another page. The representative is chosen with the same ordering as
          // list_products_collapsed and canonical_product_slug — has an image,
          // then in stock, then cheapest, then stable by id — so the sitemap,
          // the listing grid and the canonical tag all name the same URL.
          const better = (a: any, b: any) => {
            const img = (x: any) => ((x.thumbnail_url ?? "") !== "" ? 0 : 1);
            const stock = (x: any) => (x.stock_status !== "outofstock" ? 0 : 1);
            if (img(a) !== img(b)) return img(a) - img(b);
            if (stock(a) !== stock(b)) return stock(a) - stock(b);
            const pa = Number(a.price ?? 0), pb = Number(b.price ?? 0);
            if (pa !== pb) return pa - pb;
            return String(a.id ?? "").localeCompare(String(b.id ?? ""));
          };
          const repByName = new Map<string, any>();
          for (const p of products ?? []) {
            if (!p.slug) continue;
            // The grouping key MUST match what canonical_product_slug groups on,
            // or the sitemap and the canonical tag disagree about which URLs
            // exist. That function is now price-aware — differently-priced rows
            // sharing a name are no longer collapsed, because a ₪141 page is not
            // a duplicate of a ₪94 one and the cheapest-wins election was making
            // the expensive models unindexable. Grouping on name alone here
            // would leave the 238 URLs that just became self-canonical missing
            // from the sitemap entirely.
            // A missing name_norm can't be grouped — keep the row on its own key.
            const key = (p as any).name_norm
              ? `${(p as any).name_norm}|${String((p as any).price)}`
              : `~${p.slug}`;
            const cur = repByName.get(key);
            if (!cur || better(p, cur) < 0) repByName.set(key, p);
          }
          for (const p of repByName.values()) {
            const lm = p.updated_at
              ? `<lastmod>${new Date(p.updated_at).toISOString().slice(0, 10)}</lastmod>`
              : "";
            urls.push(
              `<url><loc>${esc(loc(`/product/${p.slug}`))}</loc>${lm}${imgTag((p as any).thumbnail_url)}<changefreq>weekly</changefreq><priority>0.8</priority></url>`,
            );
          }
          for (const a of articles ?? []) {
            if (!a.slug) continue;
            const lm = a.published_at
              ? `<lastmod>${new Date(a.published_at).toISOString().slice(0, 10)}</lastmod>`
              : "";
            urls.push(
              `<url><loc>${esc(loc(`/articles/${a.slug}`))}</loc>${lm}${imgTag((a as any).featured_image)}<changefreq>weekly</changefreq><priority>0.8</priority></url>`,
            );
          }

          const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join("\n")}\n</urlset>`;
          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              "Cache-Control": "public, max-age=3600, s-maxage=3600",
            },
          });
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          console.error("[sitemap] generation failed", { error: err, timestamp: new Date().toISOString() });
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"/>`,
            {
              status: 200,
              headers: {
                "Content-Type": "application/xml; charset=utf-8",
                "Cache-Control": "public, max-age=60, s-maxage=60",
              },
            },
          );
        }
      },
    },
  },
});
