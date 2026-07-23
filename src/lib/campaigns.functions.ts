// Newsletter campaign composer + chunked sender.
//
// Audience rule, and the one that matters most: a campaign may ONLY go to
// addresses that gave marketing consent — newsletter_subscribers rows that are
// still open, and profiles with marketing_consent = true. orders.contact_consent
// is NEVER consulted; its checkout label promises those details are not used for
// marketing. Every address is then filtered through email_suppressions, both
// when the audience is built and again on each batch, so an unsubscribe that
// lands mid-send takes effect immediately.
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

  // Global opt-out wins over everything.
  const suppressed = await loadSuppressions();
  return [...byEmail.values()].filter((r) => !suppressed.has(r.email));
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
 * Send one batch for the oldest in-flight campaign.
 *
 * Shared by the cron route and the admin "send a batch now" button. Safe to run
 * concurrently with itself: rows are claimed atomically.
 */
export async function runCampaignTick(): Promise<{
  campaign: string | null;
  sent: number;
  failed: number;
  done: boolean;
}> {
  if (!isEmailConfigured()) return { campaign: null, sent: 0, failed: 0, done: false };

  const { data: campaign, error } = await supabaseAdmin
    .from("campaigns")
    .select("id, subject, intro_html, content")
    .eq("status", "sending")
    .order("started_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("[campaign-tick] campaign lookup:", error);
    return { campaign: null, sent: 0, failed: 0, done: false };
  }
  if (!campaign) return { campaign: null, sent: 0, failed: 0, done: false };

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
    return { campaign: campaign.id, sent: 0, failed: 0, done: false };
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
    return { campaign: campaign.id, sent: 0, failed: 0, done: false };
  }

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    const email = row.email.toLowerCase();
    if (suppressed.has(email)) {
      await supabaseAdmin
        .from("campaign_recipients")
        .update({ status: "failed", error: "unsubscribed" })
        .eq("id", row.id);
      failed++;
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

    const ok = await sendEmail({
      to: row.email,
      subject: marketingSubject(campaign.subject),
      html: renderCampaign(campaign, unsubscribeUrl(email, token)),
      replyTo: process.env.SHOP_OWNER_EMAIL,
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
    (["sent", "failed", "pending", "sending"] as const).map((status) =>
      supabaseAdmin
        .from("campaign_recipients")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaign.id)
        .eq("status", status),
    ),
  );
  const [sentTotal, failedTotal, pendingTotal, sendingTotal] = counts.map((c) => c.count ?? 0);
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
    `[campaign-tick] campaign=${campaign.id} batch_sent=${sent} batch_failed=${failed} remaining=${pendingTotal} done=${done}`,
  );
  return { campaign: campaign.id, sent, failed, done };
}

/** Admin-triggered "send a batch now". */
export const tickCampaign = createServerFn({ method: "POST" }).handler(async () => {
  await requireAdmin();
  return runCampaignTick();
});
