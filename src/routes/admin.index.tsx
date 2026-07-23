import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboardStats } from "@/lib/admin-crm.functions";
import { formatILS } from "@/lib/cart";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

const STATUS_HE: Record<string, string> = {
  pending: "ממתינה", processing: "בטיפול", shipped: "נשלחה",
  completed: "הושלמה", cancelled: "בוטלה", refunded: "זוכתה",
};
const PAYMENT_HE: Record<string, string> = { paid: "שולם", unpaid: "לא שולם", refunded: "זוכה" };

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

  const kpis = [
    { label: "הכנסות היום", value: formatILS(s.revenue.today), sub: `${s.orders.today} הזמנות` },
    { label: "7 ימים", value: formatILS(s.revenue.last7), sub: `${s.orders.last7} הזמנות` },
    { label: "30 יום", value: formatILS(s.revenue.last30), sub: `${s.orders.last30} הזמנות` },
    {
      label: 'סה"כ הכנסות',
      value: formatILS(s.revenue.total),
      sub: `${s.orders.totalPaid} משולמות · ממוצע ${formatILS(s.orders.avgOrderValue)}`,
    },
  ];

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">סקירה כללית</h1>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.sub}</div>
          </div>
        ))}
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
          <Link to="/admin/orders" className="text-xs underline text-amber-700 dark:text-amber-400 mt-2 inline-block">
            לכל ההזמנות ←
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
                <div key={o.id} className="flex items-center justify-between border-b border-border/40 pb-2 last:border-0">
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
                </div>
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
                  <span key={st} className="rounded-full border px-3 py-1">
                    {STATUS_HE[st] ?? st}: <strong>{n as number}</strong>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
