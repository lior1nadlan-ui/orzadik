import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, Phone, Mail, BellPlus, Copy, RefreshCw, User } from "lucide-react";
import { listLeads } from "@/lib/leads.functions";
import { addFollowUp } from "@/lib/crm-tasks.functions";
import { dateInputValue } from "@/lib/crm-tasks";
import type { Lead } from "@/lib/leads";
import { waAbandonedCart, waFollowUpUnpaid, orderPaymentUrl } from "@/lib/wa-templates";
import { formatILS } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/Skeletons";

// "לידים" — everyone who started buying and has not paid, in one column:
// abandoned carts and unpaid/failed orders, one row per person, newest first.
// Every row is something the owner can act on in one tap — WhatsApp with the
// right draft (and the payment link when there is an order), a call, an email,
// or "תזכיר לי מחר", which lands in "מה לעשות היום" and the morning briefing.
// The rules for who is a lead live in src/lib/leads.ts.

export const Route = createFileRoute("/admin/leads")({
  component: AdminLeads,
  head: () => ({ meta: [{ title: "לידים | ניהול" }] }),
});

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `לפני ${mins} דק׳`;
  const h = Math.round(mins / 60);
  if (h < 24) return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  const d = Math.round(h / 24);
  return d === 1 ? "אתמול" : `לפני ${d} ימים`;
}

function AdminLeads() {
  const load = useServerFn(listLeads);
  const { data, isLoading, isFetching, refetch, error } = useQuery({
    queryKey: ["admin-leads"],
    queryFn: () => load(),
    refetchInterval: 60_000,
  });
  const leads = data ?? [];
  const total = leads.reduce((s, l) => s + l.value, 0);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">לידים ({leads.length})</h1>
          <p className="text-sm text-muted-foreground">
            כל מי שהתחיל לקנות ולא שילם ב-30 הימים האחרונים — עגלות נטושות והזמנות שהתשלום שלהן לא
            הושלם. {leads.length > 0 && <>סה״כ {formatILS(total)} שמחכים לשיחה.</>}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 ml-1 ${isFetching ? "animate-spin" : ""}`} />
          רענון
        </Button>
      </div>

      {isLoading && <CardSkeleton className="min-h-[12rem]" />}
      {error && <p className="text-sm text-destructive">טעינת הלידים נכשלה. נסו לרענן.</p>}
      {!isLoading && !error && leads.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          אין כרגע לידים פתוחים — כל מי שהתחיל לקנות סיים לשלם. 🎉
        </div>
      )}

      <ul className="space-y-3">
        {leads.map((l) => (
          <LeadCard key={l.key} lead={l} />
        ))}
      </ul>
    </div>
  );
}

function LeadCard({ lead: l }: { lead: Lead }) {
  const addFn = useServerFn(addFollowUp);
  const [reminding, setReminding] = useState(false);
  const isOrder = l.kind === "unpaid_order";
  const payUrl = l.orderId ? orderPaymentUrl(l.orderId) : null;
  const wa = isOrder
    ? waFollowUpUnpaid(
        { customer_name: l.name, customer_phone: l.phone, order_number: l.orderNumber },
        payUrl ?? undefined,
      )
    : waAbandonedCart({ customer_name: l.name, customer_phone: l.phone });

  const remind = async () => {
    setReminding(true);
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
      toast.success("נקבעה תזכורת למחר בבוקר — תופיע ב'מה לעשות היום' ובסיכום הבוקר");
    } catch (e: any) {
      toast.error(e?.message ?? "קביעת התזכורת נכשלה");
    } finally {
      setReminding(false);
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
                isOrder ? "bg-amber-100 text-amber-900" : "bg-sky-100 text-sky-900"
              }`}
            >
              {isOrder ? `התשלום לא הושלם · ${l.orderNumber}` : "עגלה נטושה"}
            </span>
            {l.alsoCart && (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px]">השאיר גם עגלה</span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground" dir="ltr">
            {[l.phone, l.email].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div className="text-left">
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
          <Button size="sm" asChild>
            <a href={wa} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> וואטסאפ
            </a>
          </Button>
        )}
        {l.phone && (
          <Button size="sm" variant="outline" asChild>
            <a href={`tel:${l.phone}`}>
              <Phone className="h-4 w-4" /> חיוג
            </a>
          </Button>
        )}
        <Button size="sm" variant="outline" asChild>
          <a href={`mailto:${l.email}`}>
            <Mail className="h-4 w-4" /> מייל
          </a>
        </Button>
        {payUrl && (
          <Button
            size="sm"
            variant="outline"
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
        <Button size="sm" variant="outline" disabled={reminding} onClick={remind}>
          <BellPlus className="h-4 w-4" /> תזכיר לי מחר
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <Link to="/admin/customers" search={{ q: l.email }}>
            <User className="h-4 w-4" /> כרטיס לקוח
          </Link>
        </Button>
      </div>
    </li>
  );
}
