// Which holiday hub belongs at the front of the homepage's "קונים לפי אירוע"
// rail right now.
//
// WHY. The rail listed its seven hubs in one fixed order all year: the four
// lifecycle hubs first, then ראש השנה, חנוכה and פסח. So six weeks before
// Hanukkah — the store's next selling season — the Hanukkah hub was sixth of
// seven, behind חלאקה and בית חדש, and the week after Rosh Hashana its hub was
// still offered as if it were coming. Judaica is bought by the calendar; the
// rail now follows it without anyone editing a list twice a year.
//
// HOW. The holiday dates come from the Hebrew calendar that ships with the
// runtime (Intl, `u-ca-hebrew`), evaluated in Israel time — so 25 Kislev is
// found for any year with no table to maintain. If a runtime lacks the Hebrew
// calendar, no date is found and the rail keeps its written order: this can
// only ever reorder, never hide or break.
//
// Pure apart from Intl; the homepage loader calls it once, on the server, and
// hands the order to the client in loader data so hydration never disagrees.

const DAY = 24 * 60 * 60 * 1000;

export type HolidayKey = "rosh-hashana" | "hanukkah" | "pesach";

type HolidayDef = {
  /** Hebrew-calendar month name as Intl spells it in English. */
  month: string;
  day: number;
  /** How many days the holiday lasts (the hub stays "now" through them). */
  length: number;
  /** Hebrew name for the tile. */
  name: string;
};

const HOLIDAYS: Record<HolidayKey, HolidayDef> = {
  "rosh-hashana": { month: "Tishri", day: 1, length: 2, name: "ראש השנה" },
  hanukkah: { month: "Kislev", day: 25, length: 8, name: "חנוכה" },
  pesach: { month: "Nisan", day: 15, length: 7, name: "פסח" },
};

/** Occasion hub slug → the holiday it serves (src/lib/collections.ts). */
export const COLLECTION_HOLIDAY: Record<string, HolidayKey> = {
  "matanot-rosh-hashana": "rosh-hashana",
  "matanot-hanukkah": "hanukkah",
  "matanot-pesach": "pesach",
};

/** A hub moves to the front this many days before its holiday. Six weeks
 *  covers ordering, delivery (3-14 business days) and gift planning. */
export const LEAD_DAYS = 42;

let hebrewFmt: Intl.DateTimeFormat | null | undefined;
function fmt(): Intl.DateTimeFormat | null {
  if (hebrewFmt === undefined) {
    try {
      hebrewFmt = new Intl.DateTimeFormat("en-u-ca-hebrew", {
        timeZone: "Asia/Jerusalem",
        month: "long",
        day: "numeric",
      });
    } catch {
      hebrewFmt = null;
    }
  }
  return hebrewFmt;
}

function hebrewDate(t: number): { month: string; day: number } | null {
  const f = fmt();
  if (!f) return null;
  const parts = f.formatToParts(new Date(t));
  const month = parts.find((p) => p.type === "month")?.value;
  const day = Number(parts.find((p) => p.type === "day")?.value);
  return month && Number.isFinite(day) ? { month, day } : null;
}

/** Noon, Israel time, on the Israel calendar day of `t` — a stable probe. */
function israelNoon(t: number): number {
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem" }).format(new Date(t));
  return Date.parse(`${ymd}T12:00:00+02:00`);
}

const startCache = new Map<string, number | null>();

/**
 * The first day of the holiday's current or next occurrence, as an instant
 * (noon Israel time). "Current": while the holiday is still on, this returns
 * the day it started. Null when the runtime has no Hebrew calendar.
 */
export function holidayStart(key: HolidayKey, now: number): number | null {
  const h = HOLIDAYS[key];
  const today = israelNoon(now);
  const cacheKey = `${key}:${today}`;
  if (startCache.has(cacheKey)) return startCache.get(cacheKey)!;
  let found: number | null = null;
  // Look back over the holiday's own length (it may already be running), then
  // forward a little over a year (a leap year is 385 days).
  for (let d = -(h.length - 1); d <= 390; d++) {
    const t = today + d * DAY;
    const hd = hebrewDate(t);
    if (!hd) break;
    if (hd.month === h.month && hd.day === h.day) {
      found = t;
      break;
    }
  }
  startCache.set(cacheKey, found);
  return found;
}

export type SeasonState = { phase: "soon" | "now"; label: string; daysUntil: number };

/** Whether a holiday is within its lead window, or running. */
export function seasonState(key: HolidayKey, now: number): SeasonState | null {
  const start = holidayStart(key, now);
  if (start === null) return null;
  const today = israelNoon(now);
  const daysUntil = Math.round((start - today) / DAY);
  const h = HOLIDAYS[key];
  if (daysUntil <= 0 && daysUntil > -h.length)
    return { phase: "now", label: `${h.name} שמח`, daysUntil };
  if (daysUntil > 0 && daysUntil <= LEAD_DAYS) {
    return { phase: "soon", label: `לקראת ${h.name}`, daysUntil };
  }
  return null;
}

export type SeasonalSlot = { slug: string; label?: string };

/**
 * The rail order for today: hubs whose holiday is running or within LEAD_DAYS
 * first (soonest first), then every other hub in its written order. Nothing is
 * dropped, so the rail's count — and the grid nudges tied to it — never change.
 */
export function seasonalOrder(slugs: string[], now: number): SeasonalSlot[] {
  const inSeason: Array<SeasonalSlot & { daysUntil: number }> = [];
  const rest: SeasonalSlot[] = [];
  for (const slug of slugs) {
    const key = COLLECTION_HOLIDAY[slug];
    const state = key ? seasonState(key, now) : null;
    if (state) inSeason.push({ slug, label: state.label, daysUntil: state.daysUntil });
    else rest.push({ slug });
  }
  inSeason.sort((a, b) => a.daysUntil - b.daysUntil);
  return [...inSeason.map(({ slug, label }) => ({ slug, label })), ...rest];
}
