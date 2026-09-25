// The owner's morning briefing — what needs doing today, in one message.
//
// WHY IT EXISTS
// The CRM already knows everything below, but only if someone opens /admin and
// reads it. On 2026-09-24 all three paid orders in the shop had sat unmarked for
// 17-32 days and three card payments (₪2,777) had failed with nobody calling the
// customer back. Every one of those facts was on the dashboard. A dashboard is
// something you visit; a Telegram message at breakfast is something you read.
//
// PURE. This file takes rows and a clock and returns text. The fetching and the
// sending live in crm-digest.server.ts, so every claim the briefing makes is
// pinned by crm-digest.test.ts without a database or a network.
//
// WHAT IT DELIBERATELY LEAVES OUT
//   • Anything the owner cannot act on today. Revenue appears as one line of
//     context, not as a report; the dashboard is the report.
//   • A failed payment the customer already fixed. Most declined cards are
//     retried a few minutes later; listing the dead attempt next to the paid one
//     would send the owner to call someone who has already paid.

import { CONSUMER_POLICY } from "@/lib/business";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** Younger unpaid orders may still be sitting on the payment page. Same grace
 *  the dashboard and the action queue use. */
export const UNPAID_GRACE_MS = HOUR;
/** A failed payment older than this is no longer a warm lead; it stops being
 *  listed rather than nagging forever. */
export const FAILED_PAYMENT_WINDOW_DAYS = 30;
/** Same freshness window the action queue applies to abandoned carts. */
export const CART_WINDOW_DAYS = 14;
/** Rows listed per section; the rest is summarised as "ועוד N". */
const LIST_MAX = 5;

export type DigestOrder = {
  id: string;
  order_number: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  total: number | string | null;
  status: string;
  payment_status: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
};

export type DigestCart = {
  id: string;
  email: string | null;
  name: string | null;
  subtotal: number | string | null;
  created_at: string;
  converted_order_id: string | null;
  unsubscribed: boolean | null;
};

/** How far a paid order is into the delivery window the site promises. */
export type ShipUrgency = "ok" | "late" | "overdue";

/** One of the owner's own reminders (crm_followups), due today or overdue. */
export type DigestFollowUp = {
  title: string;
  /** The customer's name when the shop knows it, else their email. */
  who: string;
  daysOverdue: number;
};

export type Digest = {
  /** The owner's own reminders come first: they are the only items in the
   *  briefing somebody deliberately asked to be told about. */
  followUps: DigestFollowUp[];
  toShip: {
    orderNumber: string;
    name: string;
    phone: string;
    total: number;
    businessDays: number;
    urgency: ShipUrgency;
  }[];
  failedPayments: {
    orderNumber: string;
    name: string;
    phone: string;
    total: number;
    daysAgo: number;
  }[];
  openCarts: { count: number; value: number; top: { name: string; value: number }[] };
  last24h: { paidCount: number; revenue: number };
  last7d: { paidCount: number; revenue: number };
  pendingReviews: number;
  /** Anything in the briefing the owner has to DO. When false the scheduled
   *  run stays silent — a daily "nothing to report" teaches people to ignore
   *  the channel. */
  actionable: boolean;
};

const num = (v: unknown) => Number(v) || 0;
const clean = (v: unknown) => String(v ?? "").trim();
const emailKey = (v: unknown) => clean(v).toLowerCase();
const phoneKey = (v: unknown) => clean(v).replace(/\D/g, "").replace(/^972/, "0");

/**
 * Israeli business days (Sunday-Thursday) from `fromMs` to `toMs`, counting
 * whole days after the start day. Holidays are not modelled: the error is at
 * most a few days a year, always in the direction of warning earlier.
 *
 * The promise on the site is "3-14 ימי עסקים", so this — not calendar days —
 * is the clock the customer is holding the shop to.
 */
export function businessDaysBetween(fromMs: number, toMs: number): number {
  if (!(toMs > fromMs)) return 0;
  const start = new Date(fromMs);
  start.setUTCHours(0, 0, 0, 0);
  const whole = Math.floor((toMs - start.getTime()) / DAY);
  let n = 0;
  for (let i = 1; i <= whole; i++) {
    const dow = new Date(start.getTime() + i * DAY).getUTCDay();
    if (dow !== 5 && dow !== 6) n++;
  }
  return n;
}

/** Tie the warning to the numbers the customer was actually shown. */
export function shipUrgency(businessDays: number): ShipUrgency {
  if (businessDays >= CONSUMER_POLICY.deliveryMaxDays) return "overdue";
  if (businessDays >= CONSUMER_POLICY.deliveryMinDays) return "late";
  return "ok";
}

const isPaidish = (o: { payment_status: string }) =>
  o.payment_status === "paid" || o.payment_status === "refunded";
const isClosed = (o: { status: string }) => ["cancelled", "refunded"].includes(o.status);
const paidAtMs = (o: DigestOrder) => new Date(o.paid_at ?? o.created_at).getTime();

/** The fields the recovery check reads — shared with the admin action queue. */
export type RecoveryOrder = Pick<
  DigestOrder,
  "customer_email" | "customer_phone" | "payment_status" | "created_at" | "status"
>;

/**
 * A predicate: was this unpaid attempt later fixed by the same person paying?
 * "Same person" is the same email OR the same phone — people retype one of
 * them — and "later" means a paid order placed at or after the attempt.
 *
 * Shared by the morning briefing and the admin's "מה לעשות היום" queue, so the
 * two can never disagree about who is worth a call.
 */
export function recoveredBy(orders: RecoveryOrder[]): (o: RecoveryOrder) => boolean {
  const paidByEmail = new Map<string, number[]>();
  const paidByPhone = new Map<string, number[]>();
  for (const o of orders) {
    if (!isPaidish(o)) continue;
    const t = new Date(o.created_at).getTime();
    for (const [map, key] of [
      [paidByEmail, emailKey(o.customer_email)],
      [paidByPhone, phoneKey(o.customer_phone)],
    ] as const) {
      if (key) map.set(key, [...(map.get(key) ?? []), t]);
    }
  }
  const paidSince = (key: string, map: Map<string, number[]>, since: number) =>
    !!key && (map.get(key) ?? []).some((t) => t >= since);
  return (o) => {
    const created = new Date(o.created_at).getTime();
    return (
      paidSince(emailKey(o.customer_email), paidByEmail, created) ||
      paidSince(phoneKey(o.customer_phone), paidByPhone, created)
    );
  };
}

/** An unpaid or failed order still worth a call: past the grace hour (they may
 *  still be on the payment page), inside the window, not cancelled, and not
 *  recovered by a later payment. */
export function isOpenFailedPayment(
  o: RecoveryOrder,
  now: number,
  recovered: (o: RecoveryOrder) => boolean,
): boolean {
  if (!["unpaid", "failed"].includes(o.payment_status) || isClosed(o)) return false;
  const age = now - new Date(o.created_at).getTime();
  if (age <= UNPAID_GRACE_MS || age > FAILED_PAYMENT_WINDOW_DAYS * DAY) return false;
  return !recovered(o);
}

export function buildDigest(
  orders: DigestOrder[],
  carts: DigestCart[],
  pendingReviews: number,
  now: number = Date.now(),
  extras: {
    /** Queue items the owner snoozed or dismissed ("<type>:<id>") — set aside
     *  in the admin, so the briefing does not bring them back either. */
    hidden?: Set<string>;
    followUps?: DigestFollowUp[];
  } = {},
): Digest {
  const hidden = extras.hidden ?? new Set<string>();
  const followUps = extras.followUps ?? [];
  // Paid, not shipped, not closed — the same predicate as the dashboard's
  // "ready to ship", oldest first so the longest wait leads.
  const toShip = orders
    .filter(
      (o) =>
        o.payment_status === "paid" &&
        !o.shipped_at &&
        ["pending", "processing"].includes(o.status) &&
        !hidden.has(`ready_to_ship:${o.id}`),
    )
    .sort((a, b) => paidAtMs(a) - paidAtMs(b))
    .map((o) => {
      const businessDays = businessDaysBetween(paidAtMs(o), now);
      return {
        orderNumber: clean(o.order_number),
        name: clean(o.customer_name) || "לקוח",
        phone: clean(o.customer_phone),
        total: num(o.total),
        businessDays,
        urgency: shipUrgency(businessDays),
      };
    });

  const recovered = recoveredBy(orders);
  const failedPayments = orders
    .filter((o) => isOpenFailedPayment(o, now, recovered) && !hidden.has(`stuck_unpaid:${o.id}`))
    .sort((a, b) => num(b.total) - num(a.total))
    .map((o) => ({
      orderNumber: clean(o.order_number),
      name: clean(o.customer_name) || "לקוח",
      phone: clean(o.customer_phone),
      total: num(o.total),
      daysAgo: Math.floor((now - new Date(o.created_at).getTime()) / DAY),
    }));

  // Same recoverable-cart predicate as the action queue.
  const open = carts
    .filter((c) => {
      const age = now - new Date(c.created_at).getTime();
      return (
        !c.converted_order_id &&
        !c.unsubscribed &&
        num(c.subtotal) > 0 &&
        age > HOUR &&
        age <= CART_WINDOW_DAYS * DAY &&
        !hidden.has(`recover_cart:${c.id}`)
      );
    })
    .sort((a, b) => num(b.subtotal) - num(a.subtotal));
  const openCarts = {
    count: open.length,
    value: open.reduce((s, c) => s + num(c.subtotal), 0),
    top: open.slice(0, 3).map((c) => ({ name: clean(c.name) || "ללא שם", value: num(c.subtotal) })),
  };

  const paidWithin = (ms: number) => {
    const rows = orders.filter(
      (o) => isPaidish(o) && now - paidAtMs(o) <= ms && paidAtMs(o) <= now,
    );
    return { paidCount: rows.length, revenue: rows.reduce((s, o) => s + num(o.total), 0) };
  };

  return {
    followUps,
    toShip,
    failedPayments,
    openCarts,
    last24h: paidWithin(DAY),
    last7d: paidWithin(7 * DAY),
    pendingReviews,
    actionable:
      followUps.length > 0 ||
      toShip.length > 0 ||
      failedPayments.length > 0 ||
      openCarts.count > 0 ||
      pendingReviews > 0,
  };
}

// ---- Rendering ---------------------------------------------------------------

/** ₪1,437 — whole shekels, the way the rest of the admin prints money. */
export function shekels(n: number): string {
  return `₪${Math.round(n).toLocaleString("en-US")}`;
}

/** Only these three matter in Telegram's HTML mode, but they matter absolutely:
 *  one stray `<` in a customer name makes the whole message a 400. */
function tg(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

const URGENCY_MARK: Record<ShipUrgency, string> = { ok: "🟢", late: "🟠", overdue: "🔴" };

function dayWord(n: number, one: string, many: string): string {
  return n === 1 ? one : `${n} ${many}`;
}

/** "יום חמישי, 24.9" in Israel time, whatever zone the Worker runs in. */
export function digestDateLabel(now: number): string {
  try {
    return new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      weekday: "long",
      day: "numeric",
      month: "numeric",
    }).format(new Date(now));
  } catch {
    return new Date(now).toISOString().slice(0, 10);
  }
}

/** The briefing as one Telegram HTML message. */
export function renderDigestTelegram(d: Digest, now: number, origin: string): string {
  let m = `☀️ <b>סיכום בוקר · ${tg(digestDateLabel(now))}</b>\n`;

  if (!d.actionable) {
    m += `\nאין משימות פתוחות היום ✨\n`;
  }

  if (d.followUps.length > 0) {
    m += `\n🔔 <b>תזכורות להיום (${d.followUps.length})</b>\n`;
    for (const f of d.followUps.slice(0, LIST_MAX)) {
      m += `• ${tg(f.title)} · ${tg(f.who)}${f.daysOverdue > 0 ? ` · באיחור ${dayWord(f.daysOverdue, "של יום", "ימים")}` : ""}\n`;
    }
    if (d.followUps.length > LIST_MAX) m += `ועוד ${d.followUps.length - LIST_MAX}\n`;
  }

  if (d.toShip.length > 0) {
    m += `\n📦 <b>ממתינות למשלוח (${d.toShip.length})</b>\n`;
    for (const o of d.toShip.slice(0, LIST_MAX)) {
      m += `${URGENCY_MARK[o.urgency]} ${tg(o.orderNumber)} · ${tg(o.name)} · ${shekels(o.total)} · ${dayWord(o.businessDays, "יום עסקים אחד", "ימי עסקים")}\n`;
    }
    if (d.toShip.length > LIST_MAX) m += `ועוד ${d.toShip.length - LIST_MAX}\n`;
    if (d.toShip.some((o) => o.urgency === "overdue")) {
      m += `🔴 = עבר את ${CONSUMER_POLICY.deliveryMaxDays} ימי העסקים שהאתר מבטיח.\n`;
    }
    m += `נשלח כבר? סמנו "נשלח" עם מספר מעקב — הלקוח יקבל מייל מעקב אוטומטי.\n`;
  }

  if (d.failedPayments.length > 0) {
    const sum = d.failedPayments.reduce((s, o) => s + o.total, 0);
    m += `\n💳 <b>תשלום שלא הושלם (${d.failedPayments.length}) · ${shekels(sum)}</b>\n`;
    for (const o of d.failedPayments.slice(0, LIST_MAX)) {
      const when = o.daysAgo === 0 ? "היום" : `לפני ${dayWord(o.daysAgo, "יום", "ימים")}`;
      m += `• ${tg(o.orderNumber)} · ${tg(o.name)} · ${shekels(o.total)} · ${when}${o.phone ? ` · ${tg(o.phone)}` : ""}\n`;
    }
    if (d.failedPayments.length > LIST_MAX) m += `ועוד ${d.failedPayments.length - LIST_MAX}\n`;
    m += `שווה שיחה — הלקוח כבר מילא את כל הפרטים ורצה לקנות.\n`;
  }

  if (d.openCarts.count > 0) {
    m += `\n🛒 <b>עגלות פתוחות (${d.openCarts.count}) · ${shekels(d.openCarts.value)}</b>\n`;
    for (const c of d.openCarts.top) m += `• ${tg(c.name)} · ${shekels(c.value)}\n`;
  }

  if (d.pendingReviews > 0) {
    m += `\n⭐ <b>${d.pendingReviews === 1 ? "חוות דעת אחת ממתינה" : `${d.pendingReviews} חוות דעת ממתינות`} לאישור</b>\n`;
  }

  m += `\n💰 24 שעות: ${d.last24h.paidCount} הזמנות · ${shekels(d.last24h.revenue)}`;
  m += `\n📈 7 ימים: ${d.last7d.paidCount} הזמנות · ${shekels(d.last7d.revenue)}\n`;
  m += `\n${origin}/admin`;
  return m;
}

/** Email-safe escaping (the attribute quote too — names land in markup). */
function h(v: unknown): string {
  return tg(v).replace(/"/g, "&quot;");
}

/** The briefing's inner HTML for emailShell(): the same sections, as tables. */
export function renderDigestEmailInner(d: Digest, now: number, origin: string): string {
  const cell = "padding:6px 0;border-bottom:1px solid #F0E8D4;font-size:14px;";
  const section = (title: string, rows: string, foot = "") =>
    `<h3 style="margin:22px 0 6px;font-size:16px;color:#2b2b2b;">${title}</h3>` +
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>` +
    (foot
      ? `<p class="oz-muted" style="margin:8px 0 0;font-size:13px;color:#6B6258;">${foot}</p>`
      : "");

  let html = `<h2 style="margin:0 0 4px;font-size:20px;">סיכום בוקר</h2>`;
  html += `<p class="oz-muted" style="margin:0;color:#6B6258;font-size:13px;">${h(digestDateLabel(now))}</p>`;

  if (!d.actionable) {
    html += `<p style="margin:18px 0 0;">אין משימות פתוחות היום ✨</p>`;
  }

  if (d.followUps.length > 0) {
    const rows = d.followUps
      .slice(0, LIST_MAX)
      .map(
        (f) =>
          `<tr><td style="${cell}">${h(f.title)} · ${h(f.who)}</td>` +
          `<td style="${cell}text-align:left;white-space:nowrap;">${f.daysOverdue > 0 ? `באיחור ${dayWord(f.daysOverdue, "של יום", "ימים")}` : "היום"}</td></tr>`,
      )
      .join("");
    html += section(`🔔 תזכורות להיום (${d.followUps.length})`, rows);
  }

  if (d.toShip.length > 0) {
    const rows = d.toShip
      .slice(0, LIST_MAX)
      .map(
        (o) =>
          `<tr><td style="${cell}">${URGENCY_MARK[o.urgency]} ${h(o.orderNumber)} · ${h(o.name)}</td>` +
          `<td style="${cell}text-align:left;white-space:nowrap;">${shekels(o.total)} · ${o.businessDays} ימי עסקים</td></tr>`,
      )
      .join("");
    html += section(
      `📦 ממתינות למשלוח (${d.toShip.length})`,
      rows,
      `נשלח כבר? סמנו "נשלח" עם מספר מעקב בניהול ההזמנות — הלקוח יקבל מייל מעקב אוטומטי.` +
        (d.toShip.some((o) => o.urgency === "overdue")
          ? ` 🔴 = עבר את ${CONSUMER_POLICY.deliveryMaxDays} ימי העסקים שהאתר מבטיח.`
          : ""),
    );
  }

  if (d.failedPayments.length > 0) {
    const rows = d.failedPayments
      .slice(0, LIST_MAX)
      .map(
        (o) =>
          `<tr><td style="${cell}">${h(o.orderNumber)} · ${h(o.name)}${o.phone ? ` · ${h(o.phone)}` : ""}</td>` +
          `<td style="${cell}text-align:left;white-space:nowrap;">${shekels(o.total)} · לפני ${o.daysAgo} ימים</td></tr>`,
      )
      .join("");
    html += section(
      `💳 תשלום שלא הושלם (${d.failedPayments.length})`,
      rows,
      "שווה שיחה — הלקוח כבר מילא את כל הפרטים ורצה לקנות.",
    );
  }

  if (d.openCarts.count > 0) {
    const rows = d.openCarts.top
      .map(
        (c) =>
          `<tr><td style="${cell}">${h(c.name)}</td><td style="${cell}text-align:left;">${shekels(c.value)}</td></tr>`,
      )
      .join("");
    html += section(`🛒 עגלות פתוחות (${d.openCarts.count}) · ${shekels(d.openCarts.value)}`, rows);
  }

  if (d.pendingReviews > 0) {
    html += `<p style="margin:22px 0 0;font-size:15px;">⭐ ${d.pendingReviews} חוות דעת ממתינות לאישור</p>`;
  }

  html +=
    `<p class="oz-muted" style="margin:22px 0 0;font-size:13px;color:#6B6258;">` +
    `24 שעות: ${d.last24h.paidCount} הזמנות · ${shekels(d.last24h.revenue)}<br>` +
    `7 ימים: ${d.last7d.paidCount} הזמנות · ${shekels(d.last7d.revenue)}</p>`;
  html += `<p style="margin:18px 0 0;"><a href="${h(origin)}/admin" style="color:#7E611E;font-weight:bold;">לפאנל הניהול ←</a></p>`;
  return html;
}

/** Subject line that says the most urgent thing, so the inbox preview alone is
 *  enough to know whether to open it. */
export function digestSubject(d: Digest): string {
  const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);
  const parts: string[] = [];
  if (d.followUps.length) parts.push(count(d.followUps.length, "תזכורת אחת", "תזכורות"));
  if (d.toShip.length)
    parts.push(count(d.toShip.length, "הזמנה אחת ממתינה למשלוח", "ממתינות למשלוח"));
  if (d.failedPayments.length)
    parts.push(count(d.failedPayments.length, "תשלום אחד לא הושלם", "תשלומים לא הושלמו"));
  if (d.openCarts.count) parts.push(count(d.openCarts.count, "עגלה פתוחה אחת", "עגלות פתוחות"));
  if (d.pendingReviews)
    parts.push(count(d.pendingReviews, "חוות דעת אחת לאישור", "חוות דעת לאישור"));
  return parts.length ? `סיכום בוקר: ${parts.join(" · ")}` : "סיכום בוקר: אין משימות פתוחות";
}
