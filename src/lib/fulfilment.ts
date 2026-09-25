// Recording an order that already reached the customer.
//
// WHY. Three paid orders sat unmarked for 17-32 days. The only button was
// "סמן כנשלחה ושלח מייל ללקוח", and pressing it that late does two wrong
// things at once: it mails "ההזמנה שלך בדרך!" about a parcel the customer
// opened weeks ago, and it stamps TODAY as the ship date — so the review
// request, which waits 7 days after shipping, slides a further week away. An
// owner who can see both problems reasonably leaves the order alone, and then
// no review request goes out at all.
//
// The honest record is the day the parcel actually left, with no "on its way"
// email. This module turns the date the owner types into that timestamp, and
// says in advance what the morning review-request job will then do with it, so
// the owner is not guessing. Pure: no database, no clock of its own.

import { dateInputValue, israelOffsetMs } from "@/lib/crm-tasks";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** runReviewRequests() asks this many days after shipped_at… */
export const REVIEW_REQUEST_DELAY_DAYS = 7;
/** …and stops looking at an order this many days after it. */
export const REVIEW_REQUEST_MAX_AGE_DAYS = 30;
/** The morning cron ("0 7 * * *" in wrangler.jsonc) that runs the job. */
const REVIEW_RUN_UTC_HOUR = 7;

/** An order the owner has not marked this many days after payment has most
 *  likely gone out already — the point to offer "כבר נמסרה". */
export const LIKELY_DELIVERED_AFTER_DAYS = 5;

export type ShipDateResult = { ok: true; iso: string } | { ok: false; error: string };

/**
 * The shipped_at for a date picked in the admin ("YYYY-MM-DD", Israel time).
 * Noon that day — the middle of the working day, so the stamp reads as that
 * date in any timezone the admin is viewed from — clamped so it is never
 * before the order existed and never in the future.
 */
export function shippedAtFromDateInput(
  ymd: string,
  opts: { notBefore: number; now: number },
): ShipDateResult {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return { ok: false, error: "תאריך לא תקין." };
  // YYYY-MM-DD compares correctly as a string.
  if (ymd > dateInputValue(opts.now)) return { ok: false, error: "התאריך עוד לא הגיע." };
  if (ymd < dateInputValue(opts.notBefore)) {
    return { ok: false, error: "התאריך מוקדם מהיום שבו ההזמנה בוצעה." };
  }
  const noonUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12);
  const t = noonUtc - israelOffsetMs(noonUtc);
  if (!Number.isFinite(t)) return { ok: false, error: "תאריך לא תקין." };
  return { ok: true, iso: new Date(Math.min(Math.max(t, opts.notBefore), opts.now)).toISOString() };
}

/** The first run of the morning job strictly after `t`. */
function nextRunAfter(t: number): number {
  const d = new Date(t);
  let run = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), REVIEW_RUN_UTC_HOUR);
  if (run <= t) run += DAY;
  return run;
}

export type ReviewOutlook =
  | { kind: "sent"; at: string }
  | { kind: "no-consent" }
  | { kind: "too-old" }
  | { kind: "scheduled"; at: number };

/**
 * What runReviewRequests() will do with this order, given its ship date. The
 * same three rules the job applies — order-contact consent, at least 7 days
 * since shipping, at most 30 — evaluated at the first run that could send it.
 * (The job also skips anyone on the opt-out list; that is checked when it
 * runs, and it only ever turns a "yes" here into silence, never the reverse.)
 */
export function reviewRequestOutlook(
  o: { shippedAt: string; contactConsent: boolean | null; reviewRequestSentAt: string | null },
  now: number,
): ReviewOutlook {
  if (o.reviewRequestSentAt) return { kind: "sent", at: o.reviewRequestSentAt };
  if (!o.contactConsent) return { kind: "no-consent" };
  const shipped = Date.parse(o.shippedAt);
  if (!Number.isFinite(shipped)) return { kind: "too-old" };
  const run = nextRunAfter(Math.max(now, shipped + REVIEW_REQUEST_DELAY_DAYS * DAY - 1));
  if (run > shipped + REVIEW_REQUEST_MAX_AGE_DAYS * DAY) return { kind: "too-old" };
  return { kind: "scheduled", at: run };
}

const israelTime = (t: number) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(t));

const israelDay = (t: number) =>
  new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
  }).format(new Date(t));

/** One line for the admin, under the date picker. */
export function reviewOutlookText(o: ReviewOutlook, now: number): string {
  switch (o.kind) {
    case "sent":
      return `בקשת חוות דעת כבר נשלחה ללקוח (${new Date(o.at).toLocaleDateString("he-IL")}).`;
    case "no-consent":
      return "בקשת חוות דעת לא תצא: הלקוח לא אישר פנייה בנושא ההזמנה.";
    case "too-old":
      return `בקשת חוות דעת לא תצא: עברו יותר מ-${REVIEW_REQUEST_MAX_AGE_DAYS} יום מהמשלוח.`;
    case "scheduled": {
      const day = dateInputValue(o.at);
      const when =
        day === dateInputValue(now)
          ? "היום"
          : day === dateInputValue(now, 1)
            ? "מחר"
            : `ב-${israelDay(o.at)}`;
      return `בקשת חוות דעת תצא ללקוח אוטומטית ${when} ב-${israelTime(o.at)}.`;
    }
  }
}

/** Whole days since `iso`, for "שולמה לפני X ימים". */
export function daysSince(iso: string | null | undefined, now: number): number {
  const t = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(t) ? Math.max(0, Math.floor((now - t) / DAY)) : 0;
}
