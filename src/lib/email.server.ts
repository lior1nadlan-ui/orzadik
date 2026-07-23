// Shared transactional-email helper (Resend REST via fetch — no dependency).
//
// Env:
//   RESEND_API_KEY   – Resend API key (required to actually send)
//   ORDER_EMAIL_FROM – verified sender, e.g. "אור זרוע לצדיק <orders@orzadik.com>"
//   SHOP_OWNER_EMAIL – owner inbox for alerts
// If the key/sender are missing, isEmailConfigured() is false and callers no-op.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_FROM);
}

export function ils(n: number) {
  return new Intl.NumberFormat("he-IL", {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);
}

/** Minimal HTML escaping for user-supplied strings rendered into emails. */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap inner HTML in the branded RTL shell. */
export function emailShell(inner: string): string {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"></head>
  <body style="margin:0;background:#FAF6E9;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div style="font-size:22px;font-weight:bold;color:#A8862A;">אור זרוע לצדיק</div>
        <div style="font-size:12px;color:#888;">תשמישי קדושה</div>
      </div>
      <div style="background:#fff;border:1px solid #EADFBE;border-radius:12px;padding:24px;">
        ${inner}
      </div>
      <div style="text-align:center;font-size:11px;color:#999;margin-top:16px;">
        orzadik.com
      </div>
    </div>
  </body></html>`;
}

// ── Unsubscribe token (Spam Law §30א: every marketing message needs a working
// opt-out). Signed with UNSUBSCRIBE_SECRET so links can't be forged. Uses Web
// Crypto (available in the Workers runtime and modern Node).
async function hmacHex(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message.toLowerCase()));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function unsubscribeToken(email: string): Promise<string | null> {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret) return null;
  return hmacHex(email, secret);
}

export async function verifyUnsubscribeToken(email: string, token: string): Promise<boolean> {
  const secret = process.env.UNSUBSCRIBE_SECRET;
  if (!secret || !token) return false;
  const expected = await hmacHex(email, secret);
  const given = token.toLowerCase();
  if (expected.length !== given.length) return false;
  // constant-time-ish comparison
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ given.charCodeAt(i);
  return diff === 0;
}

export function unsubscribeUrl(email: string, token: string): string {
  return `https://orzadik.com/api/public/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`;
}

/**
 * RFC 8058 one-click opt-out headers for a bulk message.
 *
 * Gmail/Yahoo bulk-sender rules expect these on marketing mail, and the pair
 * only works together: List-Unsubscribe-Post makes the mailbox provider POST
 * the URL itself instead of opening it, which /api/public/unsubscribe already
 * accepts (it registers both GET and POST).
 */
export function listUnsubscribeHeaders(url: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  /** Extra RFC headers (e.g. List-Unsubscribe). Omitted from the body when empty. */
  headers?: Record<string, string>;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ORDER_EMAIL_FROM;
  if (!apiKey || !from) {
    console.log("[email] not configured — skipping send to", opts.to);
    return false;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        ...(opts.headers && Object.keys(opts.headers).length > 0
          ? { headers: opts.headers }
          : {}),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[email] Resend HTTP ${res.status}: ${body.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[email] send failed:", e);
    return false;
  } finally {
    clearTimeout(timer);
  }
}
