import { describe, it, expect } from "vitest";
import {
  actionVisibility,
  dateInputValue,
  daysOverdue,
  decisionPatch,
  dueAtFromDateInput,
  dueFollowUps,
  hiddenActionKeys,
  israelMidnight,
  israelOffsetMs,
} from "./crm-tasks";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

describe("Israel day boundaries", () => {
  it("knows summer (+3) from winter (+2)", () => {
    expect(israelOffsetMs(Date.parse("2026-09-25T12:00:00Z"))).toBe(3 * HOUR);
    expect(israelOffsetMs(Date.parse("2026-12-25T12:00:00Z"))).toBe(2 * HOUR);
  });

  it("puts tomorrow's midnight at 21:00 UTC in summer", () => {
    const now = Date.parse("2026-09-25T07:00:00Z"); // Friday 10:00 in Israel
    expect(new Date(israelMidnight(now, 1)).toISOString()).toBe("2026-09-25T21:00:00.000Z");
  });

  it("treats 23:30 Israel time as still today, not tomorrow", () => {
    const lateEvening = Date.parse("2026-09-25T20:30:00Z"); // 23:30 IDT
    expect(new Date(israelMidnight(lateEvening, 1)).toISOString()).toBe("2026-09-25T21:00:00.000Z");
  });

  it("lands on the right midnight across the October clock change", () => {
    // Israel leaves summer time on Sunday 25.10.2026, so the midnight that
    // STARTS Monday 26.10 is already in winter time: 22:00 UTC.
    const saturday = Date.parse("2026-10-24T09:00:00Z");
    expect(new Date(israelMidnight(saturday, 2)).toISOString()).toBe("2026-10-25T22:00:00.000Z");
  });

  it("turns a date picked in the admin into 08:00 Israel time that day", () => {
    expect(dueAtFromDateInput("2026-10-01")).toBe("2026-10-01T05:00:00.000Z");
    expect(dueAtFromDateInput("2026-12-01")).toBe("2026-12-01T06:00:00.000Z");
    expect(dueAtFromDateInput("1.10.2026")).toBeNull();
  });

  it("fills the date input with Israel's date, even late at night UTC", () => {
    // 22:30 UTC on the 25th is already 01:30 on the 26th in Israel.
    const t = Date.parse("2026-09-25T22:30:00Z");
    expect(dateInputValue(t)).toBe("2026-09-26");
    expect(dateInputValue(t, 1)).toBe("2026-09-27");
  });
});

describe("queue decisions", () => {
  const now = Date.parse("2026-09-25T07:00:00Z");

  it("'handled today' comes back at the next Israel midnight", () => {
    expect(decisionPatch("today", now)).toEqual({
      snoozed_until: "2026-09-25T21:00:00.000Z",
      dismissed_at: null,
    });
  });

  it("'three days' is three days, and 'not relevant' is for good", () => {
    expect(decisionPatch("days3", now).snoozed_until).toBe(new Date(now + 3 * DAY).toISOString());
    const d = decisionPatch("dismiss", now);
    expect(d.dismissed_at).toBe(new Date(now).toISOString());
    expect(d.snoozed_until).toBeNull();
  });

  it("reopens an item once its snooze has passed", () => {
    const row = { action_key: "k", snoozed_until: "2026-09-25T21:00:00Z", dismissed_at: null };
    expect(actionVisibility(row, now)).toBe("snoozed");
    expect(actionVisibility(row, Date.parse("2026-09-25T21:00:01Z"))).toBe("open");
    expect(actionVisibility(undefined, now)).toBe("open");
  });

  it("hides dismissed and still-snoozed keys, not expired ones", () => {
    const hidden = hiddenActionKeys(
      [
        { action_key: "a", snoozed_until: null, dismissed_at: "2026-09-01T00:00:00Z" },
        { action_key: "b", snoozed_until: "2026-09-26T00:00:00Z", dismissed_at: null },
        { action_key: "c", snoozed_until: "2026-09-24T00:00:00Z", dismissed_at: null },
      ],
      now,
    );
    expect([...hidden].sort()).toEqual(["a", "b"]);
  });
});

describe("follow-ups", () => {
  const now = Date.parse("2026-09-25T07:00:00Z"); // Friday 10:00 IDT
  const f = (id: string, due: string, done: string | null = null) => ({
    id,
    customer_email: "a@example.com",
    title: id,
    due_at: due,
    done_at: done,
  });

  it("lists what is due by tonight, overdue first, and nothing done or future", () => {
    const rows = [
      f("later-today", "2026-09-25T17:00:00Z"),
      f("overdue", "2026-09-22T05:00:00Z"),
      f("tomorrow", "2026-09-26T05:00:00Z"),
      f("done", "2026-09-20T05:00:00Z", "2026-09-21T09:00:00Z"),
    ];
    expect(dueFollowUps(rows, now).map((r) => r.id)).toEqual(["overdue", "later-today"]);
  });

  it("counts overdue in Israel calendar days", () => {
    expect(daysOverdue("2026-09-25T05:00:00Z", now)).toBe(0);
    expect(daysOverdue("2026-09-22T05:00:00Z", now)).toBe(3);
  });
});
