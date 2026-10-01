// Authoritative line pricing for a new order — the one place every order's
// prices are decided. Extracted verbatim from placeOrder so the CRM's phone
// orders (admin-orders.functions.ts) charge exactly what the site would:
// prices, sizes and live promotions are all re-read from the database here,
// and nothing a caller sends can influence them.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { orderCustomText } from "@/lib/personalization";
import { buildPromoIndex, promoFor, promoPrice, EMPTY_PROMO_INDEX } from "@/lib/promotions";
import { getEffectivePrice as effectivePrice, isSellablePrice } from "@/lib/pricing";

export type OrderLineInput = {
  product_id: string;
  quantity: number;
  variant_id?: string | null;
  custom_text?: string | null;
  custom_method?: "embroidery" | "laser" | "print" | null;
};

export async function priceOrderLines(items: OrderLineInput[]) {
  // Re-fetch authoritative prices from DB
  const ids = items.map((i) => i.product_id);
  const { data: products, error: pErr } = await supabaseAdmin
    .from("products")
    .select("id, name, price, sku, is_active, stock_status")
    .in("id", ids);
  if (pErr) {
    console.error("[priceOrderLines] products fetch:", pErr);
    throw new Error("שגיאה בטעינת המוצרים. אנא נסה שוב.");
  }

  // Fetch any referenced size variants for authoritative variant pricing
  const variantIds = items.map((i) => i.variant_id).filter(Boolean) as string[];
  let variantsById = new Map<
    string,
    {
      id: string;
      product_id: string;
      label: string;
      price: number | null;
      in_stock: boolean | null;
    }
  >();
  if (variantIds.length > 0) {
    const { data: vrows, error: vErr } = await supabaseAdmin
      .from("product_variants")
      .select("id, product_id, label, price, in_stock")
      .in("id", variantIds);
    if (vErr) {
      console.error("[priceOrderLines] variants fetch:", vErr);
      throw new Error("שגיאה בטעינת גדלי המוצרים. אנא נסה שוב.");
    }
    // in_stock is normalized to a tri-state on purpose: most rows never set
    // it, and an unset size must stay purchasable. Only an explicit false
    // blocks the line below.
    variantsById = new Map(
      (vrows ?? []).map((v: any) => [
        v.id as string,
        {
          id: v.id,
          product_id: v.product_id,
          label: v.label,
          price: v.price !== null && v.price !== undefined ? Number(v.price) : null,
          in_stock: typeof v.in_stock === "boolean" ? v.in_stock : null,
        },
      ]),
    );
  }

  // Live CRM promotions, read here and not taken from the client: the charge
  // is decided by what is live NOW. A failed read charges regular prices,
  // which the expected_items_total guard below then stops if the page had
  // shown promotional ones.
  let promoIndex = EMPTY_PROMO_INDEX;
  {
    const { data: promoRows, error: promoErr } = await supabaseAdmin.rpc("active_promotion_index");
    if (promoErr) console.error("[priceOrderLines] promotions fetch:", promoErr);
    else promoIndex = buildPromoIndex(promoRows);
  }

  const byId = new Map(products?.map((p) => [p.id, p]) ?? []);
  const lineItems = items.map((i) => {
    const p = byId.get(i.product_id);
    if (!p || !p.is_active) throw new Error(`מוצר לא זמין`);
    if (p.stock_status === "outofstock") throw new Error(`מוצר אזל מהמלאי: ${p.name}`);
    let basePrice = Number(p.price);
    let variantLabel: string | null = null;
    if (i.variant_id) {
      const v = variantsById.get(i.variant_id);
      if (!v || v.product_id !== p.id) throw new Error(`גודל לא תקין עבור ${p.name}`);
      // The parent stock check above says nothing about a single size: a
      // product can be in stock while one size is not. Reject only on an
      // explicit false so the untouched rows stay orderable.
      if (v.in_stock === false) throw new Error(`הגודל אזל מהמלאי: ${p.name} — ${v.label}`);
      if (v.price !== null) basePrice = v.price;
      variantLabel = v.label;
    }
    // Every check above passes for an active, in-stock row whose price was
    // simply never filled in — and seven live rows were in exactly that state
    // (the "האש שלי" gold and silver pieces, diamond settings among them). The
    // line then came to 0, `subtotal > 0` was false so shipping was waived
    // too, and the order landed at ₪0 for the lot.
    //
    // Guarded here rather than in the cart because this function re-reads the
    // price from the database precisely so nothing the client sends can
    // influence it, which makes it the one point every order must pass.
    if (!isSellablePrice(basePrice)) {
      throw new Error(`מוצר ללא מחיר תקין: ${p.name}`);
    }
    const regular = effectivePrice(basePrice);
    const promo = promoFor(promoIndex, p.id);
    const unit_price = promoPrice(regular, promo);
    const combinedCustom = orderCustomText(i.custom_text, i.custom_method);
    return {
      product_id: p.id,
      product_name: p.name,
      product_sku: p.sku,
      unit_price,
      quantity: i.quantity,
      line_total: unit_price * i.quantity,
      custom_text: combinedCustom,
      variant_label: variantLabel,
      // Which promotion priced this line — only when it actually lowered it.
      promotion_id: promo && unit_price < regular ? promo.id : null,
    };
  });
  return lineItems;
}
