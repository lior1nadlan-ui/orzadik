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

/**
 * Tiny HTML→plaintext fallback for the multipart/alternative text part.
 *
 * A message with no text/plain part is a well-known spam signal, so sendEmail
 * always ships one. This is intentionally small: drop head/style/script, turn
 * block boundaries into line breaks, strip remaining tags, then decode the
 * entities we actually emit — the four from esc() (&amp; last, so "&amp;lt;"
 * round-trips to "&lt;" not "<") plus the numeric refs used by the preheader
 * spacer — and finally drop the zero-width / combining layout characters so
 * none of that scaffolding leaks into the plaintext. A deliverability fallback,
 * not a faithful renderer.
 */
export function htmlToText(html: string): string {
  return (
    String(html ?? "")
      .replace(/<!doctype[^>]*>/gi, "")
      .replace(/<head[\s\S]*?<\/head>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .replace(/<\/(p|div|tr|h[1-6]|table|li|ul|ol)>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&nbsp;/gi, " ")
      .replace(/&zwnj;/gi, "\u200c")
      .replace(/&#(\d+);/g, (_, n) => {
        try {
          return String.fromCodePoint(Number(n));
        } catch {
          return "";
        }
      })
      .replace(/&amp;/g, "&")
      // Invisible scaffolding: zero-width marks, BOM, and the combining range that
      // includes the spacer's U+034F. Hebrew niqqud (U+05B0+) is outside this.
      // no-misleading-character-class fires because the class holds combining
      // marks that can form a grapheme with the character before them — which is
      // exactly what this strip is for: the marks are removed individually, on
      // purpose, and there is no surrounding base character to preserve.
      // eslint-disable-next-line no-misleading-character-class
      .replace(/[\u200b-\u200f\u2060\ufeff\u034f\u0300-\u036f]/g, "")
      .replace(/[ \t]+/g, " ")
      .split("\n")
      .map((l) => l.trim())
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Wrap inner HTML in the branded RTL shell.
 *
 * `preheader` is the hidden inbox-preview line clients show next to the subject.
 * Passing an honest, tailored line per template stops the client from scraping
 * whatever visible text lands first (often a bare "פרסומת" marker or a URL). The
 * hidden div is followed by a whitespace spacer so the following body copy is
 * not pulled into the snippet.
 *
 * Dark mode: <meta name="color-scheme"> opts every client into proper theming,
 * and the @media(prefers-color-scheme:dark) block pins the card background,
 * border and text and shifts the gold to a contrast-safe shade so Gmail/Apple
 * dark mode can't wash the brand out. Structural elements carry class hooks
 * (oz-body/oz-card/oz-muted/oz-gold/oz-btn); the light inline colors stay as the
 * default for clients that ignore <style>, and the dark rules override them only
 * where prefers-color-scheme:dark is honoured.
 */
export function emailShell(inner: string, preheader?: string): string {
  const preheaderBlock = preheader
    ? `<div style="display:none;max-height:0;max-width:0;overflow:hidden;opacity:0;mso-hide:all;font-size:1px;line-height:1px;color:#FAF6E9;">${esc(preheader)}</div><div style="display:none;max-height:0;max-width:0;overflow:hidden;">${"&#847;&zwnj;&nbsp;".repeat(40)}</div>`
    : "";
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <style>
    @media (prefers-color-scheme: dark) {
      .oz-body { background:#17150f !important; }
      .oz-card { background:#262219 !important; border-color:#4a4226 !important; color:#ece7d8 !important; }
      .oz-muted { color:#b7b09e !important; }
      .oz-gold { color:#E4C77E !important; }
      .oz-btn a { color:#ffffff !important; }
    }
  </style>
  </head>
  <body class="oz-body" style="margin:0;background:#FAF6E9;font-family:Arial,Helvetica,sans-serif;color:#2b2b2b;">
    ${preheaderBlock}
    <div style="max-width:560px;margin:0 auto;padding:24px;">
      <div style="text-align:center;margin-bottom:16px;">
        <div class="oz-gold" style="font-size:22px;font-weight:bold;color:#A8862A;">אור זרוע לצדיק</div>
        <div class="oz-muted" style="font-size:12px;color:#888;">תשמישי קדושה</div>
      </div>
      <div class="oz-card" style="background:#fff;border:1px solid #EADFBE;border-radius:12px;padding:24px;">
        ${inner}
      </div>
      <div class="oz-muted" style="text-align:center;font-size:11px;color:#999;margin-top:16px;">
        orzadik.com
      </div>
    </div>
  </body></html>`;
}

/**
 * One shared, bulletproof CTA button (table + VML) used across every template.
 *
 * The `<a>` renders everywhere; the VML `<v:roundrect>` gives Outlook desktop
 * (Word engine, no padding/border-radius on links) a real filled pill. Default
 * fill is the brand accent (#7E611E) with white text — a ~6.5:1 contrast pair
 * that stays legible in light and dark. `href` is escaped; `label` is plain
 * literal copy. The VML width is estimated from the label length, which is all
 * Outlook needs to size the pill.
 */
export function emailButton(href: string, label: string, bg = "#7E611E"): string {
  const safeHref = esc(href);
  const safeLabel = esc(label);
  const width = Math.max(180, Math.round(label.length * 11) + 60);
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:20px auto 4px;">
      <tr><td align="center" bgcolor="${bg}" class="oz-btn" style="border-radius:9999px;">
        <!--[if mso]>
        <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:44px;v-text-anchor:middle;width:${width}px;" arcsize="50%" strokecolor="${bg}" fillcolor="${bg}">
        <w:anchorlock/>
        <center style="color:#ffffff;font-family:Arial,sans-serif;font-size:15px;font-weight:bold;">${safeLabel}</center>
        </v:roundrect>
        <![endif]-->
        <!--[if !mso]><!-- -->
        <a href="${safeHref}" target="_blank" style="display:inline-block;background:${bg};color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:9999px;font-weight:bold;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;">${safeLabel}</a>
        <!--<![endif]-->
      </td></tr>
    </table>`;
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
  /**
   * Plain-text alternative. Optional: when omitted we derive one from the HTML
   * so every message goes out multipart/alternative — a missing text/plain part
   * is a spam-filter signal on its own.
   */
  text?: string;
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
        // Always include a text part (given or derived) so the message is
        // multipart/alternative rather than HTML-only.
        text: opts.text ?? htmlToText(opts.html),
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
        ...(opts.headers && Object.keys(opts.headers).length > 0 ? { headers: opts.headers } : {}),
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
