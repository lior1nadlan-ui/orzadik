// Owner-facing email recipients: SHOP_OWNER_EMAIL (falling back to
// BUSINESS.email) plus every account holding the admin role that has not
// switched that kind of email off (staff_alert_prefs). See staff-recipients.ts
// for the merge rules.
//
// The shop inbox itself is always included — it is the business address, not a
// person, and the one place every alert must land.
//
// A failed admin lookup never blocks the alert: it is logged and the owner
// inbox alone is used, which is exactly the behaviour before this file existed.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { BUSINESS } from "@/lib/business";
import {
  adminsWanting,
  mergeStaffRecipients,
  type AdminContact,
  type StaffAlertKind,
} from "@/lib/staff-recipients";

async function adminContacts(): Promise<AdminContact[]> {
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

  const [{ data: profiles }, { data: prefs }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, email").in("id", ids),
    supabaseAdmin
      .from("staff_alert_prefs")
      .select("user_id, orders, contacts, digest")
      .in("user_id", ids),
  ]);
  const emailById = new Map((profiles ?? []).map((p) => [p.id, p.email]));
  const prefsById = new Map((prefs ?? []).map((p) => [p.user_id, p]));

  const out: AdminContact[] = [];
  for (const id of ids) {
    let email = emailById.get(id) ?? null;
    // A profile row may predate the email column being filled — ask Auth.
    if (!email) {
      const { data } = await supabaseAdmin.auth.admin.getUserById(id);
      email = data?.user?.email ?? null;
    }
    out.push({ email, prefs: prefsById.get(id) ?? null });
  }
  return out;
}

/** Every inbox that should receive this kind of owner alert. May be empty. */
export async function getStaffRecipients(kind: StaffAlertKind): Promise<string[]> {
  const owner = (process.env.SHOP_OWNER_EMAIL || BUSINESS.email || "").trim();
  let admins: string[] = [];
  try {
    admins = adminsWanting(await adminContacts(), kind);
  } catch (e) {
    console.error("[staff-recipients] admin lookup threw:", e);
  }
  return mergeStaffRecipients(owner, admins);
}
