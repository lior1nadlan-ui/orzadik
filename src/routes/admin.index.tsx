import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatILS } from "@/lib/cart";

export const Route = createFileRoute("/admin/")({
  component: AdminHome,
});

function AdminHome() {
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const [p, o, c, rev] = await Promise.all([
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("orders").select("id", { count: "exact", head: true }),
        supabase.from("categories").select("id", { count: "exact", head: true }),
        // Revenue = paid orders only. Summing every order (incl. unpaid/pending/
        // failed) overstated income.
        supabase.from("orders").select("total").eq("payment_status", "paid"),
      ]);
      const total = (rev.data ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);
      return { products: p.count ?? 0, orders: o.count ?? 0, categories: c.count ?? 0, revenue: total };
    },
  });

  const cards = [
    { label: "מוצרים", value: stats?.products ?? "-" },
    { label: "קטגוריות", value: stats?.categories ?? "-" },
    { label: "הזמנות", value: stats?.orders ?? "-" },
    { label: "סך הכנסות", value: stats ? formatILS(stats.revenue) : "-" },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold mb-6">סקירה כללית</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border bg-card p-5">
            <div className="text-sm text-muted-foreground">{c.label}</div>
            <div className="text-2xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
