import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getProductReviews, submitReview } from "@/lib/reviews.functions";
import type { PublicReview } from "@/lib/reviews.functions";
import { Stars, StarInput } from "@/components/Stars";
import { BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ProductReviews({
  productId,
  initialSummary,
  initialReviews,
}: {
  productId: string;
  initialSummary?: { average: number; count: number };
  initialReviews?: PublicReview[];
}) {
  const qc = useQueryClient();
  const load = useServerFn(getProductReviews);
  const send = useServerFn(submitReview);

  const { data } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => load({ data: { product_id: productId } }),
    // Seed from the SSR loader so the approved list is in the server HTML
    // (crawlable, no post-load reflow) and hydrates identically. React Query
    // still revalidates per its staleness rules. Only present when the loader
    // supplied a list; otherwise the query fetches client-side as before.
    initialData:
      initialReviews !== undefined
        ? { summary: initialSummary ?? { average: 0, count: 0 }, reviews: initialReviews }
        : undefined,
  });

  const summary = data?.summary ?? initialSummary ?? { average: 0, count: 0 };
  const reviews = data?.reviews ?? [];

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("נא להזין שם");
      return;
    }
    setSubmitting(true);
    try {
      await send({
        data: {
          product_id: productId,
          rating,
          author_name: name,
          title: title || null,
          body: body || null,
        },
      });
      toast.success("תודה! חוות הדעת התקבלה ותפורסם לאחר אישור.");
      setOpen(false);
      setName("");
      setTitle("");
      setBody("");
      setRating(5);
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
    } catch (err: any) {
      toast.error(err?.message ?? "שגיאה בשליחת חוות הדעת");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    // scroll-mt offsets the pinned sticky header (bar h-20 + lg nav h-11) so
    // the #reviews anchor is not hidden under it.
    <section id="reviews" className="mt-16 relative scroll-mt-24 lg:scroll-mt-32">
      <div className="gold-rule absolute inset-x-0 top-0" aria-hidden="true" />
      <div className="pt-10">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">
              חוות דעת
            </h2>
            {summary.count > 0 ? (
              <div className="mt-2 flex items-center gap-2">
                <Stars value={summary.average} size={20} />
                <span className="text-sm text-muted-foreground">
                  {summary.average} מתוך 5 · {summary.count} חוות דעת
                </span>
              </div>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">היו הראשונים לחוות דעה על המוצר.</p>
            )}
          </div>
          <Button type="button" onClick={() => setOpen((v) => !v)}>
            כתיבת חוות דעת
          </Button>
        </div>

        {open && (
          <form onSubmit={onSubmit} className="glass mb-8 p-5 space-y-4 max-w-xl">
            <div>
              <Label className="mb-1 block">הדירוג שלך</Label>
              <StarInput value={rating} onChange={setRating} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="rv-name">שם *</Label>
                <Input
                  id="rv-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={80}
                />
              </div>
              <div>
                <Label htmlFor="rv-title">כותרת</Label>
                <Input
                  id="rv-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
              </div>
            </div>
            <div>
              <Label htmlFor="rv-body">חוות הדעת</Label>
              <Textarea
                id="rv-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                maxLength={2000}
                rows={4}
              />
            </div>
            <div className="flex items-center gap-3">
              <Button type="submit" disabled={submitting}>
                {submitting ? "שולח..." : "שליחה"}
              </Button>
              <span className="text-xs text-muted-foreground">חוות הדעת תפורסם לאחר בדיקה.</span>
            </div>
          </form>
        )}

        {reviews.length > 0 && (
          <ul className="space-y-5">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-glass-line pb-5">
                <div className="flex flex-wrap items-center gap-2">
                  <Stars value={r.rating} size={15} />
                  <span className="sr-only">דירוג {r.rating} מתוך 5</span>
                  <span className="font-semibold text-sm">{r.author_name}</span>
                  {/* Verified-buyer badge — shown ONLY when the review is tied to
                      a real order (order_id present), so it is always truthful.
                      The visible Hebrew label carries the meaning for assistive
                      tech; the icon is decorative. */}
                  {r.order_id && (
                    <span className="inline-flex items-center gap-1 rounded-full hairline bg-secondary/60 px-2 py-0.5 text-[11px] font-medium text-accent">
                      <BadgeCheck className="h-3 w-3" aria-hidden="true" />
                      קונה מאומת
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                  </span>
                </div>
                {r.title && <div className="mt-1.5 font-medium text-sm">{r.title}</div>}
                {r.body && (
                  <p className="mt-1 text-sm text-foreground/80 leading-relaxed whitespace-pre-line">
                    {r.body}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
