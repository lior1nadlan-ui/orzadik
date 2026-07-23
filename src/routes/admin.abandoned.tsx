import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAbandonedCarts } from "@/lib/admin-crm.functions";
import { runAbandonedCartRemindersNow } from "@/lib/abandoned-cart.functions";
import { formatILS } from "@/lib/cart";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { waLink } from "@/routes/admin.orders";

export const Route = createFileRoute("/admin/abandoned")({
  component: AdminAbandoned,
});

type ShowFilter = "open" | "converted" | "all";

const FILTERS: { value: ShowFilter; label: string }[] = [
  { value: "open", label: "פתוחות" },
  { value: "converted", label: "הומרו להזמנה" },
  { value: "all", label: "הכל" },
];

/**
 * Why a run sent nothing for a CONFIGURATION reason. Mirrors
 * AbandonedCartRunResult["skipped"] — these must never be reported as success,
 * because "0 נשלחו" would otherwise look identical to an empty queue.
 */
const SKIP_MESSAGES: Record<string, string> = {
  "email-not-configured": "שירות הדיוור אינו מוגדר — לא נשלחה אף תזכורת.",
  "unsubscribe-secret-missing": "חסרה הגדרת קישור ההסרה מרשימת התפוצה — השליחה נעצרה.",
  "scan-failed": "סריקת העגלות נכשלה. פרטים ביומן השרת.",
};

/** Shape of each entry in the items jsonb (see abandoned-cart.functions.ts Schema). */
type CartItem = {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  thumbnail?: string | null;
  slug: string;
};

function AdminAbandoned() {
  const qc = useQueryClient();
  const list = useServerFn(listAbandonedCarts);
  const runReminders = useServerFn(runAbandonedCartRemindersNow);
  const [show, setShow] = useState<ShowFilter>("open");
  const [page, setPage] = useState(0);
  useEffect(() => setPage(0), [show]);

  const { data, isFetching } = useQuery({
    queryKey: ["abandoned", page, show],
    placeholderData: keepPreviousData,
    queryFn: () => list({ data: { page, show } }),
  });

  // Manual sweep. The hourly cron does this on its own; the button is for
  // verifying the pipeline and for draining a backlog straight after a fix.
  // Idempotent — a cart already reminded is never mailed twice.
  const remindersMutation = useMutation({
    mutationFn: () => runReminders(),
    onSuccess: (r) => {
      const skipReason = r.skipped ? SKIP_MESSAGES[r.skipped] ?? r.skipped : null;
      if (skipReason) {
        toast.warning(skipReason);
      } else {
        toast.success(`נסרקו ${r.scanned}, נשלחו ${r.sent}`);
      }
      qc.invalidateQueries({ queryKey: ["abandoned"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "שגיאה בהפעלת התזכורות"),
  });
  const carts = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">עגלות נטושות ({total})</h1>
        <Button
          size="sm"
          onClick={() => remindersMutation.mutate()}
          disabled={remindersMutation.isPending}
        >
          {remindersMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="h-4 w-4" aria-hidden="true" />
          )}
          {remindersMutation.isPending ? "מריץ תזכורות…" : "הפעל תזכורות עכשיו"}
        </Button>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        התזכורות נשלחות אוטומטית מדי שעה לעגלות שננטשו לפני שעה עד 30 יום, ורק ללקוחות שאישרו קבלת
        דיוור. כל עגלה מקבלת תזכורת אחת בלבד.
      </p>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={show === f.value ? "default" : "outline"}
            onClick={() => setShow(f.value)}
          >
            {f.label}
          </Button>
        ))}
      </div>

      <div className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-right">
            <th className="p-3">תאריך</th><th className="p-3">לקוח</th><th className="p-3">פריטים</th>
            <th className="p-3">סכום</th><th className="p-3">תזכורת</th><th className="p-3">סטטוס</th><th className="p-3">יצירת קשר</th>
          </tr></thead>
          <tbody>
            {carts.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">אין עגלות נטושות כרגע.</td></tr>
            )}
            {carts.map((c: any) => {
              const items = (Array.isArray(c.items) ? c.items : []) as CartItem[];
              const itemNames = items.map((it) => `${it.name} ×${it.quantity}`).join(" · ");
              return (
                <tr key={c.id} className="border-t">
                  <td className="p-3 text-xs whitespace-nowrap">
                    <div>{new Date(c.created_at).toLocaleDateString("he-IL")}</div>
                    <div className="text-muted-foreground">
                      {new Date(c.created_at).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="font-medium">{c.name || "—"}</div>
                    <div className="text-xs text-muted-foreground">{c.email}</div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1" title={itemNames}>
                      {items.slice(0, 3).map((it, i) =>
                        it.thumbnail ? (
                          <img
                            key={`${it.product_id}-${i}`}
                            src={it.thumbnail}
                            alt={it.name}
                            loading="lazy"
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <div
                            key={`${it.product_id}-${i}`}
                            className="flex h-8 w-8 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground"
                          >
                            ✦
                          </div>
                        ),
                      )}
                      {items.length > 3 && (
                        <span className="text-xs text-muted-foreground">+{items.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 font-bold">{formatILS(Number(c.subtotal))}</td>
                  <td className="p-3">
                    <span
                      className={`text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap ${
                        c.reminder_1_sent_at || c.reminder_2_sent_at
                          ? "bg-primary/10 text-primary"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {c.reminder_2_sent_at ? "תזכורת 2" : c.reminder_1_sent_at ? "תזכורת 1" : "טרם נשלחה"}
                    </span>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {c.converted_order_id !== null ? (
                        <span className="text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                          הומרה להזמנה
                        </span>
                      ) : (
                        <span className="text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                          פתוחה
                        </span>
                      )}
                      {c.unsubscribed && (
                        <span className="text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap bg-muted text-muted-foreground">
                          הוסר מרשימת התפוצה
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3">
                    {/* Unsubscribed customers asked not to be contacted — no actions. */}
                    {!c.unsubscribed && (
                      <div className="flex gap-1.5">
                        <a
                          href={`mailto:${c.email}`}
                          aria-label="שליחת מייל"
                          title={c.email}
                          className="rounded-full border p-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted"
                        >
                          <Mail className="h-3.5 w-3.5" />
                        </a>
                        {c.phone && (
                          <a
                            href={waLink(c.phone)}
                            target="_blank"
                            rel="noreferrer"
                            aria-label="WhatsApp"
                            title="WhatsApp"
                            className="rounded-full border p-1.5 [@media(hover:hover)_and_(pointer:fine)]:hover:bg-muted text-emerald-700"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>הקודם</Button>
          <span>עמוד {page + 1} מתוך {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>הבא</Button>
        </div>
      )}
    </div>
  );
}
