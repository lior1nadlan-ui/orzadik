// "מה לעשות היום" — the owner's daily action queue.
//
// At ~1 order the winning CRM move isn't more analytics, it's white-glove
// treatment of every order that lands. This glass panel turns the passive
// dashboard into a prioritized to-do list built ONLY from real orders,
// abandoned carts and the reminders the owner set (getActionQueue derives it
// from live state — no fabricated rows). Each row offers one-tap WhatsApp with
// a warm, pre-filled Hebrew message, plus call / email, and three decisions:
//
//   טופל היום   back tomorrow morning if it is still true
//   3 ימים      back in three days
//   לא רלוונטי  gone until restored
//
// A reminder row has "בוצע" and "3 ימים" instead — it is the owner's own task.
//
// The decisions are stored on the server (crm_action_state, crm_followups), so
// the phone and the computer show the same queue and the morning briefing
// skips what was set aside here. Until 2026-09-25 they lived in localStorage.
//
// SSR-safe: the react-query fetch has no initialData, so the first (server)
// render is the loading skeleton — row content that reads Date.now() never
// runs during SSR.

import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getActionQueue } from "@/lib/admin-crm.functions";
import { clearActionDecision, setActionDecision, updateFollowUp } from "@/lib/crm-tasks.functions";
import {
  waThankYou,
  waShipped,
  waFollowUpUnpaid,
  waAbandonedCart,
  waReviewRequest,
  waMessage,
} from "@/lib/wa-templates";
import { cn } from "@/lib/utils";
import {
  Bell,
  ClipboardList,
  Clock,
  Heart,
  AlertCircle,
  Package,
  ShoppingCart,
  Star,
  Phone,
  Mail,
  MessageCircle,
  Printer,
  Check,
  RotateCcw,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";

// Mirrors the ActionRow shape returned by getActionQueue (that type isn't
// exported). Kept in step with admin-crm.functions.ts.
type ActionType =
  | "follow_up"
  | "thank_you"
  | "ready_to_ship"
  | "stuck_unpaid"
  | "recover_cart"
  | "review_request";

type QueueRow = {
  id: string;
  type: ActionType;
  priority: number;
  state: "open" | "snoozed" | "dismissed";
  snoozedUntil?: string;
  orderNumber?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  context: string;
  createdAt: string;
};

// Highest priority first — the order the owner should work the queue in.
const TYPE_ORDER: ActionType[] = [
  "follow_up",
  "thank_you",
  "stuck_unpaid",
  "ready_to_ship",
  "recover_cart",
  "review_request",
];

// Per-type presentation: the group label, its badge colours, and an icon.
// Colours reuse the palette already on the dashboard (emerald/amber tiles) plus
// the brand gold (--accent) for the review ask and the owner's own reminders.
const TYPE_META: Record<ActionType, { label: string; badge: string; Icon: LucideIcon }> = {
  follow_up: {
    label: "תזכורת שקבעת",
    badge: "bg-accent/10 text-accent-strong",
    Icon: Bell,
  },
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
 *  way. A reminder has no template (only the owner knows what it is about),
 *  so it opens the chat with a bare greeting. */
function waForRow(row: QueueRow): string | null {
  switch (row.type) {
    case "follow_up": {
      const name = row.customerName.includes("@") ? "" : row.customerName;
      return waMessage(
        row.customerPhone,
        name ? `שלום ${name}, כאן מאור זרוע לצדיק 🙏` : "שלום, כאן מאור זרוע לצדיק 🙏",
      );
    }
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

/** The crm_followups id inside a "follow_up:<uuid>" row id. */
const followUpId = (row: QueueRow) => row.id.slice("follow_up:".length);

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

type Decide = (row: QueueRow, decision: "today" | "days3" | "dismiss" | "done") => void;

function OpenRow({ row, onDecide, busy }: { row: QueueRow; onDecide: Decide; busy: boolean }) {
  const meta = TYPE_META[row.type];
  const wa = waForRow(row);
  const isReminder = row.type === "follow_up";
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
        {(row.type === "thank_you" || row.type === "ready_to_ship") && (
          <Link
            to="/admin/orders/$orderId/print"
            params={{ orderId: row.id.slice(row.id.indexOf(":") + 1) }}
            target="_blank"
            className={ACTION_BTN}
          >
            <Printer className="h-3.5 w-3.5" /> דף אריזה
          </Link>
        )}
        {row.customerEmail && (
          <Link to="/admin/customers" search={{ q: row.customerEmail }} className={ACTION_BTN}>
            <UserRound className="h-3.5 w-3.5" /> כרטיס
          </Link>
        )}

        <div className="ms-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(row, isReminder ? "done" : "today")}
            className={cn(ACTION_BTN, "border-accent/40 text-accent disabled:opacity-50")}
            title={isReminder ? "סמן שהתזכורת בוצעה" : "טופל להיום — יחזור מחר אם עדיין רלוונטי"}
          >
            <Check className="h-3.5 w-3.5" /> {isReminder ? "בוצע" : "טופל היום"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDecide(row, "days3")}
            className={cn(ACTION_BTN, "text-muted-foreground disabled:opacity-50")}
            title="הזכר לי שוב בעוד 3 ימים"
          >
            <Clock className="h-3.5 w-3.5" /> 3 ימים
          </button>
          {!isReminder && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide(row, "dismiss")}
              className={cn(ACTION_BTN, "text-muted-foreground disabled:opacity-50")}
              title="לא רלוונטי — להסיר מהרשימה ומסיכום הבוקר"
            >
              <X className="h-3.5 w-3.5" /> לא רלוונטי
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 text-[11px] text-muted-foreground">
        {isReminder ? "תזכורת" : timeAgoHe(row.createdAt)}
      </div>
    </div>
  );
}

function SetAsideRow({
  row,
  onRestore,
  busy,
}: {
  row: QueueRow;
  onRestore: (row: QueueRow) => void;
  busy: boolean;
}) {
  const meta = TYPE_META[row.type];
  const why =
    row.state === "dismissed"
      ? "סומן לא רלוונטי"
      : row.snoozedUntil
        ? `חוזר ${new Date(row.snoozedUntil).toLocaleString("he-IL", {
            weekday: "short",
            day: "numeric",
            month: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}`
        : "נדחה";
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-glass-line bg-card/40 px-3 py-2 opacity-70">
      <div className="flex min-w-0 items-center gap-2 text-sm">
        <meta.Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate">
          <span className="font-medium">{row.customerName}</span>
          <span className="text-muted-foreground">
            {" "}
            · {meta.label} · {why}
          </span>
        </span>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRestore(row)}
        className={cn(ACTION_BTN, "shrink-0 text-muted-foreground disabled:opacity-50")}
        aria-label="החזר לרשימה"
      >
        <RotateCcw className="h-3.5 w-3.5" /> החזר
      </button>
    </div>
  );
}

// ---- panel -----------------------------------------------------------------

const QUEUE_KEY = ["admin-action-queue"];

export function ActionCockpit() {
  const qc = useQueryClient();
  const load = useServerFn(getActionQueue);
  const decideFn = useServerFn(setActionDecision);
  const clearFn = useServerFn(clearActionDecision);
  const followUpFn = useServerFn(updateFollowUp);
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: QUEUE_KEY,
    queryFn: () => load(),
    refetchInterval: 60_000, // keep the queue live while the dashboard is open
  });

  /** Run one decision with the row locked, then refetch — the server is the
   *  source of truth for what comes back when. */
  const run = async (row: QueueRow, fn: () => Promise<unknown>, done: string) => {
    setBusyId(row.id);
    try {
      await fn();
      await qc.invalidateQueries({ queryKey: QUEUE_KEY });
      toast.success(done);
    } catch (e: any) {
      toast.error(e?.message ?? "השמירה נכשלה");
    } finally {
      setBusyId(null);
    }
  };

  const onDecide: Decide = (row, decision) => {
    if (row.type === "follow_up") {
      const action = decision === "done" ? "done" : "days3";
      return void run(
        row,
        () => followUpFn({ data: { id: followUpId(row), action } }),
        action === "done" ? "התזכורת סומנה כבוצעה" : "התזכורת נדחתה ב-3 ימים",
      );
    }
    const d = decision === "done" ? "today" : decision;
    void run(
      row,
      () => decideFn({ data: { key: row.id, decision: d } }),
      d === "today"
        ? "טופל — יחזור מחר אם עדיין רלוונטי"
        : d === "days3"
          ? "נדחה ב-3 ימים"
          : "הוסר מהרשימה",
    );
  };

  const onRestore = (row: QueueRow) =>
    void run(row, () => clearFn({ data: { key: row.id } }), "הוחזר לרשימה");

  const rows = (data ?? []) as QueueRow[];
  const openRows = rows.filter((r) => r.state === "open");
  const setAsideRows = rows.filter((r) => r.state !== "open");
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
        הפעולות החשובות ביותר על הזמנות, עגלות ותזכורות שקבעת — בלחיצה אחת. מה שמסומן כאן מסתנכרן
        בין המחשב לטלפון ולסיכום הבוקר.
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
                    <OpenRow key={row.id} row={row} onDecide={onDecide} busy={busyId === row.id} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {setAsideRows.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer select-none text-xs text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground">
              הונחו בצד ({setAsideRows.length})
            </summary>
            <div className="mt-2 space-y-1.5">
              {setAsideRows.map((row) => (
                <SetAsideRow
                  key={row.id}
                  row={row}
                  onRestore={onRestore}
                  busy={busyId === row.id}
                />
              ))}
            </div>
          </details>
        )}
      </div>
    </section>
  );
}
