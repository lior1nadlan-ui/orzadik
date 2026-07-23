// Shared admin gate for server functions.
//
// Extracted from reviews.functions.ts so every admin-only server function
// (reviews moderation, CRM screens) uses the same check instead of each file
// growing its own copy. Throws on any non-admin caller; returns the admin's
// user id for attribution (e.g. crm_customer_notes.created_by).

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getOptionalUserId } from "@/integrations/supabase/optional-auth";

export async function requireAdmin(): Promise<string> {
  const userId = await getOptionalUserId();
  if (!userId) throw new Error("אין הרשאה.");
  const { data: role } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!role) throw new Error("אין הרשאה.");
  return userId;
}
