// "מה לעשות היום" — the owner's daily action queue.
//
// At ~1 order the winning CRM move isn't more analytics, it's white-glove
// treatment of every order that lands. This glass panel turns the passive
// dashboard into a prioritized to-do list built ONLY from real orders and
// abandoned carts (getActionQueue is read-only and derives entirely from live
// state — no fabricated rows). Each row offers one-tap WhatsApp with a warm,
// pre-filled Hebrew message, plus call / email, and a "טופל" toggle.
//
// The per-row "handled" flag lives in localStorage (no DB table, no service
// key this session), keyed by the row id. Row ids embed today's date
// (`type:entityId:YYYY-MM-DD`), so dismissing an action clears it for today and
// a still-open action resurfaces tomorrow under a fresh id — exactly right for a
// daily queue. We prune stored ids that aren't from today so the key stays tiny.
//
// SSR-safe: localStorage/window are touched ONLY inside effects/handlers, and
// the react-query fetch has no initialData, so the first (server) render is the
// loading skeleton — row content that reads Date.now() never runs during SSR.

import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getActionQueue } from "@/lib/admin-crm.functions";
import {
  waThankYou,
  waShipped,
  waFollowUpUnpaid,
  waAbandonedCart,
  waReviewRequest,
} from "@/lib/wa-templates";
import { cn } from "@/lib/utils";
import {
  ClipboardList,
  Heart,
  AlertCircle,
  Package,
  ShoppingCart,
  Star,
  Phone,
  Mail,
  MessageCircle,
  Check,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

// Mirrors the ActionRow shape returned by getActionQueue (that type isn't
// exported). Kept in step with admin-crm.functions.ts.
type ActionType =
  | "thank_you"
  | "ready_to_ship"
  | "stuck_unpaid"
  | "recover_cart"
  | "review_request";

type QueueRow = {
  id: string;
  type: ActionType;
  priority: number;
  orderNumber?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  context: string;
  createdAt: string;
};

// Highest priority first — the order the owner should work the queue in.
const TYPE_ORDER: ActionType[] = [
  "thank_you",
  "stuck_unpaid",
  "ready_to_ship",
  "recover_cart",
  "review_request",
];

// Per-type presentation: the group label, its badge colours, and an icon.
// Colours reuse the palette already on the dashboard (emerald/amber tiles) plus
// the brand gold (--accent) for the review ask.
const TYPE_META: Record<ActionType, { label: string; badge: string; Icon: LucideIcon }> = {
  thank_you: {
    label: "תודה על הזמנה חדשה",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
    Icon: Heart,
  },
  stuck_unpaid: {
    label: "תשלום שלא הושלם",
    badge: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    Icon: AlertCircle,
  },
  ready_to_ship: {
    label: "לארוז ולשלוח",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
    Icon: Package,
  },
  recover_cart: {
    label: "עגלה נטושה",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
    Icon: ShoppingCart,
  },
  review_request: {
    label: "בקשת חוות דעת",
    badge: "bg-secondary text-accent",
    Icon: Star,
  },
};

/** The matching pre-filled Hebrew WhatsApp template for a row, or null when we
 *  have no phone number to send to. ready_to_ship uses waShipped — the owner
 *  taps it as they hand the parcel over, notifying the customer it's on the
 *  way. */
function waForRow(row: QueueRow): string | null {
  switch (row.type) {
    case "thank_you":
      return waThankYou(row);
    case "ready_to_ship":
      return waShipped(row);
    case "stuck_unpaid":
      return waFollowUpUnpaid(row);
    case "recover_cart":
      return waAbandonedCart(row);
    case "review_request":
      return waReviewRequest(row);
    default:
      return null;
  }
}

// ---- handled-state persistence (localStorage) -----------------------------

const HANDLED_KEY = "orz:admin:action-handled";

function readHandled(): Record<string, true> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(HANDLED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, true>) : {};
  } catch {
    return {};
  }
}

function writeHandled(v: Record<string, true>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(HANDLED_KEY, JSON.stringify(v));
  } catch {
    /* private mode / quota — the queue still works, it just won't remember. */
  }
}

// ---- small helpers ---------------------------------------------------------

function timeAgoHe(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const h = Math.floor(ms / 3.6e6);
  if (h < 1) return "לפני פחות משעה";
  if (h < 24) return `לפני ${h} שע׳`;
  const d = Math.floor(h / 24);
  return d === 1 ? "לפני יום" : `לפני ${d} ימים`;
}

const ACTION_BTN =
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs press transition-colors duration-160 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted";

// ---- rows ------------------------------------------------------------------

function OpenRow({ row, onHandled }: { row: QueueRow; onHandled: (id: string) => void }) {
  const meta = TYPE_META[row.type];
  const wa = waForRow(row);
  return (
    <div className="glass-lift rounded-xl border border-glass-line bg-card/70 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-sm">{row.customerName}</strong>
            {row.orderNumber && (
              <Link
                to="/admin/orders"
                search={{ q: row.orderNumber }}
                className="font-mono text-[11px] text-muted-foreground underline-offset-2 [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
              >
                {row.orderNumber}
              </Link>
            )}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">{row.context}</div>
        </div>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
            meta.badge,
          )}
        >
          <meta.Icon className="h-3 w-3" />
          {meta.label}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className={cn(
              ACTION_BTN,
              "border-emerald-600/30 text-emerald-700 dark:text-emerald-400",
            )}
          >
            <MessageCircle className="h-3.5 w-3.5" /> וואטסאפ
          </a>
        )}
        {row.customerPhone && (
          <a href={`tel:${row.customerPhone}`} className={ACTION_BTN}>
            <Phone className="h-3.5 w-3.5" /> חיוג
          </a>
        )}
        {row.customerEmail && (
          <a href={`mailto:${row.customerEmail}`} className={ACTION_BTN}>
            <Mail className="h-3.5 w-3.5" /> אימייל
          </a>
        )}
        <button
          type="button"
          onClick={() => onHandled(row.id)}
          className={cn(ACTION_BTN, "border-accent/40 text-accent ms-auto")}
          aria-label="סמן כטופל"
        >
          <Check className="h-3.5 w-3.5" /> טופל
        </button>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">{timeAgoHe(row.createdAt)}</div>
    </div>
  );
}

function HandledRow({ row, onRestore }: { row: QueueRow; onRestore: (id: string) => void }) {
  const meta = TYPE_META[row.type];
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-glass-line bg-card/40 px-3 py-2 opacity-70">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <meta.Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          <span className="font-medium">{row.customerName}</span>
          <span className="text-muted-foreground"> · {meta.label}</span>
        </span>
      </div>
      <button
        type="button"
        onClick={() => onRestore(row.id)}
        className={cn(ACTION_BTN, "shrink-0 text-muted-foreground")}
        aria-label="החזר לרשימה"
      >
        <RotateCcw className="h-3.5 w-3.5" /> החזר
      </button>
    </div>
  );
}

// ---- panel -----------------------------------------------------------------

export function ActionCockpit() {
  const load = useServerFn(getActionQueue);
  const { data, isLoading } = useQuery({
    queryKey: ["admin-action-queue"],
    queryFn: () => load(),
    refetchInterval: 60_000, // keep the queue live while the dashboard is open
  });

  // Empty on the first render (SSR-safe); hydrate from localStorage on mount and
  // drop any ids that aren't from today so the store self-prunes.
  const [handled, setHandled] = useState<Record<string, true>>({});
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    const stored = readHandled();
    const pruned: Record<string, true> = {};
    for (const k of Object.keys(stored)) {
      if (k.endsWith(":" + today)) pruned[k] = true;
    }
    setHandled(pruned);
    writeHandled(pruned);
  }, []);

  const toggle = useCallback((id: string) => {
    setHandled((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = true;
      writeHandled(next);
      return next;
    });
  }, []);

  const rows = (data ?? []) as QueueRow[];
  const openRows = rows.filter((r) => !handled[r.id]);
  const handledRows = rows.filter((r) => handled[r.id]);
  const groups = TYPE_ORDER.map((type) => ({
    type,
    rows: openRows.filter((r) => r.type === type),
  })).filter((g) => g.rows.length > 0);

  return (
    <section className="glass glass-gold reveal p-5 md:p-6 [--glass-radius:1.25rem]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          <ClipboardList className="h-5 w-5 text-accent" />
          מה לעשות היום
        </h2>
        {openRows.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold text-accent">
            {openRows.length} פעולות פתוחות
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        הפעולות החשובות ביותר על הזמנות ועגלות אמיתיות — בלחיצה אחת.
      </p>

      <div className="mt-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : openRows.length === 0 ? (
          <div className="rounded-xl border border-glass-line bg-card/50 py-8 text-center text-sm text-muted-foreground">
            אין פעולות פתוחות — הכל מטופל 👏
          </div>
        ) : (
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.type}>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                      TYPE_META[g.type].badge,
                    )}
                  >
                    {TYPE_META[g.type].label}
                  </span>
                  <span>{g.rows.length}</span>
                </div>
                <div className="stagger space-y-2">
                  {g.rows.map((row) => (
                    <OpenRow key={row.id} row={row} onHandled={toggle} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {handledRows.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer select-none text-xs text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground">
              טופל היום ({handledRows.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {handledRows.map((row) => (
                <HandledRow key={row.id} row={row} onRestore={toggle} />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
