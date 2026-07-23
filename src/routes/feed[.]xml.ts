import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getEffectivePrice } from "@/lib/pricing";
import { BUSINESS } from "@/lib/business";

// Google Merchant Center product feed, served at /feed.xml.
//
// This is what turns the store's 4,600+ products into free Google Shopping
// listings: the owner registers this URL as a scheduled feed in Merchant Center.
// It is a READ of the catalogue — the price emitted is exactly
// getEffectivePrice(price), the same function the Product/Offer JSON-LD and the
// storefront use, so the feed price can never disagree with the landing page
// (Merchant Center rejects mismatches). Nothing here changes what a customer is
// charged.
//
// RSS 2.0 with the Google base namespace (g:). Spec:
// https://support.google.com/merchants/answer/7052112

const SITE = "https://orzadik.com";

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

// Drop characters XML 1.0 forbids. Anything below 0x20 that is not tab (9),
// LF (10) or CR (13), plus DEL (0x7F), is illegal and would make the whole feed
// unparseable in Merchant Center. Done by code point (not a regex range) so the
// source file itself stays free of literal control bytes.
function stripXmlIllegal(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 9 || c === 10 || c === 13 || (c >= 0x20 && c !== 0x7f)) out += s[i];
  }
  return out;
}

/** Strip tags, remove XML-illegal control chars, collapse whitespace, cap length. */
const plain = (html: unknown, max = 4000): string =>
  stripXmlIllegal(String(html ?? "").replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

// PostgREST caps an unbounded select at 1000 rows (this once hid 79% of the
// catalogue from the sitemap). Page through explicitly.
const PAGE = 1000;
async function fetchAllProducts(): Promise<any[]> {
  const out: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data } = await supabaseAdmin
      .from("products")
      .select("id, slug, name, description, short_description, price, sku, stock_status, thumbnail_url")
      .eq("is_active", true)
      .order("id")
      .range(from, from + PAGE - 1);
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) return out;
  }
}

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const products = await fetchAllProducts();

          const items: string[] = [];
          for (const p of products) {
            // Shopping requires a positive price and an image. Excluding
            // price<=0 also drops the "לפי שער הזהב" call-only items, which have
            // no fixed price to advertise.
            const price = Number(p.price);
            if (!p.slug || !p.thumbnail_url || !(price > 0)) continue;
            const effective = getEffectivePrice(price);
            if (!(effective > 0)) continue;

            const title = plain(p.name, 150);
            const description = plain(p.description || p.short_description || p.name, 5000) || title;
            const link = `${SITE}/product/${encodeURIComponent(p.slug)}`;
            const availability = p.stock_status === "outofstock" ? "out_of_stock" : "in_stock";
            const sku = typeof p.sku === "string" ? p.sku.trim() : "";

            items.push(
              `<item>` +
                `<g:id>${esc(p.id)}</g:id>` +
                `<g:title>${esc(title)}</g:title>` +
                `<g:description>${esc(description)}</g:description>` +
                `<g:link>${esc(link)}</g:link>` +
                `<g:image_link>${esc(p.thumbnail_url)}</g:image_link>` +
                `<g:availability>${availability}</g:availability>` +
                // Whole-shekel effective price, formatted as Google expects.
                `<g:price>${effective}.00 ILS</g:price>` +
                `<g:condition>new</g:condition>` +
                `<g:brand>${esc(BUSINESS.name)}</g:brand>` +
                // Supplier items carry no manufacturer GTIN. When a SKU exists it
                // pairs with the brand as the product identifier; otherwise tell
                // Google no identifier exists, which is the correct signal for
                // handmade / no-barcode goods and avoids "missing gtin" errors.
                (sku
                  ? `<g:mpn>${esc(sku)}</g:mpn>`
                  : `<g:identifier_exists>no</g:identifier_exists>`) +
              `</item>`,
            );
          }

          const xml =
            `<?xml version="1.0" encoding="UTF-8"?>\n` +
            `<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n` +
            `<channel>\n` +
            `<title>${esc(BUSINESS.name)}</title>\n` +
            `<link>${SITE}</link>\n` +
            `<description>קטלוג המוצרים של ${esc(BUSINESS.name)} — תשמישי קדושה ויודאיקה.</description>\n` +
            items.join("\n") +
            `\n</channel>\n</rss>`;

          return new Response(xml, {
            status: 200,
            headers: {
              "Content-Type": "application/xml; charset=utf-8",
              // Feeds are pulled on a schedule, not by users — cache generously.
              "Cache-Control": "public, max-age=21600, s-maxage=21600",
            },
          });
        } catch (e) {
          const err = e instanceof Error ? e.message : String(e);
          console.error("[feed] generation failed", { error: err, timestamp: new Date().toISOString() });
          // Valid-but-empty feed rather than a 500, so a scheduled pull does not
          // wipe the Merchant Center listings on one transient DB hiccup.
          return new Response(
            `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0"><channel><title>${esc(BUSINESS.name)}</title><link>${SITE}</link><description>feed temporarily unavailable</description></channel></rss>`,
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
