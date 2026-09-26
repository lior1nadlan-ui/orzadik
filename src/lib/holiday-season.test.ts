import { describe, it, expect } from "vitest";
import { holidayStart, seasonState, seasonalOrder, LEAD_DAYS } from "./holiday-season";

// The rail as written in src/lib/collections.ts.
const RAIL = [
  "bar-mitzva",
  "chatan-kala",
  "chalaka",
  "bait-chadash",
  "matanot-rosh-hashana",
  "matanot-hanukkah",
  "matanot-pesach",
];

const at = (iso: string) => Date.parse(`${iso}T09:00:00Z`);
const ymd = (t: number | null) => (t === null ? null : new Date(t).toISOString().slice(0, 10));

describe("holiday dates from the Hebrew calendar", () => {
  it("finds the next Hanukkah, Rosh Hashana and Pesach", () => {
    const now = at("2026-09-26");
    expect(ymd(holidayStart("hanukkah", now))).toBe("2026-12-05");
    expect(ymd(holidayStart("pesach", now))).toBe("2027-04-22");
    expect(ymd(holidayStart("rosh-hashana", now))).toBe("2027-10-02");
  });

  it("returns the running holiday's first day while it lasts", () => {
    expect(ymd(holidayStart("hanukkah", at("2026-12-08")))).toBe("2026-12-05");
  });
});

describe("the season window", () => {
  it("is quiet more than six weeks out", () => {
    // Today, the day after Sukkot starts: Hanukkah is 70 days away.
    expect(seasonState("hanukkah", at("2026-09-26"))).toBeNull();
  });

  it("opens six weeks before and says so", () => {
    const s = seasonState("hanukkah", at("2026-11-01"));
    expect(s).toEqual({ phase: "soon", label: "לקראת חנוכה", daysUntil: 34 });
    expect(LEAD_DAYS).toBe(42);
  });

  it("stays on through the eight days, then closes", () => {
    expect(seasonState("hanukkah", at("2026-12-12"))?.phase).toBe("now");
    expect(seasonState("hanukkah", at("2026-12-12"))?.label).toBe("חנוכה שמח");
    expect(seasonState("hanukkah", at("2026-12-13"))).toBeNull();
  });
});

describe("the rail order", () => {
  it("keeps the written order out of season", () => {
    expect(seasonalOrder(RAIL, at("2026-09-26")).map((s) => s.slug)).toEqual(RAIL);
  });

  it("puts the coming holiday first, with its label, and drops nothing", () => {
    const order = seasonalOrder(RAIL, at("2026-11-15"));
    expect(order[0]).toEqual({ slug: "matanot-hanukkah", label: "לקראת חנוכה" });
    expect(order).toHaveLength(RAIL.length);
    expect(order.slice(1).map((s) => s.slug)).toEqual(RAIL.filter((s) => s !== "matanot-hanukkah"));
  });

  it("does the same for Pesach and the next Rosh Hashana", () => {
    expect(seasonalOrder(RAIL, at("2027-03-20"))[0].slug).toBe("matanot-pesach");
    expect(seasonalOrder(RAIL, at("2027-08-25"))[0].slug).toBe("matanot-rosh-hashana");
  });
});
