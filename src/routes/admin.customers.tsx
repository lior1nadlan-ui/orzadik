import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCustomers,
  getCustomerDetail,
  addCustomerNote,
  deleteCustomerNote,
  exportCustomersCsv,
  SEGMENT_HE,
  DORMANT_AFTER_DAYS,
  type CustomerFilter,
  type CustomerSegment,
} from "@/lib/admin-crm.functions";
import { formatILS } from "@/lib/cart";
import {
  addFollowUp,
  deleteFollowUp,
  listCustomerFollowUps,
  updateFollowUp,
} from "@/lib/crm-tasks.functions";
import { dateInputValue } from "@/lib/crm-tasks";
import { waMessage } from "@/lib/wa-templates";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bell,
  Download,
  Phone,
  Mail,
  MessageCircle,
  Clock,
  ShoppingCart,
  Trash2,
} from "lucide-react";

export const Route = createFileRoute("/admin/customers")({
  // Deep-linkable search: the orders dialog links here with the customer email.
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === "string" ? s.q : undefined,
  }),
  component: AdminCustomers,
});

const PAYMENT_HE: Record<string, string> = {
  paid: "שולם",
  unpaid: "לא שולם",
  failed: "תשלום נכשל",
  refunded: "זוכה",
};

const dateHe = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString("he-IL") : "—";

function waLink(phone: string): string {
  const digits = String(phone ?? "").replace(/\D/g, "");
  const intl = digits.startsWith("0") ? "972" + digits.slice(1) : digits;
  return `https://wa.me/${intl}`;
}

const SHOP = "אור זרוע לצדיק";

/** Segment pill colours. Muted on purpose — these sit in every row, so they
 * have to be readable at a glance without turning the table into a rainbow.
 * "lead" is the only one that gets a warm colour, because it is the only one
 * that means someone tried to buy and the money never arrived. */
const SEGMENT_STYLE: Record<CustomerSegment, string> = {
  contact: "bg-stone-100 text-stone-700",
  lead: "bg-amber-100 text-amber-900",
  new: "bg-sky-100 text-sky-900",
  repeat: "bg-emerald-100 text-emerald-900",
};

/** Chip order is triage order, not alphabetical: the two that mean "someone is
 * waiting" come first, then the people who have not bought yet and the list a
 * campaign may go to, then the descriptive ones, then the escape hatch. */
const SEGMENT_CHIPS: { key: CustomerFilter; label: string }[] = [
  { key: "lead", label: SEGMENT_HE.lead },
  { key: "dormant", label: `רדומים (${DORMANT_AFTER_DAYS}+ ימים)` },
  { key: "contact", label: SEGMENT_HE.contact },
  { key: "optin", label: "מאשרי דיוור" },
  { key: "repeat", label: SEGMENT_HE.repeat },
  { key: "new", label: SEGMENT_HE.new },
  { key: "all", label: "הכל" },
];

/** "לפני 3 ימים" / "היום" — the number the owner actually reasons about, next
 * to the date they can verify it against. */
function sinceLabel(days: number | null | undefined): string {
  if (days === null || days === undefined) return "";
  if (days === 0) return "היום";
  if (days === 1) return "אתמול";
  return `לפני ${days} ימים`;
}

/** A quiet nudge for a customer who has gone dormant — warm, not salesy, and
 * it never claims a reason for the silence. Same waMessage() normalization as
 * every other WhatsApp link here, so a missing phone falls back cleanly. */
function waWeMissYou(c: { name?: string; phone?: string } | null | undefined): string | null {
  const name = String(c?.name ?? "").trim();
  const greet = name ? `שלום ${name}` : "שלום";
  const text =
    `${greet}! 💛\n` +
    `כאן מ"${SHOP}". עבר קצת זמן מאז שהתראינו ורצינו פשוט לשאול מה שלומך. ` +
    `אם מתקרב אירוע, בר מצווה או חתונה — נשמח לעזור לבחור ולהתאים אישית. 🙏`;
  return waMessage(c?.phone, text);
}

/** Warm, generic WhatsApp greeting for a customer — no order context, just a
 * human hello that references them by name and opens the door to help. Built on
 * waMessage() so phone normalization stays identical to waLink(); returns null
 * when there is no usable phone, so callers fall back to the bare wa.me link. */
function waGreeting(c: { name?: string; phone?: string } | null | undefined): string | null {
  const name = String(c?.name ?? "").trim();
  const greet = name ? `שלום ${name}` : "שלום";
  const text =
    `${greet}! 💛\n` +
    `כאן מהחנות "${SHOP}". רצינו רק להגיד תודה שאתה חלק מהמשפחה שלנו — ` +
    `ואם יש שאלה, בקשה מיוחדת או משהו שנוכל לעזור בו, אנחנו כאן בשבילך. 🙏`;
  return waMessage(c?.phone, text);
}

function AdminCustomers() {
  const qc = useQueryClient();
  const list = useServerFn(listCustomers);
  const detail = useServerFn(getCustomerDetail);
  const addNote = useServerFn(addCustomerNote);
  const delNote = useServerFn(deleteCustomerNote);
  const exportCsv = useServerFn(exportCustomersCsv);

  // Search seeded from the URL so deep links land on a filtered list.
  const search = Route.useSearch();
  const [q, setQ] = useState(search.q ?? "");
  const [debouncedQ, setDebouncedQ] = useState(search.q ?? "");
  const [sort, setSort] = useState<"ltv" | "recent" | "orders">("ltv");
  const [segment, setSegment] = useState<CustomerFilter>("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);
  useEffect(() => setPage(0), [debouncedQ, sort, segment]);

  const { data, isFetching } = useQuery({
    queryKey: ["admin-customers", debouncedQ, sort, segment, page],
    placeholderData: keepPreviousData,
    queryFn: () => list({ data: { q: debouncedQ || undefined, sort, segment, page } }),
  });
  const customers = data?.rows ?? [];
  const counts = data?.counts;
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  const { data: cust } = useQuery({
    queryKey: ["admin-customer", selected?.email],
    enabled: !!selected,
    queryFn: () => detail({ data: { email: selected.email } }),
  });

  const refreshDetail = () =>
    qc.invalidateQueries({ queryKey: ["admin-customer", selected?.email] });

  const onAddNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      await addNote({ data: { email: selected.email, note: noteText.trim() } });
      setNoteText("");
      toast.success("ההערה נשמרה");
      refreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בשמירת ההערה");
    } finally {
      setSavingNote(false);
    }
  };

  const onDeleteNote = async (id: string) => {
    try {
      await delNote({ data: { id } });
      toast.success("ההערה נמחקה");
      refreshDetail();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה במחיקה");
    }
  };

  const doExport = async () => {
    try {
      // Exports exactly what the table is showing, filter included — a CSV that
      // silently ignored the segment filter would be a different list from the
      // one the owner is looking at when they click.
      const { csv, count } = await exportCsv({
        data: { q: debouncedQ || undefined, sort, segment, page: 0 },
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`יוצאו ${count} לקוחות`);
    } catch (e: any) {
      toast.error(e?.message ?? "הייצוא נכשל");
    }
  };

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-4">לקוחות ({total})</h1>

      <div className="flex flex-wrap gap-2 mb-4">
        <Input
          placeholder="חיפוש: שם / אימייל / טלפון"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as any)}
          className="rounded-md border bg-background px-3 py-2 text-sm"
        >
          <option value="ltv">לפי סך קניות</option>
          <option value="recent">לפי פעילות אחרונה</option>
          <option value="orders">לפי מס׳ הזמנות</option>
        </select>
        <Button size="sm" variant="outline" onClick={doExport}>
          <Download className="h-4 w-4 ml-1" /> ייצוא CSV
        </Button>
      </div>

      {/* Segment chips rather than a dropdown: the counts are the point. A
          dropdown hides "3 people ordered and never paid" behind a click
          nobody makes, and that is the row worth acting on today. Counts
          follow the search box, so they always describe the list on screen. */}
      <div className="flex flex-wrap gap-1.5 mb-4" role="group" aria-label="סינון לפי סוג לקוח">
        {SEGMENT_CHIPS.map((chip) => {
          const n = counts?.[chip.key] ?? 0;
          const active = segment === chip.key;
          return (
            <button
              key={chip.key}
              type="button"
              onClick={() => setSegment(chip.key)}
              aria-pressed={active}
              // An empty segment stays visible but muted and unclickable —
              // "0 רדומים" is genuinely good news and worth reading, while a
              // chip that filters to nothing is a dead end.
              disabled={n === 0 && chip.key !== "all"}
              className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${
                active
                  ? "bg-primary text-primary-foreground border-primary"
                  : n === 0 && chip.key !== "all"
                    ? "text-muted-foreground/50"
                    : "[@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
              }`}
            >
              {chip.label} <span className="font-semibold">{n}</span>
            </button>
          );
        })}
      </div>

      <div
        className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}
      >
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="p-3">לקוח</th>
              <th className="p-3">קשר</th>
              <th className="p-3">הזמנות</th>
              <th className="p-3">סך קניות</th>
              <th className="p-3">הזמנה / פעילות אחרונה</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {customers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {debouncedQ
                    ? "אין לקוחות תואמים."
                    : "אין עדיין לקוחות — הם יופיעו כאן עם ההרשמה או ההזמנה הראשונה."}
                </td>
              </tr>
            )}
            {customers.map((c: any) => (
              <tr key={c.email} className="border-t">
                <td className="p-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-medium">
                      {c.name || <span className="text-muted-foreground">ללא שם</span>}
                    </span>
                    <span
                      className={`text-[11px] rounded-full px-2 py-0.5 ${SEGMENT_STYLE[c.segment as CustomerSegment]}`}
                    >
                      {SEGMENT_HE[c.segment as CustomerSegment]}
                    </span>
                    {c.dormant && (
                      <span
                        className="text-[11px] rounded-full bg-muted text-muted-foreground px-2 py-0.5"
                        title={`אין הזמנה כבר ${c.daysSinceLastOrder} ימים`}
                      >
                        רדום
                      </span>
                    )}
                    <ContactBadges c={c} />
                  </div>
                  <div className="text-xs text-muted-foreground">{c.email}</div>
                </td>
                <td className="p-3">
                  <div className="flex gap-1.5">
                    {/* A member who never gave a phone has no call or WhatsApp
                        button at all — a tel: link to nothing is a dead tap. */}
                    {c.phone && (
                      <a
                        href={`tel:${c.phone}`}
                        className="rounded-full border p-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                        title={c.phone}
                      >
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    )}
                    {/* A dormant customer gets the "we missed you" opener
                        instead of the generic hello — same one tap, but the
                        message fits the only thing that is actually different
                        about them. */}
                    {c.phone && (
                      <a
                        href={(c.dormant ? waWeMissYou(c) : waGreeting(c)) ?? waLink(c.phone)}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-full border p-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted text-emerald-700"
                        title={
                          c.dormant
                            ? "WhatsApp — הודעת ״מזמן לא התראינו״"
                            : "WhatsApp — הודעת ברכה מוכנה"
                        }
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </a>
                    )}
                    <a
                      href={`mailto:${c.email}`}
                      className="rounded-full border p-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                      title={c.email}
                    >
                      <Mail className="h-3.5 w-3.5" />
                    </a>
                  </div>
                </td>
                <td className="p-3">
                  {c.orders}
                  {c.paidOrders !== c.orders && (
                    <span className="text-xs text-muted-foreground"> ({c.paidOrders} שולמו)</span>
                  )}
                </td>
                <td className={`p-3 ${c.ltv > 0 ? "font-bold" : "text-muted-foreground"}`}>
                  {formatILS(c.ltv)}
                </td>
                <td className="p-3 text-xs">
                  {c.lastOrderAt ? (
                    <>
                      <div>{dateHe(c.lastOrderAt)}</div>
                      <div className={c.dormant ? "text-amber-700" : "text-muted-foreground"}>
                        {sinceLabel(c.daysSinceLastOrder)}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-muted-foreground">אין הזמנה</div>
                      <div className="text-muted-foreground">
                        פעילות: {sinceLabel(c.daysSinceActivity) || "—"}
                      </div>
                    </>
                  )}
                </td>
                <td className="p-3">
                  <Button size="sm" variant="outline" onClick={() => setSelected(c)}>
                    כרטיס לקוח
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            הקודם
          </Button>
          <span>
            עמוד {page + 1} מתוך {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            הבא
          </Button>
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  {selected.name || selected.email}
                  {/* The same two badges the row carries. The card is where a
                      note gets written and a decision gets made, so losing the
                      context that made the row worth opening would be the wrong
                      place to save space. */}
                  <span
                    className={`text-[11px] font-normal rounded-full px-2 py-0.5 ${SEGMENT_STYLE[selected.segment as CustomerSegment]}`}
                  >
                    {SEGMENT_HE[selected.segment as CustomerSegment]}
                  </span>
                  {selected.dormant && (
                    <span className="text-[11px] font-normal rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                      רדום
                    </span>
                  )}
                  <ContactBadges c={selected} />
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  {selected.phone && (
                    <a
                      href={`tel:${selected.phone}`}
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                    >
                      <Phone className="h-3 w-3" /> {selected.phone}
                    </a>
                  )}
                  {selected.phone && (
                    <a
                      href={
                        (selected.dormant ? waWeMissYou(selected) : waGreeting(selected)) ??
                        waLink(selected.phone)
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted text-emerald-700"
                      title={
                        selected.dormant
                          ? "WhatsApp — הודעת ״מזמן לא התראינו״"
                          : "WhatsApp — הודעת ברכה מוכנה"
                      }
                    >
                      <MessageCircle className="h-3 w-3" /> וואטסאפ
                    </a>
                  )}
                  <a
                    href={`mailto:${selected.email}`}
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                  >
                    <Mail className="h-3 w-3" /> {selected.email}
                  </a>
                  {selected.contactConsent && (
                    <span className="text-[11px] rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5">
                      אישר/ה יצירת קשר
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">הזמנות</div>
                    <div className="text-lg font-bold">{selected.orders}</div>
                    {selected.paidOrders !== selected.orders && (
                      <div className="text-xs text-muted-foreground">
                        {selected.paidOrders} שולמו
                      </div>
                    )}
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">סך קניות</div>
                    <div className="text-lg font-bold">{formatILS(selected.ltv)}</div>
                  </div>
                  {/* Average order: over PAID orders only, the same money the
                      "סך קניות" box counts — an unpaid attempt is not a basket
                      size. */}
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">ממוצע להזמנה</div>
                    <div className="text-lg font-bold">
                      {selected.paidOrders > 0
                        ? formatILS(Math.round(selected.ltv / selected.paidOrders))
                        : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs text-muted-foreground">הזמנה אחרונה</div>
                    <div className="text-lg font-bold">{dateHe(selected.lastOrderAt)}</div>
                    <div
                      className={`text-xs ${selected.dormant ? "text-amber-700" : "text-muted-foreground"}`}
                    >
                      {sinceLabel(selected.daysSinceLastOrder)}
                    </div>
                  </div>
                </div>

                <CustomerTimelineFacts selected={selected} cust={cust} />

                <FollowUpsSection
                  email={selected.email}
                  onChanged={() => qc.invalidateQueries({ queryKey: ["admin-customers"] })}
                />

                {/* Notes */}
                <div className="border-t pt-3">
                  <div className="font-semibold mb-2">הערות פנימיות</div>
                  <div className="flex gap-2 mb-2">
                    <Input
                      placeholder='למשל: "ביקש הקדשה עד חמישי"'
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && onAddNote()}
                    />
                    <Button size="sm" disabled={savingNote || !noteText.trim()} onClick={onAddNote}>
                      {savingNote ? "שומר..." : "הוסף"}
                    </Button>
                  </div>
                  <div className="space-y-1.5">
                    {(cust?.notes ?? []).map((n: any) => (
                      <div
                        key={n.id}
                        className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
                      >
                        <div>
                          <div>{n.note}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {new Date(n.created_at).toLocaleString("he-IL")}
                          </div>
                        </div>
                        <button
                          onClick={() => onDeleteNote(n.id)}
                          className="text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
                          title="מחק"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {(cust?.notes ?? []).length === 0 && (
                      <div className="text-xs text-muted-foreground">אין הערות עדיין.</div>
                    )}
                  </div>
                </div>

                {/* Orders history */}
                <CartsSection carts={cust?.carts ?? []} />

                <div className="border-t pt-3">
                  <div className="font-semibold mb-2">היסטוריית הזמנות</div>
                  {cust && cust.orders.length === 0 && (
                    <div className="text-xs text-muted-foreground">עדיין לא הזמין/ה.</div>
                  )}
                  <div className="space-y-2">
                    {(cust?.orders ?? []).map((o: any) => (
                      <div key={o.id} className="rounded-md border px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <Link
                              to="/admin/orders"
                              search={{ q: o.order_number }}
                              className="font-mono text-xs underline text-primary"
                            >
                              {o.order_number}
                            </Link>
                            <span className="mx-2 text-xs text-muted-foreground">
                              {new Date(o.created_at).toLocaleDateString("he-IL")}
                            </span>
                            <span className="text-[11px] rounded-full bg-muted px-2 py-0.5">
                              {PAYMENT_HE[o.payment_status] ?? o.payment_status}
                            </span>
                          </div>
                          <div className="font-bold">{formatILS(Number(o.total))}</div>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {(o.order_items ?? [])
                            .map((it: any) => `${it.product_name} ×${it.quantity}`)
                            .join(" · ")}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** What a row knows beyond its orders: club membership, whether it may be
 * marketed to, and money sitting in an open cart. Each badge is a fact from its
 * own table; none is shown unless it is true. */
function ContactBadges({ c }: { c: any }) {
  const reminderLate = c.nextFollowUpAt && Date.parse(c.nextFollowUpAt) < Date.now();
  return (
    <>
      {c.nextFollowUpAt && (
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-normal rounded-full px-2 py-0.5 ${
            reminderLate ? "bg-amber-100 text-amber-900" : "bg-accent/10 text-accent-strong"
          }`}
          title="תזכורת פתוחה"
        >
          <Bell className="h-3 w-3" aria-hidden="true" />
          {dateHe(c.nextFollowUpAt)}
        </span>
      )}
      {c.isMember && (
        <span
          className="text-[11px] font-normal rounded-full bg-accent/10 text-accent-strong px-2 py-0.5"
          title={c.memberSince ? `חבר מועדון מאז ${dateHe(c.memberSince)}` : "חבר מועדון"}
        >
          חבר מועדון
        </span>
      )}
      {c.marketingConsent && (
        <span
          className="text-[11px] font-normal rounded-full bg-emerald-50 text-emerald-800 px-2 py-0.5"
          title={c.newsletter ? "רשום לניוזלטר" : "סימן הסכמה לדיוור בהרשמה"}
        >
          מאשר דיוור
        </span>
      )}
      {c.openCartValue > 0 && (
        <span
          className="inline-flex items-center gap-1 text-[11px] font-normal rounded-full bg-amber-50 text-amber-900 px-2 py-0.5"
          title={c.openCarts > 1 ? `${c.openCarts} עגלות פתוחות` : "עגלה פתוחה"}
        >
          <ShoppingCart className="h-3 w-3" aria-hidden="true" />
          {formatILS(c.openCartValue)}
        </span>
      )}
    </>
  );
}

/** One line of relationship facts under the numbers: since when the shop has
 * known this person, and what they agreed to. Consent is shown with its date
 * and source because "may I write to them?" is a legal question, and the
 * answer has to be checkable. */
function CustomerTimelineFacts({ selected, cust }: { selected: any; cust: any }) {
  const profile = cust?.profile;
  const nl = cust?.newsletter;
  const facts: string[] = [];
  if (selected.firstSeenAt) facts.push(`מכירים מאז ${dateHe(selected.firstSeenAt)}`);
  if (profile?.is_member) {
    facts.push(`חבר מועדון מאז ${dateHe(profile.member_since ?? profile.created_at)}`);
  }
  if (profile?.marketing_consent) {
    facts.push(
      [
        "אישר דיוור",
        profile.marketing_consent_at ? dateHe(profile.marketing_consent_at) : "",
        profile.marketing_consent_source ? `(${profile.marketing_consent_source})` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }
  if (nl) {
    facts.push(
      nl.unsubscribed_at
        ? `הוסר מהניוזלטר ${dateHe(nl.unsubscribed_at)}`
        : `רשום לניוזלטר מאז ${dateHe(nl.consented_at ?? nl.created_at)}`,
    );
  }
  if (facts.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {facts.map((f) => (
        <li key={f}>{f}</li>
      ))}
    </ul>
  );
}

/** Carts this person left, newest first, with what was in them — the card is
 * where the owner decides whether to call, and "₪540 of tefillin, two days ago"
 * is the reason to. A converted cart stays listed, marked, so the history is
 * honest about what the reminder emails achieved. */
function CartsSection({ carts }: { carts: any[] }) {
  if (carts.length === 0) return null;
  return (
    <div className="border-t pt-3">
      <div className="font-semibold mb-2">עגלות</div>
      <div className="space-y-2">
        {carts.map((k) => {
          const items = (Array.isArray(k.items) ? k.items : []) as {
            name?: string;
            quantity?: number;
          }[];
          const state = k.converted_order_id
            ? { label: "הפכה להזמנה", cls: "bg-emerald-100 text-emerald-900" }
            : k.unsubscribed
              ? { label: "ביקש לא לקבל תזכורות", cls: "bg-muted text-muted-foreground" }
              : { label: "פתוחה", cls: "bg-amber-100 text-amber-900" };
          const reminders = [k.reminder_1_sent_at, k.reminder_2_sent_at].filter(Boolean).length;
          return (
            <div key={k.id} className="rounded-md border px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {dateHe(k.updated_at ?? k.created_at)}
                  </span>
                  <span className={`text-[11px] rounded-full px-2 py-0.5 ${state.cls}`}>
                    {state.label}
                  </span>
                  {reminders > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      {reminders === 1 ? "נשלחה תזכורת" : `נשלחו ${reminders} תזכורות`}
                    </span>
                  )}
                </div>
                <div className="font-bold">{formatILS(Number(k.subtotal) || 0)}</div>
              </div>
              {items.length > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {items.map((it) => `${it.name ?? "פריט"} ×${it.quantity ?? 1}`).join(" · ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Reminders for this customer — "להתקשר ביום חמישי לגבי הכיתוב". A reminder
 * falls due at 08:00 Israel time on the chosen day, then sits at the top of
 * "מה לעשות היום" and in the morning briefing until it is marked done. Done
 * ones stay listed, struck through, so the card keeps the history.
 */
function FollowUpsSection({ email, onChanged }: { email: string; onChanged: () => void }) {
  const qc = useQueryClient();
  const list = useServerFn(listCustomerFollowUps);
  const add = useServerFn(addFollowUp);
  const update = useServerFn(updateFollowUp);
  const remove = useServerFn(deleteFollowUp);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => dateInputValue(Date.now(), 1));
  const [busy, setBusy] = useState(false);

  const key = ["admin-customer-followups", email];
  const { data: rows = [] } = useQuery({ queryKey: key, queryFn: () => list({ data: { email } }) });

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: key });
    await qc.invalidateQueries({ queryKey: ["admin-action-queue"] });
    onChanged();
  };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e?.message ?? "השמירה נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const onAdd = () => {
    if (!title.trim() || !date) return;
    void act(async () => {
      await add({ data: { email, title: title.trim(), date } });
      setTitle("");
      setDate(dateInputValue(Date.now(), 1));
    }, "התזכורת נשמרה");
  };

  const today = dateInputValue(Date.now());
  return (
    <div className="border-t pt-3">
      <div className="font-semibold mb-2">תזכורות</div>
      <div className="flex flex-wrap gap-2 mb-2">
        <Input
          placeholder='למשל: "להתקשר לגבי הכיתוב על הטלית"'
          value={title}
          maxLength={500}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          className="min-w-0 flex-1 basis-56"
        />
        <Input
          type="date"
          value={date}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="w-auto"
          aria-label="תאריך התזכורת"
        />
        <Button size="sm" disabled={busy || !title.trim() || !date} onClick={onAdd}>
          <Bell className="h-3.5 w-3.5 ml-1" /> הוסף
        </Button>
      </div>
      <div className="space-y-1.5">
        {rows.map((f: any) => {
          const done = !!f.done_at;
          const late = !done && Date.parse(f.due_at) < Date.now();
          return (
            <div
              key={f.id}
              className="flex items-start justify-between gap-2 rounded-md bg-muted/40 px-3 py-2"
            >
              <label className="flex min-w-0 items-start gap-2">
                <input
                  type="checkbox"
                  checked={done}
                  disabled={busy}
                  onChange={() =>
                    void act(
                      () => update({ data: { id: f.id, action: done ? "reopen" : "done" } }),
                      done ? "התזכורת נפתחה מחדש" : "בוצע ✓",
                    )
                  }
                  className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className={done ? "line-through text-muted-foreground" : ""}>
                    {f.title}
                  </span>
                  <span
                    className={`block text-[11px] ${late ? "text-amber-700" : "text-muted-foreground"}`}
                  >
                    {done
                      ? `בוצע ${dateHe(f.done_at)}`
                      : `${late ? "באיחור · " : ""}ל-${dateHe(f.due_at)}`}
                  </span>
                </span>
              </label>
              <div className="flex shrink-0 items-center gap-1.5">
                {!done && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      void act(
                        () => update({ data: { id: f.id, action: "days3" } }),
                        "נדחה ב-3 ימים",
                      )
                    }
                    className="text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground"
                    title="דחה ב-3 ימים"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => remove({ data: { id: f.id } }), "התזכורת נמחקה")}
                  className="text-muted-foreground [@media(hover:hover)_and_(pointer:fine)]:hover:text-destructive"
                  title="מחק"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && (
          <div className="text-xs text-muted-foreground">
            אין תזכורות. תזכורת מופיעה ב"מה לעשות היום" ובסיכום הבוקר מהתאריך שנבחר.
          </div>
        )}
      </div>
    </div>
  );
}
