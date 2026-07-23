import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/admin-crm.functions";
import { formatILS } from "@/lib/cart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import { TrendingUp, TrendingDown } from "lucide-react";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const STATUS_HE: Record<string, string> = {
  pending: "ממתינה", processing: "בטיפול", shipped: "נשלחה",
  completed: "הושלמה", cancelled: "בוטלה", refunded: "זוכתה",
};
const PAYMENT_HE: Record<string, string> = { paid: "שולם", unpaid: "לא שולם", refunded: "זוכה" };

function daysAgoHe(ts: string): string {
  const d = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 864e5));
  if (d === 0) return "היום";
  if (d === 1) return "לפני יום";
  return `לפני ${d} ימים`;
}

/** Period-over-period delta line under a KPI value. Hebrew convention puts the
 * sign after the number ('12%+'); prev === 0 renders a no-data note, never
 * Infinity. */
function TrendDelta({ curr, prev }: { curr: number; prev: number }) {
  const pct = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : null;
  if (pct === null) {
    return <span className="text-xs text-muted-foreground">— אין נתונים לתקופה הקודמת</span>;
  }
  if (pct === 0) {
    return <span className="text-xs text-muted-foreground">ללא שינוי</span>;
  }
  return pct > 0 ? (
    <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
      <TrendingUp className="h-3.5 w-3.5" /> {pct}%+ לעומת התקופה הקודמת
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs text-red-600">
      <TrendingDown className="h-3.5 w-3.5" /> {Math.abs(pct)}%- לעומת התקופה הקודמת
    </span>
  );
}

function AdminHome() {
  const load = useServerFn(getDashboardStats);
  const { data: s, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => load(),
    refetchInterval: 60_000, // keep the dashboard live while it's open
  });

  if (isLoading || !s) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold mb-6">סקירה כללית</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  const kpis: { label: string; value: string; sub: string; days?: number; curr?: number; prev?: number }[] = [
    {
      label: "הכנסות היום", value: formatILS(s.revenue.today), sub: `${s.orders.today} הזמנות`,
      days: 1, curr: s.revenue.today, prev: s.revenue.prevToday,
    },
    {
      label: "7 ימים", value: formatILS(s.revenue.last7), sub: `${s.orders.last7} הזמנות`,
      days: 7, curr: s.revenue.last7, prev: s.revenue.prev7,
    },
    {
      label: "30 יום", value: formatILS(s.revenue.last30), sub: `${s.orders.last30} הזמנות`,
      days: 30, curr: s.revenue.last30, prev: s.revenue.prev30,
    },
    {
      label: 'סה"כ הכנסות',
      value: formatILS(s.revenue.total),
      sub: `${s.orders.totalPaid} משולמות · ממוצע ${formatILS(s.orders.avgOrderValue)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">סקירה כללית</h1>

      {/* KPI row — each card deep-links to the orders page pre-filtered */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((c) => (
          <Link
            key={c.label}
            to="/admin/orders"
            search={c.days ? { payment: "paid", days: c.days } : { payment: "paid" }}
            className="block rounded-lg border bg-card p-5 transition-colors hover:border-primary/50"
          >
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
            {c.prev !== undefined && (
              <div className="mt-1">
                <TrendDelta curr={c.curr ?? 0} prev={c.prev} />
              </div>
            )}
          </Link>
        ))}
      </div>

      {/* Abandoned carts KPI + catalog health */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          to="/admin/abandoned"
          className={`block rounded-lg border p-5 transition-colors hover:border-primary/50 ${
            s.abandoned.openCount > 0
              ? "border-amber-400/60 bg-amber-50 dark:bg-amber-950/20"
              : "bg-card"
          }`}
        >
          <div
            className={`text-sm ${
              s.abandoned.openCount > 0
                ? "font-semibold text-amber-800 dark:text-amber-300"
                : "text-muted-foreground"
            }`}
          >
            🛒 עגלות נטושות פתוחות
          </div>
          <div className="text-2xl font-bold mt-1">{s.abandoned.openCount}</div>
          <div className="text-xs text-muted-foreground mt-1">
            {s.abandoned.openCount > 0
              ? `${formatILS(s.abandoned.recoverable)} לשחזור`
              : "אין עגלות נטושות פתוחות כרגע"}
          </div>
        </Link>

        {/* Catalog health. Plain link only — admin.products.tsx has no
            validateSearch yet; follow-up: add it there next round so this can
            deep-link pre-filtered (e.g. ?health=no-image). */}
        {(() => {
          const healthIssues = s.catalogHealth.noImage > 0 || s.catalogHealth.outOfStock > 0;
          return (
            <Link
              to="/admin/products"
              className={`block rounded-lg border p-5 transition-colors hover:border-primary/50 ${
                healthIssues ? "border-amber-400/60 bg-amber-50 dark:bg-amber-950/20" : "bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className={`text-sm font-semibold ${
                    healthIssues ? "text-amber-800 dark:text-amber-300" : ""
                  }`}
                >
                  תקינות קטלוג
                </div>
                {!healthIssues && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    הקטלוג תקין ✓
                  </span>
                )}
              </div>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between gap-3">
                  <span>מוצרים פעילים ללא תמונה:</span>
                  <strong>{s.catalogHealth.noImage}</strong>
                </div>
                <div className="flex justify-between gap-3">
                  <span>מוצרים פעילים שאזלו מהמלאי:</span>
                  <strong>{s.catalogHealth.outOfStock}</strong>
                </div>
              </div>
            </Link>
          );
        })()}
      </div>

      {/* Stuck-unpaid alert */}
      {s.stuckUnpaidCount > 0 && (
        <div className="rounded-lg border border-amber-400/60 bg-amber-50 dark:bg-amber-950/20 p-4">
          <div className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
            ⏳ {s.stuckUnpaidCount} הזמנות ממתינות לתשלום (מעל שעה)
          </div>
          <div className="space-y-1 text-sm">
            {s.stuckUnpaid.map((o: any) => (
              <div key={o.id} className="flex justify-between">
                <span>
                  <span className="font-mono text-xs">{o.order_number}</span> · {o.customer_name}
                </span>
                <span className="text-muted-foreground">
                  {formatILS(o.total)} · {new Date(o.created_at).toLocaleDateString("he-IL")}
                </span>
              </div>
            ))}
          </div>
          <Link
            to="/admin/orders"
            search={{ payment: "unpaid" }}
            className="text-xs underline text-amber-700 dark:text-amber-400 mt-2 inline-block"
          >
            לכל ההזמנות ←
          </Link>
        </div>
      )}

      {/* Ready-to-ship action queue */}
      {s.readyToShip.count > 0 && (
        <div className="rounded-lg border border-emerald-400/60 bg-emerald-50 dark:bg-emerald-950/20 p-4">
          <div className="font-semibold text-emerald-800 dark:text-emerald-300 mb-2">
            📦 {s.readyToShip.count} הזמנות שולמו וממתינות למשלוח
          </div>
          <div className="space-y-1 text-sm">
            {s.readyToShip.items.map((o: any) => (
              <div key={o.id} className="flex justify-between">
                <span>
                  <span className="font-mono text-xs">{o.order_number}</span> · {o.customer_name}
                </span>
                <span className="text-muted-foreground">
                  {formatILS(o.total)} · {daysAgoHe(o.paid_at)}
                </span>
              </div>
            ))}
          </div>
          <Link
            to="/admin/orders"
            search={{ payment: "paid" }}
            className="text-xs underline text-emerald-700 dark:text-emerald-400 mt-2 inline-block"
          >
            לכל ההזמנות הממתינות ←
          </Link>
        </div>
      )}

      {/* Revenue chart */}
      <div className="rounded-lg border bg-card p-5">
        <div className="font-semibold mb-3">הכנסות — 30 הימים האחרונים</div>
        {s.revenue.last30 === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            אין עדיין הכנסות בתקופה זו — הגרף יתעורר עם ההזמנה המשולמת הראשונה.
          </div>
        ) : (
          <div dir="ltr" className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.series} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => d.slice(8, 10) + "/" + d.slice(5, 7)}
                  fontSize={11}
                  interval={4}
                />
                <YAxis fontSize={11} width={44} tickFormatter={(v: number) => `₪${v}`} />
                <Tooltip
                  formatter={(v: any) => [formatILS(Number(v)), "הכנסות"]}
                  labelFormatter={(d: any) => new Date(d).toLocaleDateString("he-IL")}
                />
                <Bar dataKey="revenue" fill="#A8862A" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent orders */}
        <div className="rounded-lg border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold">הזמנות אחרונות</div>
            <Link to="/admin/orders" className="text-xs text-primary underline">הכל ←</Link>
          </div>
          {s.recentOrders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">אין עדיין הזמנות.</div>
          ) : (
            <div className="space-y-2 text-sm">
              {s.recentOrders.map((o: any) => (
                <Link
                  key={o.id}
                  to="/admin/orders"
                  search={{ q: o.order_number }}
                  className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0 transition-colors hover:bg-muted/40"
                >
                  <div>
                    <span className="font-mono text-xs">{o.order_number}</span>
                    <span className="mx-2">{o.customer_name}</span>
                    <span
                      className={`text-[11px] rounded-full px-2 py-0.5 ${
                        o.payment_status === "paid"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                      }`}
                    >
                      {PAYMENT_HE[o.payment_status] ?? o.payment_status}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="font-bold">{formatILS(o.total)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(o.created_at).toLocaleDateString("he-IL")}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Top products + status breakdown */}
        <div className="space-y-4">
          <div className="rounded-lg border bg-card p-5">
            <div className="font-semibold mb-3">מוצרים מובילים (לפי הכנסה)</div>
            {s.topProducts.length === 0 ? (
              <div className="py-4 text-center text-sm text-muted-foreground">אין עדיין מכירות.</div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {s.topProducts.map((p: any) => (
                  <div key={p.name} className="flex justify-between gap-3">
                    <span className="truncate">{p.name}</span>
                    <span className="whitespace-nowrap text-muted-foreground">
                      ×{p.qty} · <span className="font-medium text-foreground">{formatILS(p.revenue)}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="rounded-lg border bg-card p-5">
            <div className="font-semibold mb-3">פילוח סטטוסים</div>
            {Object.keys(s.statusCounts).length === 0 ? (
              <div className="py-2 text-center text-sm text-muted-foreground">—</div>
            ) : (
              <div className="flex flex-wrap gap-2 text-sm">
                {Object.entries(s.statusCounts).map(([st, n]) => (
                  <Link
                    key={st}
                    to="/admin/orders"
                    search={{ status: st }}
                    className="rounded-full border px-3 py-1 transition-colors hover:bg-muted"
                  >
                    {STATUS_HE[st] ?? st}: <strong>{n as number}</strong>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
