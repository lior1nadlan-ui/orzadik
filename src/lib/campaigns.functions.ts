// Newsletter campaign composer + chunked sender.
//
// Audience rule, and the one that matters most: a campaign may ONLY go to
// addresses that gave marketing consent — newsletter_subscribers rows that are
// still open, and profiles with marketing_consent = true. orders.contact_consent
// is NEVER consulted; its checkout label promises those details are not used for
// marketing. Every address is then filtered through email_suppressions, both
// when the audience is built and again on each batch, so an unsubscribe that
// lands mid-send takes effect immediately, and through profiles.marketing_consent
// = false, so an account that switched marketing off is never resurrected by a
// stale newsletter row. The single-address "שלח בדיקה" path runs the same two
// checks before it sends, because a test copy of a פרסומת is still a פרסומת.
//
// Every message also ships RFC 8058 List-Unsubscribe headers pointing at the
// same signed endpoint as the footer link, so the mailbox provider's native
// unsubscribe button works without opening the mail.
//
// Sending is chunked and resumable: a 5-minute cron claims batches of 20 via
// claim_campaign_recipients (FOR UPDATE SKIP LOCKED), so the cron and an admin
// pressing "send now" can run concurrently without double-sending anyone.

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireAdmin } from "@/lib/admin-authz.server";
import {
  sendEmail,
  emailShell,
  esc,
  ils,
  isEmailConfigured,
  unsubscribeToken,
  unsubscribeUrl,
  listUnsubscribeHeaders,
} from "@/lib/email.server";
import { sellerIdentityLine, BUSINESS } from "@/lib/business";
// Read-only price helper — display formatting for the product cards. This
// module never computes or charges anything.
import { getEffectivePrice } from "@/lib/pricing";

/** PostgREST silently caps unbounded selects at 1000 — page every full walk. */
const DB_PAGE = 1000;
/** Recipients claimed per batch. */
const BATCH = 20;
/** Resend allows roughly 2 requests/second. */
const SEND_GAP_MS = 550;
/** A claim older than this means the sender died mid-batch. */
const STUCK_MINUTES = 15;
/** Max products a campaign can feature. */
const MAX_PRODUCTS = 8;

const stripHtml = (v: string) => v.replace(/<[^>]*>/g, "").trim();

type SnapshotProduct = {
  id: string;
  name: string;
  slug: string;
  thumbnail_url: string | null;
  price: number;
  sale_price: number | null;
};

// ---- Template ---------------------------------------------------------------

function productCards(products: SnapshotProduct[]): string {
  if (products.length === 0) return "";
  const cells = products.map((p) => {
    const url = `https://orzadik.com/product/${encodeURIComponent(p.slug)}`;
    const effective = getEffectivePrice(Number(p.price));
    const isCallOnly = Number(p.price) === 0;
    const priceHtml = isCallOnly
      ? `<div style="font-size:13px;color:#A8862A;">לפי שער הזהב</div>`
      : `<div style="font-size:13px;"><strong style="color:#A8862A;">${ils(effective)}</strong></div>`;
    return `<td width="50%" valign="top" style="padding:8px;">
      <a href="${esc(url)}" style="text-decoration:none;color:inherit;">
        ${p.thumbnail_url ? `<img src="${esc(p.thumbnail_url)}" width="240" alt="" style="width:100%;max-width:240px;border-radius:8px;display:block;">` : ""}
        <div style="font-size:14px;margin-top:8px;line-height:1.4;">${esc(p.name)}</div>
        ${priceHtml}
        <div style="margin-top:8px;">
          <span style="display:inline-block;background:#D4AF37;color:#fff;padding:8px 18px;border-radius:9999px;font-size:13px;">לצפייה במוצר</span>
        </div>
      </a>
    </td>`;
  });

  const rows: string[] = [];
  for (let i = 0; i < cells.length; i += 2) {
    rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
  }
  return `<table style="width:100%;border-collapse:collapse;margin-top:16px;">${rows.join("")}</table>`;
}

/**
 * Render a campaign for one recipient.
 *
 * The "פרסומת" label and the personal unsubscribe link are not optional
 * decoration — they are what makes the message lawful to send (§30א), which is
 * why they live in the single template builder rather than in each caller.
 */
function renderCampaign(
  campaign: { subject: string; intro_html: string; content: any },
  unsub: string | null,
): string {
  const products: SnapshotProduct[] = campaign.content?.products ?? [];
  const intro = esc(campaign.intro_html ?? "").replace(/\n/g, "<br>");
  return emailShell(`
    <p style="font-size:11px;color:#999;margin:0 0 8px;">פרסומת</p>
    <h1 style="font-size:20px;margin:0 0 12px;">${esc(campaign.subject)}</h1>
    ${intro ? `<div style="font-size:14px;color:#555;line-height:1.7;">${intro}</div>` : ""}
    ${productCards(products)}
    <div style="font-size:11px;color:#aaa;margin-top:24px;padding-top:12px;border-top:1px solid #eee;line-height:1.7;text-align:center;">
      <div>${esc(sellerIdentityLine())}${BUSINESS.email ? " · " + esc(BUSINESS.email) : ""}</div>
      <div style="margin-top:6px;">
        קיבלתם הודעה זו כי נרשמתם לרשימת התפוצה של אור זרוע לצדיק.
        ${unsub ? `<a href="${esc(unsub)}" style="color:#A8862A;">להסרה מרשימת התפוצה לחצו כאן</a>.` : ""}
      </div>
    </div>
  `);
}

/** Subject line as actually sent — always carries the פרסומת marking. */
function marketingSubject(subject: string): string {
  return `פרסומת: ${subject}`;
}

// ---- Admin: compose ---------------------------------------------------------

export const listCampaigns = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select(
      "id, subject, status, recipient_count, sent_count, failed_count, created_at, started_at, finished_at",
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[listCampaigns]:", error);
    throw new Error("שגיאה בטעינת הקמפיינים.");
  }
  return data ?? [];
});

export const getCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: row, error } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("הקמפיין לא נמצא.");
    return row;
  });

const SaveSchema = z.object({
  id: z.string().uuid().optional(),
  subject: z.string().trim().min(1).max(150).transform(stripHtml),
  intro: z.string().trim().max(2000).transform(stripHtml).optional().default(""),
  product_ids: z.array(z.string().uuid()).max(MAX_PRODUCTS).optional().default([]),
});

export const saveCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => SaveSchema.parse(i))
  .handler(async ({ data }) => {
    const adminId = await requireAdmin();

    // Snapshot the product cards server-side. The campaign then renders from
    // this frozen copy, so editing or deleting a product later can never
    // rewrite a mail that has already gone out.
    let products: SnapshotProduct[] = [];
    if (data.product_ids.length > 0) {
      const { data: rows, error } = await supabaseAdmin
        .from("products")
        .select("id, name, slug, thumbnail_url, price, sale_price")
        .in("id", data.product_ids);
      if (error) throw new Error("שגיאה בטעינת המוצרים.");
      const byId = new Map((rows ?? []).map((p) => [p.id, p]));
      // Preserve the order the admin picked them in.
      products = data.product_ids
        .map((id) => byId.get(id))
        .filter(Boolean)
        .map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          thumbnail_url: p.thumbnail_url,
          price: Number(p.price),
          sale_price: p.sale_price === null ? null : Number(p.sale_price),
        }));
    }

    const payload = {
      subject: data.subject,
      intro_html: data.intro ?? "",
      content: { products },
    };

    if (data.id) {
      // Only drafts are editable — a campaign in flight must not change under
      // the sender's feet.
      const { data: updated, error } = await supabaseAdmin
        .from("campaigns")
        .update(payload)
        .eq("id", data.id)
        .eq("status", "draft")
        .select("id")
        .maybeSingle();
      if (error) throw new Error("שגיאה בשמירת הקמפיין.");
      if (!updated) throw new Error("ניתן לערוך רק קמפיין בסטטוס טיוטה.");
      return { id: updated.id };
    }

    const { data: created, error } = await supabaseAdmin
      .from("campaigns")
      .insert({ ...payload, created_by: adminId })
      .select("id")
      .single();
    if (error) {
      console.error("[saveCampaign]:", error);
      throw new Error("שגיאה ביצירת הקמפיין.");
    }
    return { id: created.id };
  });

export const previewCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .select("subject, intro_html, content")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !campaign) throw new Error("הקמפיין לא נמצא.");
    return {
      subject: marketingSubject(campaign.subject),
      html: renderCampaign(campaign, "https://orzadik.com/api/public/unsubscribe?e=…&t=…"),
    };
  });

/** Product picker for the composer — mirrors the admin-products search. */
export const searchCampaignProducts = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ q: z.string().trim().max(120) }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const term = data.q.replace(/[,()%\\]/g, " ").replace(/\s+/g, " ").trim();
    if (!term) return [];
    const like = `%${term}%`;
    const { data: rows, error } = await supabaseAdmin
      .from("products")
      .select("id, name, slug, thumbnail_url, price, sale_price")
      .eq("is_active", true)
      .or(`name.ilike.${like},sku.ilike.${like}`)
      .limit(12);
    if (error) throw new Error("שגיאה בחיפוש מוצרים.");
    return rows ?? [];
  });

// ---- Admin: audience + lifecycle -------------------------------------------

/** Every consented address, minus the global suppression list. */
async function buildAudience(): Promise<Array<{ email: string; name: string | null }>> {
  const byEmail = new Map<string, { email: string; name: string | null }>();

  // Profiles with explicit marketing consent.
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("email, full_name")
      .eq("marketing_consent", true)
      .not("email", "is", null)
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error("שגיאה בבניית רשימת הנמענים.");
    for (const p of data ?? []) {
      const email = String(p.email ?? "").trim().toLowerCase();
      if (email) byEmail.set(email, { email, name: p.full_name ?? null });
    }
    if ((data ?? []).length < DB_PAGE) break;
  }

  // Newsletter subscribers still opted in. Written second so a subscriber row
  // (the more specific, more recent consent) wins on a name collision.
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("newsletter_subscribers")
      .select("email, name")
      .is("unsubscribed_at", null)
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error("שגיאה בבניית רשימת הנמענים.");
    for (const s of data ?? []) {
      const email = String(s.email ?? "").trim().toLowerCase();
      if (email) byEmail.set(email, { email, name: s.name ?? null });
    }
    if ((data ?? []).length < DB_PAGE) break;
  }

  // Global opt-out wins over everything, and so does an account that switched
  // marketing consent off: a profile row saying "false" is an explicit refusal,
  // and it must beat a stale newsletter_subscribers row for the same address.
  // Only an explicit false excludes — null/missing means "never asked", which
  // is the normal state of an anonymous newsletter signup.
  const [suppressed, revoked] = await Promise.all([
    loadSuppressions(),
    loadRevokedProfileEmails(),
  ]);
  return [...byEmail.values()].filter(
    (r) => !suppressed.has(r.email) && !revoked.has(r.email),
  );
}

/** Addresses of profiles that explicitly turned marketing consent off. */
async function loadRevokedProfileEmails(): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("marketing_consent", false)
      .not("email", "is", null)
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error("שגיאה בבניית רשימת הנמענים.");
    for (const r of data ?? []) {
      const email = String(r.email ?? "").trim().toLowerCase();
      if (email) out.add(email);
    }
    if ((data ?? []).length < DB_PAGE) break;
  }
  return out;
}

async function loadSuppressions(): Promise<Set<string>> {
  const out = new Set<string>();
  for (let from = 0; ; from += DB_PAGE) {
    const { data, error } = await supabaseAdmin
      .from("email_suppressions")
      .select("email")
      .range(from, from + DB_PAGE - 1);
    if (error) throw new Error("שגיאה בטעינת רשימת ההסרות.");
    for (const r of data ?? []) out.add(String(r.email).toLowerCase());
    if ((data ?? []).length < DB_PAGE) break;
  }
  return out;
}

/**
 * Dry run of the audience selection — how many addresses a send would reach.
 *
 * Reads only. Exists so the owner sees a real number *before* the first blast
 * instead of discovering the list size from the counter afterwards.
 */
export const previewCampaignAudience = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ total: number; sample: string[] }> => {
    await requireAdmin();
    const audience = await buildAudience();
    return {
      total: audience.length,
      sample: audience.slice(0, 5).map((r) => r.email),
    };
  },
);

const TestSendSchema = z.object({
  campaignId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email().max(255),
});

/**
 * Send the campaign to exactly one owner-supplied address.
 *
 * Deliberately shares renderCampaign() / marketingSubject() / unsubscribeToken()
 * with the real sender, so what the owner proofreads is the real message. It
 * never touches campaign_recipients and never writes a counter — the audience
 * is not consulted at all on this path, so it cannot enqueue or leak a send.
 *
 * The body is a real פרסומת, so the opt-out checks are NOT optional here either:
 * the address is run through email_suppressions and profiles.marketing_consent =
 * false exactly like a real recipient, and the send is refused if either says no.
 * A "test" that lands in the mailbox of someone who unsubscribed is still an
 * unlawful marketing message (§30א(ד)).
 *
 * The one exemption is the shop's own configured address: a proof copy the owner
 * sends to themselves is not marketing to a third party, and it must keep working
 * even if that address sits on the suppression list.
 */
export const sendCampaignTestEmail = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => TestSendSchema.parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!isEmailConfigured()) throw new Error("שליחת דוא\"ל אינה מוגדרת בשרת.");

    const email = data.email.trim().toLowerCase();
    const ownerEmail = (process.env.SHOP_OWNER_EMAIL ?? "").trim().toLowerCase();
    const isOwnerProof = ownerEmail.length > 0 && email === ownerEmail;

    if (!isOwnerProof) {
      // Fail closed: if the opt-out lists cannot be read we refuse to send rather
      // than guess. loadSuppressions/loadRevokedProfileEmails already throw Hebrew.
      const [suppressed, revoked] = await Promise.all([
        loadSuppressions(),
        loadRevokedProfileEmails(),
      ]);
      if (suppressed.has(email) || revoked.has(email)) {
        throw new Error("הכתובת הוסרה מרשימת התפוצה — לא ניתן לשלוח אליה דיוור.");
      }
    }

    const token = await unsubscribeToken(email);
    if (!token) {
      throw new Error("UNSUBSCRIBE_SECRET אינו מוגדר — לא ניתן לשלוח דיוור ללא קישור הסרה.");
    }

    const { data: campaign, error } = await supabaseAdmin
      .from("campaigns")
      .select("subject, intro_html, content")
      .eq("id", data.campaignId)
      .maybeSingle();
    if (error || !campaign) throw new Error("הקמפיין לא נמצא.");

    const unsub = unsubscribeUrl(email, token);
    const ok = await sendEmail({
      to: email,
      // Only the subject carries the test marking; the body is byte-identical
      // to a real send.
      subject: `[בדיקה] ${marketingSubject(campaign.subject)}`,
      html: renderCampaign(campaign, unsub),
      replyTo: process.env.SHOP_OWNER_EMAIL,
      headers: listUnsubscribeHeaders(unsub),
    });
    if (!ok) throw new Error("שליחת הבדיקה נכשלה. בדקו את הגדרות הדוא\"ל ונסו שוב.");
    return { ok: true as const, email };
  });

export const startCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    if (!isEmailConfigured()) throw new Error("שליחת דוא\"ל אינה מוגדרת בשרת.");
    // Without the secret we cannot produce a working unsubscribe link, and a
    // marketing message without one must not be sent at all.
    if (!process.env.UNSUBSCRIBE_SECRET) {
      throw new Error("UNSUBSCRIBE_SECRET אינו מוגדר — לא ניתן לשלוח דיוור ללא קישור הסרה.");
    }

    const audience = await buildAudience();
    if (audience.length === 0) throw new Error("אין נמענים ברשימת התפוצה.");

    // Claim the campaign first: the draft→sending transition is what stops a
    // second click from queueing the audience twice.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("campaigns")
      .update({
        status: "sending",
        started_at: new Date().toISOString(),
        recipient_count: audience.length,
        sent_count: 0,
        failed_count: 0,
      })
      .eq("id", data.id)
      .eq("status", "draft")
      .select("id")
      .maybeSingle();
    if (claimErr) throw new Error("שגיאה בהתחלת השליחה.");
    if (!claimed) throw new Error("ניתן להתחיל רק קמפיין בסטטוס טיוטה.");

    for (let i = 0; i < audience.length; i += 500) {
      const chunk = audience.slice(i, i + 500).map((r) => ({
        campaign_id: data.id,
        email: r.email,
        name: r.name,
      }));
      const { error } = await supabaseAdmin
        .from("campaign_recipients")
        .upsert(chunk, { onConflict: "campaign_id,email", ignoreDuplicates: true });
      if (error) {
        console.error("[startCampaign] recipient insert:", error);
        throw new Error("שגיאה בהוספת נמענים.");
      }
    }

    return { recipients: audience.length };
  });

export const cancelCampaign = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { error } = await supabaseAdmin
      .from("campaigns")
      .update({ status: "cancelled", finished_at: new Date().toISOString() })
      .eq("id", data.id)
      .in("status", ["draft", "sending"]);
    if (error) throw new Error("שגיאה בביטול הקמפיין.");
    // Drop everything not yet sent so the sender stops immediately.
    await supabaseAdmin
      .from("campaign_recipients")
      .delete()
      .eq("campaign_id", data.id)
      .in("status", ["pending", "sending"]);
    return { ok: true as const };
  });

// ---- Sender -----------------------------------------------------------------

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Outcome of one tick.
 *
 * `status` is the part that matters to the caller: "ok" is the ONLY value that
 * means the batch actually ran. Everything else is a reason nothing was sent,
 * and the admin renders it as an error instead of "0 נשלחו" — a silent zero was
 * indistinguishable from an empty queue and hid a misconfigured server.
 *
 * A type alias (not an interface) on purpose: handleCronRequest takes
 * `Record<string, unknown>`, and only aliases get an implicit index signature.
 */
export type CampaignTickResult = {
  status: "ok" | "email-not-configured" | "claim-failed" | "idle";
  campaign: string | null;
  sent: number;
  /** Real delivery failures only. */
  failed: number;
  /** Recipients passed over because they opted out — not a failure. */
  skipped: number;
  done: boolean;
  /** Human-readable Hebrew reason, present whenever status !== "ok". */
  error?: string;
};

/**
 * Send one batch for the oldest in-flight campaign.
 *
 * Shared by the cron route and the admin "send a batch now" button. Safe to run
 * concurrently with itself: rows are claimed atomically.
 */
export async function runCampaignTick(): Promise<CampaignTickResult> {
  if (!isEmailConfigured()) {
    console.error("[campaign-tick] email not configured — nothing sent");
    return {
      status: "email-not-configured",
      campaign: null,
      sent: 0,
      failed: 0,
      skipped: 0,
      done: false,
      error: "שליחת דוא\"ל אינה מוגדרת בשרת (RESEND_API_KEY / ORDER_EMAIL_FROM) — לא נשלחה אף הודעה.",
    };
  }

  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, subject, intro_html, content")
    .eq("status", "sending")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[campaign-tick] campaign lookup:", error);
    return {
      status: "claim-failed",
      campaign: null,
      sent: 0,
      failed: 0,
      skipped: 0,
      done: false,
      error: "שגיאה בטעינת הקמפיין הפעיל — לא נשלחה אף הודעה.",
    };
  }
  if (!campaign) {
    return { status: "idle", campaign: null, sent: 0, failed: 0, skipped: 0, done: false };
  }

  // Recover rows abandoned by a Worker that died mid-batch.
  const stuckBefore = new Date(Date.now() - STUCK_MINUTES * 60 * 1000).toISOString();
  const { error: recoverErr } = await supabaseAdmin
    .from("campaign_recipients")
    .update({ status: "pending", claimed_at: null })
    .eq("campaign_id", campaign.id)
    .eq("status", "sending")
    .lt("claimed_at", stuckBefore);
  if (recoverErr) console.error("[campaign-tick] stuck-row recovery:", recoverErr);

  const { data: claimed, error: claimErr } = await supabaseAdmin.rpc(
    "claim_campaign_recipients",
    { p_campaign_id: campaign.id, p_limit: BATCH },
  );
  if (claimErr) {
    console.error("[campaign-tick] claim failed:", claimErr);
    return {
      status: "claim-failed",
      campaign: campaign.id,
      sent: 0,
      failed: 0,
      skipped: 0,
      done: false,
      error: "שגיאה בשליפת נמענים לשליחה (claim_campaign_recipients) — לא נשלחה אף הודעה.",
    };
  }

  const rows = (claimed ?? []) as Array<{ id: string; email: string; name: string | null }>;

  // Re-check opt-outs every batch: someone may have unsubscribed since the
  // audience was frozen at start time.
  let suppressed = new Set<string>();
  try {
    suppressed = await loadSuppressions();
  } catch (e) {
    // Fail closed — release the claims and retry on the next tick rather than
    // risk mailing an address that has opted out.
    console.error("[campaign-tick] suppression load failed — releasing batch:", e);
    if (rows.length > 0) {
      await supabaseAdmin
        .from("campaign_recipients")
        .update({ status: "pending", claimed_at: null })
        .in("id", rows.map((r) => r.id));
    }
    return {
      status: "claim-failed",
      campaign: campaign.id,
      sent: 0,
      failed: 0,
      skipped: 0,
      done: false,
      error: "שגיאה בטעינת רשימת ההסרות — הקבוצה שוחררה ותישלח בניסיון הבא.",
    };
  }

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const row of rows) {
    const email = row.email.toLowerCase();
    if (suppressed.has(email)) {
      // An opt-out is a correct outcome, not a delivery failure. Its own status
      // keeps failed_count meaning "something went wrong" — the number the
      // owner is supposed to react to.
      await supabaseAdmin
        .from("campaign_recipients")
        .update({ status: "skipped", error: "unsubscribed" })
        .eq("id", row.id);
      skipped++;
      continue;
    }

    const token = await unsubscribeToken(email);
    if (!token) {
      await supabaseAdmin
        .from("campaign_recipients")
        .update({ status: "failed", error: "no unsubscribe secret" })
        .eq("id", row.id);
      failed++;
      continue;
    }

    const unsub = unsubscribeUrl(email, token);
    const ok = await sendEmail({
      to: row.email,
      subject: marketingSubject(campaign.subject),
      html: renderCampaign(campaign, unsub),
      replyTo: process.env.SHOP_OWNER_EMAIL,
      // One-click opt-out for the mailbox provider (RFC 8058) — the same URL as
      // the footer link, so both routes land on the same signed endpoint.
      headers: listUnsubscribeHeaders(unsub),
    });

    await supabaseAdmin
      .from("campaign_recipients")
      .update(
        ok
          ? { status: "sent", sent_at: new Date().toISOString(), error: null }
          : { status: "failed", error: "send failed" },
      )
      .eq("id", row.id);
    ok ? sent++ : failed++;

    // Resend allows ~2 req/s. This is I/O wait, not Worker CPU time.
    await sleep(SEND_GAP_MS);
  }

  // Authoritative counters straight from the queue (head counts, no row walk).
  const counts = await Promise.all(
    (["sent", "failed", "pending", "sending", "skipped"] as const).map((status) =>
      supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", status),
    ),
  );
  const [sentTotal, failedTotal, pendingTotal, sendingTotal, skippedTotal] = counts.map(
    (c) => c.count ?? 0,
  );
  // Skipped rows are terminal too, so they must not hold the campaign open.
  const done = pendingTotal === 0 && sendingTotal === 0;

  await supabaseAdmin
    .from("campaigns")
    .update({
      sent_count: sentTotal,
      failed_count: failedTotal,
      ...(done ? { status: "sent", finished_at: new Date().toISOString() } : {}),
    })
    .eq("id", campaign.id)
    .eq("status", "sending");

  console.log(
    `[campaign-tick] campaign=${campaign.id} batch_sent=${sent} batch_failed=${failed} batch_skipped=${skipped} total_skipped=${skippedTotal} remaining=${pendingTotal} done=${done}`,
  );
  return { status: "ok", campaign: campaign.id, sent, failed, skipped, done };
}

/** Admin-triggered "send a batch now". */
export const tickCampaign = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  return runCampaignTick();
});
