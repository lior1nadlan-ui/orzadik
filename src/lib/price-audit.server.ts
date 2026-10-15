// Loads the catalog and the last 30 days of price changes and runs the
// "מחירים חשודים" rules (src/lib/price-audit.ts). Shared by the admin report
// and the owner's morning briefing. Server-only: service-role reads.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { auditPrices, type AuditProduct, type PriceIssue } from "@/lib/price-audit";

const DB_PAGE = 1000;

export async function loadPriceIssues(now: number = Date.now()): Promise<PriceIssue[]> {
  const products: AuditProduct[] = [];
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, price, sale_price, name_norm")
      .eq("is_active", true)
      .order("id", { ascending: true })
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error("שגיאה בבדיקת המחירים.");
    for (const p of data ?? []) {
      products.push({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: Number(p.price),
        salePrice: p.sale_price === null ? null : Number(p.sale_price),
        nameNorm: p.name_norm,
      });
    }
    if ((data ?? []).length < DB_PAGE) break;
  }
  const since = new Date(now - 30 * 86400_000).toISOString();
  const { data: changes, error: cErr } = await supabaseAdmin
    .from("product_price_changes")
    .select("product_id, old_price, new_price")
    .gte("changed_at", since)
    .is("undone_by_batch", null)
    .neq("source", "undo")
    .order("changed_at", { ascending: false })
    .limit(5000);
  if (cErr) throw new Error("שגיאה בבדיקת המחירים.");
  return auditPrices(
    products,
    (changes ?? []).map((c) => ({
      productId: c.product_id,
      oldPrice: Number(c.old_price),
      newPrice: Number(c.new_price),
    })),
  );
}
