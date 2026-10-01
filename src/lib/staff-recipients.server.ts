// Owner-facing email recipients: SHOP_OWNER_EMAIL (falling back to
// BUSINESS.email) plus every account holding the admin role. See
// staff-recipients.ts for the merge rules.
//
// A failed admin lookup never blocks the alert: it is logged and the owner
// inbox alone is used, which is exactly the behaviour before this file existed.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUSINESS } from "@/lib/business";
import { mergeStaffRecipients } from "@/lib/staff-recipients";

async function adminEmails(): Promise<string[]> {
  const { data: roles, error } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  if (error) {
    console.error("[staff-recipients] user_roles lookup failed:", error.message);
    return [];
  }
  const ids = [...new Set((roles ?? []).map((r) => r.user_id))];
  if (ids.length === 0) return [];

  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, email").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  const emails: string[] = [];
  for (const id of ids) {
    let email = byId.get(id) ?? null;
    // A profile row may predate the email column being filled — ask Auth.
    if (!email) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      email = data?.user?.email ?? null;
    }
    if (email) emails.push(email);
  }
  return emails;
}

/** Every inbox that should receive owner alerts. May be empty. */
export async function getStaffRecipients(): Promise<string[]> {
  const owner = (process.env.SHOP_OWNER_EMAIL || BUSINESS.email || "").trim();
  let admins: string[] = [];
  try {
    admins = await adminEmails();
  } catch (e) {
    console.error("[staff-recipients] admin lookup threw:", e);
  }
  return mergeStaffRecipients(owner, admins);
}
