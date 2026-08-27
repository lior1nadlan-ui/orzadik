// One resolver for "which picture belongs to this order line".
//
// WHY IT EXISTS
// A ₪2,001 order arrived with thirteen line items and the owner could not tell
// what had been bought: both the confirmation email and the admin order drawer
// printed names only. "כיסוי חלה מהודר דמוי עור לבן פרחים אפורים 45X55" and
// "כיסוי חלה מהודר דמוי עור לבן עם ריקמה קידוש ואותיות בולטות 42x42" are two
// different products that read as the same string at a glance — the picture is
// the only thing that separates them quickly.
//
// The email and the CRM must not disagree about which photograph a line shows,
// so both call this. Pure and synchronous: takes the joined row, returns a URL.
//
// NO SNAPSHOT COLUMN, DELIBERATELY. order_items snapshots name and price at
// purchase time, and the strictly-correct version of this would snapshot the
// image too. It is not what was asked for and it would not help the order that
// prompted this: a new column starts empty, so the orders already in the system
// — including the ₪2,001 one — would still show nothing. Resolving live through
// product_id works retroactively for every order ever placed. The cost is that
// re-photographing a product changes what an old order's email shows on reopen;
// for "what did they buy", that is the harmless direction to be wrong in.

import { localProductPhoto } from "@/lib/product-photos";
import { thumbUrl } from "@/lib/img";

/** The shape a `order_items(..., products(slug, thumbnail_url))` join returns. */
export type OrderItemWithProduct = {
  product_name?: string | null;
  products?: { slug?: string | null; thumbnail_url?: string | null } | null;
};

/**
 * Absolute image URL for an order line, or null when the product has no
 * picture at all.
 *
 * `origin` is required and must be absolute — an email client has no page to
 * resolve a root-relative path against, so "/groom-sets/groom-07.jpeg" renders
 * as a broken image in every mail app. The DB thumbnails are already absolute
 * Supabase URLs; only the bundled local photographs need the prefix.
 *
 * `width` is passed through to the Supabase render endpoint, which is why the
 * email can show thirteen thumbnails without becoming a multi-megabyte message.
 * Local photographs cannot be transformed (they are served from public/, not
 * from storage) so they ship at their own size — that is the pre-existing
 * trade-off documented in product-photos.ts, not a new one.
 */
export function orderItemImageUrl(
  item: OrderItemWithProduct | null | undefined,
  origin: string,
  width = 96,
): string | null {
  const p = item?.products;
  if (p?.thumbnail_url) return thumbUrl(p.thumbnail_url, width);

  // Falls back to a bundled photograph exactly as the storefront tiles do, so a
  // groom set — the line most likely to be on a large order — is not the one
  // line that shows no picture.
  const local = localProductPhoto(p?.slug);
  if (local) return `${origin.replace(/\/+$/, "")}${local.src}`;

  return null;
}

/** The `select` fragment both callers must use. Exported so the two cannot
 *  drift into asking for different columns. */
export const ORDER_ITEM_PRODUCT_JOIN = "products(slug, thumbnail_url)";
