import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { listPendingReviews, setReviewApproval, deleteReview } from "@/lib/reviews.functions";
import { Stars } from "@/components/Stars";
import { CardSkeleton } from "@/components/Skeletons";
import { Button } from "@/components/ui/button";

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
      <h1 className="font-display text-2xl font-bold mb-6">חוות דעת</h1>
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton className="min-h-[7rem]" />
          <CardSkeleton className="min-h-[7rem]" />
          <CardSkeleton className="min-h-[7rem]" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">אין חוות דעת.</div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r: any) => (
            <div key={r.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Stars value={r.rating} size={15} />
                    <span className="font-semibold text-sm">{r.author_name}</span>
                    {r.is_approved ? (
                      <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">מאושר</span>
                    ) : (
                      <span className="text-xs rounded-full bg-amber-100 text-amber-700 px-2 py-0.5">ממתין</span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {r.products?.name ?? "מוצר"} · {new Date(r.created_at).toLocaleDateString("he-IL")}
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
