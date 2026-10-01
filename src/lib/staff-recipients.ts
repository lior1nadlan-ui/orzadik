// Who receives the owner-facing emails (new order, contact form, morning
// briefing). Pure, so it is unit-tested; the DB lookup lives in
// staff-recipients.server.ts.
//
// Until 2026-10 these went to SHOP_OWNER_EMAIL alone, so a second admin (Lior's
// wife) could run the CRM yet never hear about a new order. Now the configured
// owner inbox stays first and every admin account is added after it.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Merge the owner inbox with the admins' addresses: trimmed, lower-cased,
 * de-duplicated, invalid/empty entries dropped, owner first.
 */
export function mergeStaffRecipients(
  owner: string | null | undefined,
  admins: ReadonlyArray<string | null | undefined>,
): string[] {
  const out: string[] = [];
  for (const raw of [owner, ...admins]) {
    const email = (raw ?? "").trim().toLowerCase();
    if (!email || !EMAIL_RE.test(email) || out.includes(email)) continue;
    out.push(email);
  }
  return out;
}
