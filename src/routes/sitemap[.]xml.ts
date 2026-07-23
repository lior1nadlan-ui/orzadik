import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Dynamic sitemap served at /sitemap.xml (referenced by public/robots.txt).
// Uses the service-role client so it can read regardless of RLS/grant nuances.

const SITE = "https://orzadik.com";

const STATIC: Array<{ path: string; freq: string; pri: string }> = [
  { path: "/", freq: "daily", pri: "1.0" },
  { path: "/shop", freq: "daily", pri: "0.9" },
  { path: "/categories", freq: "weekly", pri: "0.8" },
  { path: "/articles", freq: "weekly", pri: "0.8" },
  { path: "/about", freq: "monthly", pri: "0.5" },
  // /track is deliberately absent: it is noindex and only ever renders a
  // specific customer's order.
  { path: "/club", freq: "monthly", pri: "0.6" },
  { path: "/privacy", freq: "yearly", pri: "0.3" },
  { path: "/terms", freq: "yearly", pri: "0.3" },
  { path: "/accessibility", freq: "yearly", pri: "0.3" },
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
async function fetchAll<T>(
  build: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null }> },
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await build().range(from, from + PAGE - 1);
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
                .select("slug, updated_at, thumbnail_url")
                .eq("is_active", true)
                .order("slug"),
            ),
            fetchAll<any>(() => supabaseAdmin.from("categories").select("slug, image_url").order("slug")),
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

          // Thin/placeholder categories that shouldn't be advertised for indexing.
          const CAT_BLACKLIST = new Set(["sale", "uncategorized"]);

          const urls: string[] = [];
          for (const s of STATIC) {
            urls.push(
              `<url><loc>${loc(s.path)}</loc><lastmod>${freshest}</lastmod><changefreq>${s.freq}</changefreq><priority>${s.pri}</priority></url>`,
            );
          }
          for (const c of categories ?? []) {
            if (!c.slug || CAT_BLACKLIST.has(c.slug)) continue;
            urls.push(
              `<url><loc>${esc(loc(`/category/${c.slug}`))}</loc>${imgTag((c as any).image_url)}<changefreq>weekly</changefreq><priority>0.7</priority></url>`,
            );
          }
          for (const p of products ?? []) {
            if (!p.slug) continue;
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
