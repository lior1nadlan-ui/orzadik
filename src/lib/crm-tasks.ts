// Follow-up reminders and the owner's decisions about queue items — the pure
// half. The tables are crm_followups and crm_action_state (migration
// 20260925090000); the server functions live in crm-tasks.functions.ts.
//
// Everything here takes a clock and returns data, so the rules about WHEN a
// reminder is due and WHEN a snoozed item comes back are pinned by
// crm-tasks.test.ts without a database.

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

const ISRAEL = "Asia/Jerusalem";

/**
 * Israel's UTC offset at instant `t`, in ms (+2h in winter, +3h in summer).
 * Read from Intl rather than hard-coded, because the switch dates move every
 * year and a reminder "for tomorrow" must not land an hour early twice a year.
 */
export function israelOffsetMs(t: number): number {
  try {
    const name =
      new Intl.DateTimeFormat("en-US", { timeZone: ISRAEL, timeZoneName: "shortOffset" })
        .formatToParts(new Date(t))
        .find((p) => p.type === "timeZoneName")?.value ?? "";
    const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
    if (!m) return 2 * HOUR;
    const mins = Number(m[2]) * 60 + Number(m[3] ?? 0);
    return (m[1] === "-" ? -1 : 1) * mins * 60_000;
  } catch {
    return 2 * HOUR;
  }
}

/** The calendar date in Israel at instant `t`, as [year, month (1-12), day]. */
export function israelDate(t: number): [number, number, number] {
  const local = new Date(t + israelOffsetMs(t));
  return [local.getUTCFullYear(), local.getUTCMonth() + 1, local.getUTCDate()];
}

/** The instant Israel's clock reads 00:00 on the day `addDays` after `t`'s
 *  Israel date. Handles the DST change: the offset is taken at the target
 *  midnight itself, not at `t`. */
export function israelMidnight(t: number, addDays: number): number {
  const [y, m, d] = israelDate(t);
  const utcMidnight = Date.UTC(y, m - 1, d + addDays);
  // Two passes: the offset at a guess, then at the corrected instant — the
  // second pass is what makes the switch nights come out right.
  let at = utcMidnight - israelOffsetMs(utcMidnight);
  at = utcMidnight - israelOffsetMs(at);
  return at;
}

/** "Due today" means before Israel's next midnight, whatever time the check runs. */
export const endOfIsraelDay = (t: number) => israelMidnight(t, 1);

/** A reminder date typed as "YYYY-MM-DD" in the admin, as the instant it
 *  becomes due: 08:00 Israel time that day — early enough to make the morning
 *  briefing's list, late enough not to count as "yesterday" in UTC. */
export function dueAtFromDateInput(ymd: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  const utc8 = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 8);
  const t = utc8 - israelOffsetMs(utc8);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

/** The "YYYY-MM-DD" value for a date input, `addDays` from `t` in Israel time. */
export function dateInputValue(t: number, addDays = 0): string {
  const [y, m, d] = israelDate(israelMidnight(t, addDays) + HOUR);
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// ---- Queue item state --------------------------------------------------------

/**
 * What the owner can do with a queue item:
 *   today    handled for today; it comes back tomorrow morning if the thing is
 *            still true (the parcel still unshipped, the payment still unpaid).
 *   days3    not now — back in three days.
 *   dismiss  not relevant any more (the customer said no, the order was a
 *            test). Gone until the owner restores it.
 */
export type ActionDecision = "today" | "days3" | "dismiss";

export type ActionStateRow = {
  action_key: string;
  snoozed_until: string | null;
  dismissed_at: string | null;
};

export function decisionPatch(
  decision: ActionDecision,
  now: number,
): { snoozed_until: string | null; dismissed_at: string | null } {
  if (decision === "dismiss")
    return { snoozed_until: null, dismissed_at: new Date(now).toISOString() };
  const until = decision === "today" ? israelMidnight(now, 1) : now + 3 * DAY;
  return { snoozed_until: new Date(until).toISOString(), dismissed_at: null };
}

export type ActionVisibility = "open" | "snoozed" | "dismissed";

export function actionVisibility(row: ActionStateRow | undefined, now: number): ActionVisibility {
  if (!row) return "open";
  if (row.dismissed_at) return "dismissed";
  const until = row.snoozed_until ? Date.parse(row.snoozed_until) : NaN;
  return Number.isFinite(until) && until > now ? "snoozed" : "open";
}

/** Keys the owner has set aside right now — the queue and the morning
 *  briefing both skip them. An expired snooze is simply open again. */
export function hiddenActionKeys(rows: ActionStateRow[], now: number): Set<string> {
  return new Set(rows.filter((r) => actionVisibility(r, now) !== "open").map((r) => r.action_key));
}

/** The date-free key a decision is stored under: "<type>:<entity id>". */
export const actionKey = (type: string, entityId: string) => `${type}:${entityId}`;

// ---- Follow-ups --------------------------------------------------------------

export type FollowUpRow = {
  id: string;
  customer_email: string;
  title: string;
  due_at: string;
  done_at: string | null;
};

/** Open reminders due by the end of Israel's today, overdue first. */
export function dueFollowUps<T extends FollowUpRow>(rows: T[], now: number): T[] {
  const cutoff = endOfIsraelDay(now);
  return rows
    .filter((f) => !f.done_at && Date.parse(f.due_at) < cutoff)
    .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
}

/** Whole Israel calendar days a reminder is past due (0 = due today). */
export function daysOverdue(dueAt: string, now: number): number {
  const due = israelMidnight(Date.parse(dueAt), 0);
  const today = israelMidnight(now, 0);
  return Math.max(0, Math.round((today - due) / DAY));
}
