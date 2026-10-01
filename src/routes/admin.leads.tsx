import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle,
  Phone,
  Mail,
  BellPlus,
  Copy,
  RefreshCw,
  User,
  ExternalLink,
} from "lucide-react";
import { listLeads, type LeadRow } from "@/lib/leads.functions";
import { addFollowUp, setActionDecision, clearActionDecision } from "@/lib/crm-tasks.functions";
import { dateInputValue } from "@/lib/crm-tasks";
import { waAbandonedCart, waFollowUpUnpaid, orderPaymentUrl } from "@/lib/wa-templates";
import { formatILS } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/Skeletons";

// "לידים" — everyone who started buying and has not paid, in one column:
// abandoned carts and unpaid/failed orders, one row per person, newest first.
// Every row is something the owner can act on in one tap — WhatsApp with the
// right draft (and the payment link when there is an order), a call, an email,
// or "תזכיר לי מחר", which lands in "מה לעשות היום" and the morning briefing.
// "טופל / 3 ימים / לא רלוונטי" are the action queue's own decisions (same
// keys), so a lead set aside here is set aside there too, and the other way.
// The rules for who is a lead live in src/lib/leads.ts.

export const Route = createFileRoute("/admin/leads")({
  component: AdminLeads,
  head: () => ({ meta: [{ title: "לידים | ניהול" }] }),
});

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "עכשיו";
  if (mins < 60) return `לפני ${mins} דק׳`;
  const h = Math.round(mins / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

const ACTION_BTN = "min-h-10";

function AdminLeads() {
  const load = useServerFn(listLeads);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: () => load(),
    refetchInterval: 60_000,
  });
  const all = data ?? [];
  const open = all.filter((l) => l.state === "open");
  const aside = all.filter((l) => l.state !== "open");
  const total = open.reduce((s, l) => s + l.value, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">לידים ({open.length})</h1>
          <p className="text-sm text-muted-foreground">
            כל מי שהתחיל לקנות ולא שילם ב-30 הימים האחרונים — עגלות נטושות והזמנות שהתשלום שלהן לא
            הושלם. {open.length > 0 && <>סה״כ {formatILS(total)} שמחכים לשיחה.</>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          רענון
        </Button>
      </div>

      {isLoading && <CardSkeleton className="min-h-[12rem]" />}
      {error && <p className="text-sm text-destructive">טעינת הלידים נכשלה. נסו לרענן.</p>}
      {!isLoading && !error && open.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          אין כרגע לידים פתוחים. 🎉
        </div>
      )}

      <ul className="space-y-3">
        {open.map((l) => (
          <LeadCard key={l.key} lead={l} />
        ))}
      </ul>

      {aside.length > 0 && (
        <details className="mt-6 rounded-lg border bg-muted/30 p-3">
          <summary className="cursor-pointer text-sm font-semibold">
            הונחו בצד ({aside.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {aside.map((l) => (
              <LeadCard key={l.key} lead={l} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function LeadCard({ lead: l }: { lead: LeadRow }) {
  const qc = useQueryClient();
  const addFn = useServerFn(addFollowUp);
  const decideFn = useServerFn(setActionDecision);
  const restoreFn = useServerFn(clearActionDecision);
  const [busy, setBusy] = useState(false);
  const [reminded, setReminded] = useState(l.hasFollowUp);
  const isOrder = l.kind === "unpaid_order";
  const payUrl = l.orderId ? orderPaymentUrl(l.orderId) : null;
  const wa = isOrder
    ? waFollowUpUnpaid(
        { customer_name: l.name, customer_phone: l.phone, order_number: l.orderNumber },
        payUrl ?? undefined,
      )
    : waAbandonedCart({ customer_name: l.name, customer_phone: l.phone });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["admin-leads"] });
    qc.invalidateQueries({ queryKey: ["action-queue"] });
  };

  const remind = async () => {
    setBusy(true);
    try {
      await addFn({
        data: {
          email: l.email,
          title: isOrder
            ? `לחזור ל${l.name} — הזמנה ${l.orderNumber} לא שולמה (${formatILS(l.value)})`
            : `לחזור ל${l.name} — עגלה נטושה (${formatILS(l.value)})`,
          date: dateInputValue(Date.now(), 1),
        },
      });
      setReminded(true);
      toast.success("נקבעה תזכורת למחר בבוקר — תופיע ב'מה לעשות היום' ובסיכום הבוקר");
    } catch (e: any) {
      toast.error(e?.message ?? "קביעת התזכורת נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    try {
      await restoreFn({ data: { key: l.actionKey } });
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "השחזור נכשל");
    }
  };

  const decide = async (decision: "today" | "days3" | "dismiss") => {
    setBusy(true);
    try {
      await decideFn({ data: { key: l.actionKey, decision } });
      toast.success(
        decision === "dismiss"
          ? "הוסר מהרשימה"
          : decision === "today"
            ? "סומן כטופל — יחזור מחר אם עדיין לא שילם"
            : "יחזור לרשימה בעוד 3 ימים",
        { action: { label: "ביטול", onClick: () => void restore() } },
      );
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">{l.name}</span>
            <span
              className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                isOrder ? "bg-amber-100 text-amber-900" : "bg-violet-100 text-violet-900"
              }`}
            >
              {isOrder ? `התשלום לא הושלם · ${l.orderNumber}` : "עגלה נטושה"}
            </span>
            {l.alsoCart && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">השאיר גם עגלה</span>
            )}
            {l.state === "snoozed" && l.snoozedUntil && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">
                חוזר ב-{new Date(l.snoozedUntil).toLocaleDateString("he-IL")}
              </span>
            )}
            {l.state === "dismissed" && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">סומן לא רלוונטי</span>
            )}
          </div>
          <div className="mt-0.5 break-all text-xs text-muted-foreground" dir="ltr">
            {[l.phone, l.email].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="text-end">
          <div className="font-bold text-accent">{formatILS(l.value)}</div>
          <div className="text-xs text-muted-foreground">{ago(l.at)}</div>
        </div>
      </div>

      {l.items.length > 0 && (
        <p className="mt-2 text-sm">
          {l.items.slice(0, 3).join(" · ")}
          {l.items.length > 3 && ` ועוד ${l.items.length - 3}`}
        </p>
      )}
      <p className="mt-1 text-xs text-muted-foreground">
        {l.reason ? `${l.reason} · ` : ""}
        {l.customerReminded ? "הלקוח כבר קיבל תזכורת אוטומטית במייל" : "עוד לא נשלחה ללקוח תזכורת"}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {wa && (
          <Button size="sm" className={ACTION_BTN} asChild>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> וואטסאפ
            </a>
          </Button>
        )}
        {l.phone && (
          <Button size="sm" variant="outline" className={ACTION_BTN} asChild>
            <a href={`tel:${l.phone}`}>
              <Phone className="h-4 w-4" /> חיוג
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" className={ACTION_BTN} asChild>
          <a href={`mailto:${l.email}`}>
            <Mail className="h-4 w-4" /> אימייל
          </a>
        </Button>
        {payUrl && (
          <Button
            size="sm"
            variant="outline"
            className={ACTION_BTN}
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(payUrl);
                toast.success("קישור התשלום הועתק");
              } catch {
                toast.error("ההעתקה נכשלה");
              }
            }}
          >
            <Copy className="h-4 w-4" /> קישור תשלום
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className={ACTION_BTN}
          disabled={busy || reminded}
          onClick={remind}
        >
          <BellPlus className="h-4 w-4" /> {reminded ? "✓ יש תזכורת" : "תזכיר לי מחר"}
        </Button>
        {isOrder && l.orderNumber && (
          <Button size="sm" variant="ghost" className={ACTION_BTN} asChild>
            <Link to="/admin/orders" search={{ q: l.orderNumber, open: "1" }}>
              <ExternalLink className="h-4 w-4" /> פתיחת ההזמנה
            </Link>
          </Button>
        )}
        <Button size="sm" variant="ghost" className={ACTION_BTN} asChild>
          <Link to="/admin/customers" search={{ q: l.email }}>
            <User className="h-4 w-4" /> כרטיס לקוח
          </Link>
        </Button>
      </div>

      {/* Same three decisions as "מה לעשות היום", kept apart from the contact
          buttons so a slip of the thumb cannot take someone off the list. */}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
        {l.state === "open" ? (
          <>
            <span className="text-xs text-muted-foreground">אחרי שדיברתם:</span>
            <Button
              size="sm"
              variant="outline"
              className={ACTION_BTN}
              disabled={busy}
              onClick={() => decide("today")}
            >
              טופל היום
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={ACTION_BTN}
              disabled={busy}
              onClick={() => decide("days3")}
            >
              לחזור בעוד 3 ימים
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className={`${ACTION_BTN} text-muted-foreground`}
              disabled={busy}
              onClick={() => decide("dismiss")}
            >
              לא רלוונטי
            </Button>
          </>
        ) : (
          <Button size="sm" variant="outline" className={ACTION_BTN} onClick={restore}>
            החזרה לרשימה
          </Button>
        )}
      </div>
    </li>
  );
}
