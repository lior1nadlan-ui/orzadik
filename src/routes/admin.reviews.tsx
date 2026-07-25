import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listPendingReviews, setReviewApproval, deleteReview } from "@/lib/reviews.functions";
import { Stars } from "@/components/Stars";
import { CardSkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";

export const Route = createFileRoute("/admin/reviews")({
  component: AdminReviews,
});

function AdminReviews() {
  const qc = useQueryClient();
  const load = useServerFn(listPendingReviews);
  const approve = useServerFn(setReviewApproval);
  const remove = useServerFn(deleteReview);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["admin-reviews"],
    queryFn: () => load(),
  });

  // Moderation ergonomics (client-only, purely presentational — the server
  // still returns every review created_at-desc). The owner shouldn't have to
  // hunt for amber "ממתין" pills, so pending reviews sort to the top and a
  // count + "ממתינות / הכל" toggle put the queue front and center.
  const [filter, setFilter] = useState<"pending" | "all">("all");
  const pendingCount = reviews.filter((r: any) => !r.is_approved).length;
  // Array.sort is stable in modern engines, so ordering pending-first preserves
  // the server's created_at-desc order within each group.
  const sorted = [...reviews].sort(
    (a: any, b: any) => Number(a.is_approved) - Number(b.is_approved),
  );
  const visible = filter === "pending" ? sorted.filter((r: any) => !r.is_approved) : sorted;

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-reviews"] });

  const onApprove = async (id: string, approved: boolean) => {
    try {
      await approve({ data: { id, approved } });
      toast.success(approved ? "אושר ופורסם" : "האישור בוטל");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    }
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את חוות הדעת?")) return;
    try {
      await remove({ data: { id } });
      toast.success("נמחק");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-bold">חוות דעת</h1>
          {pendingCount > 0 && (
            <span className="text-xs font-medium rounded-full bg-accent/10 text-accent px-2 py-0.5">
              {pendingCount} ממתינות לאישור
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={filter === "pending" ? "default" : "outline"}
            className="press"
            onClick={() => setFilter("pending")}
          >
            ממתינות{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
          <Button
            size="sm"
            variant={filter === "all" ? "default" : "outline"}
            className="press"
            onClick={() => setFilter("all")}
          >
            הכל
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton className="min-h-[7rem]" />
          <CardSkeleton className="min-h-[7rem]" />
          <CardSkeleton className="min-h-[7rem]" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">אין חוות דעת.</div>
      ) : visible.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          אין חוות דעת שממתינות לאישור.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((r: any) => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} size={15} />
                    <span className="font-semibold text-sm">{r.author_name}</span>
                    {/* Status pills routed through the design tokens so admin
                        matches the white-glass + gold palette instead of raw
                        amber/green. Approved (live/published) takes the gold
                        --accent tint — bg-accent/10 + text-accent reads 5.06:1
                        over the card; pending (awaiting action) is the quiet
                        --muted surface. Moderation logic unchanged. */}
                    {r.is_approved ? (
                      <span className="text-xs font-medium rounded-full bg-accent/10 text-accent px-2 py-0.5">מאושר</span>
                    ) : (
                      <span className="text-xs font-medium rounded-full bg-muted text-muted-foreground px-2 py-0.5">ממתין</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.products?.slug ? (
                      <Link
                        to="/product/$slug"
                        params={{ slug: r.products.slug }}
                        target="_blank"
                        rel="noreferrer"
                        title="פתיחת דף המוצר בכרטיסייה חדשה"
                        className="inline-flex items-center gap-1 text-accent underline-offset-2 transition-colors duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:hover:underline"
                      >
                        {r.products?.name ?? "מוצר"}
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    ) : (
                      r.products?.name ?? "מוצר"
                    )}
                    {" · "}
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                  </div>
                  {r.title && <div className="mt-2 font-medium text-sm">{r.title}</div>}
                  {r.body && <p className="mt-1 text-sm text-foreground/80 whitespace-pre-line">{r.body}</p>}
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  {r.is_approved ? (
                    <Button size="sm" variant="outline" onClick={() => onApprove(r.id, false)}>בטל אישור</Button>
                  ) : (
                    <Button size="sm" className="press" onClick={() => onApprove(r.id, true)}>אשר ופרסם</Button>
                  )}
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onDelete(r.id)}>מחק</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
