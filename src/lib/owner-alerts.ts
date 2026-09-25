// Telegram texts for the two things a customer can send the shop besides an
// order: a message from the contact form, and a product review waiting for
// approval. Pure builders, so the escaping is tested without a network; the
// sending is in owner-alerts.server.ts.
//
// Telegram HTML mode: only & < > need escaping, but they need it absolutely —
// one stray "<" in a customer's message turns the whole alert into a 400 and
// the owner hears nothing.

const tg = (v: unknown) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** wa.me wants the number in international form without the plus. */
function waUrl(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  return `https://wa.me/${digits.startsWith("0") ? `972${digits.slice(1)}` : digits}`;
}

export function buildContactAlert(m: {
  name: string;
  email: string;
  phone?: string | null;
  message: string;
}): string {
  const phone = (m.phone ?? "").trim();
  const wa = phone ? waUrl(phone) : null;
  let t = `✉️ <b>פנייה חדשה מהאתר</b>\n\n`;
  t += `<b>שם:</b> ${tg(m.name)}\n`;
  if (phone) t += `<b>טלפון:</b> ${tg(phone)}${wa ? ` · <a href="${wa}">וואטסאפ</a>` : ""}\n`;
  t += `<b>אימייל:</b> ${tg(m.email)}\n\n`;
  t += `${tg(clip(m.message.trim(), 2500))}\n\n`;
  t += `להשיב: Reply למייל ששלחנו, או ישירות בטלפון / וואטסאפ.`;
  return t;
}

export function buildReviewAlert(
  r: {
    productName: string | null;
    rating: number;
    title?: string | null;
    body?: string | null;
    author: string;
    verified: boolean;
  },
  origin: string,
): string {
  const stars = "★".repeat(Math.max(1, Math.min(5, Math.round(r.rating))));
  let t = `⭐ <b>חוות דעת חדשה ממתינה לאישור</b>\n\n`;
  if (r.productName) t += `<b>${tg(r.productName)}</b>\n`;
  t += `${stars} · ${tg(r.author)}${r.verified ? " · קונה מאומת" : ""}\n`;
  if (r.title) t += `\n<b>${tg(clip(r.title, 200))}</b>\n`;
  if (r.body) t += `${tg(clip(r.body, 1200))}\n`;
  t += `\nלאישור או הסתרה: ${origin}/admin/reviews`;
  return t;
}
