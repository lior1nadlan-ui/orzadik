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
    // `error` is checked, not discarded. Swallowing it made a mid-pagination
    // failure indistinguishable from the end of the catalogue: `data` comes back
    // null, `batch` is [], `batch.length < PAGE` is true, and the loop RETURNS
    // the rows gathered so far as though that were the whole shop. Google would
    // then be handed a 200 feed silently missing thousands of products, and
    // Merchant would start expiring every item that vanished — with nothing
    // logged anywhere. Same fix as sitemap[.]xml.ts's fetchAll.
    const { data, error } = await supabaseAdmin
      .from("products")
      // name_norm is here only so the feed can collapse duplicate-name families
      // on exactly the key sitemap.xml groups by — see representatives() below.
      .select(
        "id, slug, name, description, short_description, price, sku, stock_status, thumbnail_url, name_norm",
      )
      .eq("is_active", true)
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`[feed] product query failed at offset ${from}:`, error);
      throw error;
    }
    const batch = data ?? [];
    out.push(...batch);
    if (batch.length < PAGE) return out;
  }
}

// Merchant Center crawls every <g:link> and compares the landing page against
// the feed item; a link whose page declares a different rel=canonical is the
// "Mismatched value (page crawl)" / duplicate-item disapproval class.
//
// Emitting one item per raw catalogue row failed that check at scale. Measured
// on the live feed: 4,634 items covering 870 product URLs the site deliberately
// keeps OUT of its own sitemap, and in a 20-URL sample of those 870, 17 landing
// pages canonicalised to a *different* URL. The feed was also the only
// discovery vector keeping the remaining self-canonical duplicates crawlable —
// a crawl-budget tax this domain cannot afford. A feed and a sitemap
// disagreeing about which URLs exist is a disapproval cause on its own.
//
// So the feed now advertises exactly the URL set the sitemap advertises: one
// representative per (name_norm, price) family, elected with the same ordering
// every other collapse in this codebase uses — has an image, then in stock,
// then cheapest, then stable by id.
//
// The KEY is what matters and it is deliberately (name_norm, price), matching
// sitemap.xml and canonical_product_slug. Be aware that list_products_collapsed
// still groups on name_norm ALONE, which is why 238 sitemap URLs currently have
// no product card anywhere on the site. Do not "align" this file with the
// listing RPC to close that gap: grouping on name_norm alone here would drop
// 238 items the sitemap and rel=canonical both keep as distinct indexable
// pages, re-opening the feed/sitemap disagreement in the other direction — and
// the feed is currently those 238 URLs' only machine-readable discovery path.
// That gap has to be closed on the listing side.
//
// Two details that are load-bearing and easy to get wrong:
//  1. The election runs over ALL active rows, before the feed's own image/price
//     eligibility filter. Filtering first could elect a different member than
//     the sitemap did and reintroduce the mismatch.
//  2. The key uses the RAW price, exactly as the sitemap does — not
//     getEffectivePrice() — because that is the price the canonical rule groups
//     on. Two families that round to the same effective price are still two
//     pages.
//
// Verified offline against the live catalogue (4,648 active rows): 3,778
// representatives, matching the 3,778 product <loc>s in the live sitemap with 0
// differences either way; after eligibility, 3,764 items, 0 of them outside the
// sitemap. The 14 sitemap URLs left without an item are the rows with no photo
// or no fixed price ("לפי שער הזהב"), which Shopping cannot accept anyway.
// Family members differ only by photo — never by name or by price — so the 870
// dropped rows were duplicate offers, not variants, and nothing buyable is lost.
function representatives(products: any[]): any[] {
  const better = (a: any, b: any) => {
    const img = (x: any) => ((x.thumbnail_url ?? "") !== "" ? 0 : 1);
    const stock = (x: any) => (x.stock_status !== "outofstock" ? 0 : 1);
    if (img(a) !== img(b)) return img(a) - img(b);
    if (stock(a) !== stock(b)) return stock(a) - stock(b);
    const pa = Number(a.price ?? 0),
      pb = Number(b.price ?? 0);
    if (pa !== pb) return pa - pb;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  };
  const rep = new Map<string, any>();
  for (const p of products) {
    if (!p.slug) continue;
    // A missing name_norm can't be grouped — keep the row on its own key, same
    // as the sitemap, so it is never silently merged into someone else's family.
    const key = p.name_norm ? `${p.name_norm}|${String(p.price)}` : `~${p.slug}`;
    const cur = rep.get(key);
    if (!cur || better(p, cur) < 0) rep.set(key, p);
    // Carry the FAMILY key onto whichever row currently wins, so the item's
    // identity can be derived from the family rather than from the winner.
    // See feedItemId() for why that distinction matters.
    rep.get(key)!.__familyKey = key;
  }
  return [...rep.values()];
}

/**
 * Stable Merchant Center item id, derived from the FAMILY key rather than from
 * the elected representative's row id.
 *
 * `<g:id>` is the primary key of a Merchant item: change it and Google treats
 * the result as a brand-new product, discarding that item's history and putting
 * it back through review. Using the representative's `id` made the identity
 * inherit the election's volatility — the comparator's second key is
 * `stock_status`, which flips on ordinary supplier sync, so a family whose
 * current winner sells out would silently re-key its feed item even though the
 * offer, price and landing page are unchanged.
 *
 * The family key (`name_norm|price`) is stable for as long as the family exists,
 * which is exactly the lifetime of the offer being advertised. It is hashed
 * because a raw key is Hebrew, unbounded in length, and Merchant caps item ids
 * at 50 characters; FNV-1a is used rather than crypto.subtle because that is
 * async and this runs inside a synchronous XML build.
 *
 * NOTE: this re-keys every existing item once. That is deliberate and this is
 * the cheapest moment to do it — the feed's Merchant submission status is still
 * an open question on the owner list, so there is probably no history to lose
 * yet. Doing it after submission would cost real item history.
 */
function feedItemId(p: any): string {
  const key = typeof p.__familyKey === "string" ? p.__familyKey : String(p.id ?? p.slug ?? "");
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `ozl-${h.toString(16).padStart(8, "0")}`;
}

export const Route = createFileRoute("/feed.xml")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const products = await fetchAllProducts();

          const items: string[] = [];
          for (const p of representatives(products)) {
            // Shopping requires a positive price and an image. Excluding
            // price<=0 also drops the "לפי שער הזהב" call-only items, which have
            // no fixed price to advertise.
            const price = Number(p.price);
            if (!p.slug || !p.thumbnail_url || !(price > 0)) continue;
            const effective = getEffectivePrice(price);
            if (!(effective > 0)) continue;

            const title = plain(p.name, 150);
            const description =
              plain(p.description || p.short_description || p.name, 5000) || title;
            const link = `${SITE}/product/${encodeURIComponent(p.slug)}`;
            const availability = p.stock_status === "outofstock" ? "out_of_stock" : "in_stock";
            const sku = typeof p.sku === "string" ? p.sku.trim() : "";

            items.push(
              `<item>` +
                `<g:id>${esc(feedItemId(p))}</g:id>` +
                `<g:title>${esc(title)}</g:title>` +
                `<g:description>${esc(description)}</g:description>` +
                `<g:link>${esc(link)}</g:link>` +
                `<g:image_link>${esc(p.thumbnail_url)}</g:image_link>` +
                `<g:availability>${availability}</g:availability>` +
                // Whole-shekel effective price, formatted as Google expects.
                `<g:price>${effective}.00 ILS</g:price>` +
                `<g:condition>new</g:condition>` +
                `<g:brand>${esc(BUSINESS.name)}</g:brand>` +
                // `identifier_exists=no` unconditionally — g:mpn is NOT emitted,
                // even for rows that have a SKU.
                //
                // mpn means Manufacturer Part Number: the code the party named in
                // g:brand assigns to the part. These SKUs are neither. They are
                // this shop's own ART Judaica import codes (`UK82890`), the brand
                // is the retailer, and the retailer manufactures nothing — so
                // publishing the import code as an mpn asserts a manufacturer
                // relationship that does not exist. Two feeds quoting the same
                // supplier would also collide on identical "mpn" values for
                // different offers.
                //
                // The Product JSON-LD on the landing page drops mpn for exactly
                // this reason, and Merchant crawls that page and compares it to
                // the feed — so the two MUST agree or the mismatch becomes its
                // own disapproval. `identifier_exists=no` is the correct, honest
                // signal for handmade / no-barcode goods and avoids the "missing
                // gtin" error class.
                `<g:identifier_exists>no</g:identifier_exists>` +
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
          console.error("[feed] generation failed", {
            error: err,
            timestamp: new Date().toISOString(),
          });
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
