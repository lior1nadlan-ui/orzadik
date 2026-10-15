// Ends timed sales ("מבצע עד תאריך") whose date has passed: the regular price
// and former price come back, logged as source 'sale_end'. A product whose
// price was changed by hand during the sale keeps the owner's price. The SQL
// is in supabase/migrations/20261015090000_timed_sales.sql.

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function runEndDueSales(): Promise<{ restored: number; kept: number }> {
  const { data, error } = await supabaseAdmin.rpc("end_due_sales");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : null;
  const out = { restored: row?.restored ?? 0, kept: row?.kept ?? 0 };
  if (out.restored || out.kept) console.log("[sales] ended:", out);
  return out;
}
