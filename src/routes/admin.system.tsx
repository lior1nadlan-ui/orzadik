import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSystemHealth } from "@/lib/system-health.functions";
import type { HealthStatus } from "@/lib/system-health";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/system")({
  component: AdminSystem,
});

/** Icon + colour per status. Words carry the meaning too (the title and the
 *  detail), so the colour is never the only signal. */
const STATUS_UI: Record<HealthStatus, { mark: string; label: string; cls: string }> = {
  error: { mark: "✕", label: "דורש טיפול", cls: "border-red-300 bg-red-50 text-red-900" },
  warn: { mark: "!", label: "כדאי לבדוק", cls: "border-amber-300 bg-amber-50 text-amber-900" },
  off: { mark: "○", label: "כבוי", cls: "border-stone-300 bg-stone-50 text-stone-800" },
  ok: { mark: "✓", label: "תקין", cls: "border-emerald-200 bg-emerald-50/60 text-emerald-900" },
};

/** Where each row's fix is done, when that place is inside the admin. */
const ROW_LINK: Record<string, { to: string; label: string }> = {
  shipping: { to: "/admin/orders", label: "להזמנות" },
  telegram: { to: "/admin/telegram", label: "להגדרת ההתראות" },
  catalog: { to: "/admin/products", label: "למוצרים" },
  campaigns: { to: "/admin/campaigns", label: "לדיוור" },
};

function AdminSystem() {
  const load = useServerFn(getSystemHealth);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: () => load(),
  });
  const rows = data ?? [];
  const needs = rows.filter((r) => r.status === "error" || r.status === "warn").length;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-bold">מצב המערכת</h1>
        <Button size="sm" variant="outline" disabled={isFetching} onClick={() => refetch()}>
          רענן
        </Button>
      </div>
      <p className="mb-5 text-sm text-muted-foreground">
        כל החלקים האוטומטיים של החנות — האם הם מוגדרים, ומתי כל אחד מהם עשה משהו בפעם האחרונה.
        {rows.length > 0 && (needs > 0 ? ` ${needs} דברים דורשים תשומת לב.` : " הכל תקין.")}
      </p>

      {isLoading && <p className="text-sm text-muted-foreground">בודק…</p>}

      <ul className="space-y-2.5">
        {rows.map((r) => {
          const ui = STATUS_UI[r.status];
          const link = ROW_LINK[r.id];
          return (
            <li key={r.id} className={`rounded-lg border p-4 ${ui.cls}`}>
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-xs font-bold"
                >
                  {ui.mark}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h2 className="font-semibold">{r.title}</h2>
                    <span className="text-xs">{ui.label}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed">{r.detail}</p>
                  {r.fix && (
                    <p className="mt-1.5 text-sm">
                      <strong>מה לעשות: </strong>
                      {r.fix}
                    </p>
                  )}
                  {link && r.status !== "ok" && (
                    <Link
                      to={link.to}
                      className="mt-2 inline-block text-sm font-semibold underline"
                    >
                      {link.label} ←
                    </Link>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
