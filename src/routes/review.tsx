import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { getOrderForReview, submitVerifiedReview } from "@/lib/reviews.functions";
import { StarInput } from "@/components/Stars";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BadgeCheck, CheckCircle2 } from "lucide-react";

// Verified-buyer review page. Reached only via the signed link in the
// post-purchase review-request email (/review?order=<uuid>&token=<hmac>). The
// token is verified server-side in the loader (getOrderForReview); this file
// never sees the signing secret and never renders any customer data beyond the
// products on the order.
export const Route = createFileRoute("/review")({
  // Unknown/missing params narrow to undefined and render the calm "invalid
  // link" state — no detail leak.
  validateSearch: (s: Record<string, unknown>): { order?: string; token?: string } => ({
    order: typeof s.order === "string" ? s.order : undefined,
    token: typeof s.token === "string" ? s.token : undefined,
  }),
  loaderDeps: ({ search }) => ({ order: search.order, token: search.token }),
  // SSR-verify the signed link server-side. Any failure resolves to null so the
  // page shows one calm message and never confirms whether an order exists.
  loader: async ({ deps }) => {
    if (!deps.order || !deps.token) return { info: null };
    try {
      const info = await getOrderForReview({
        data: { order: deps.order, token: deps.token },
      });
      return { info };
    } catch {
      return { info: null };
    }
  },
  head: () => ({
    meta: [
      { title: "כתיבת חוות דעת | אור זרוע לצדיק" },
      // Private, token-scoped page — keep it out of search results entirely.
      { name: "robots", content: "noindex, nofollow" },
    ],
    links: [{ rel: "canonical", href: "https://orzadik.com/review" }],
  }),
  component: ReviewPage,
});

function ReviewPage() {
  const { info } = Route.useLoaderData();
  const { order: orderId, token } = Route.useSearch();
  const send = useServerFn(submitVerifiedReview);

  const products = info?.products ?? [];
  const [productId, setProductId] = useState(products[0]?.product_id ?? "");
  const [rating, setRating] = useState(5);
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [done, setDone] = useState(false);

  const mutation = useMutation<{ ok: true }, Error, void>({
    mutationFn: () =>
      send({
        data: {
          order: orderId!,
          token: token!,
          product_id: productId,
          rating,
          author_name: name.trim(),
          title: title.trim() || null,
          body: body.trim() || null,
        },
      }),
    onSuccess: () => setDone(true),
    onError: (e) => toast.error(e.message || "שגיאה בשליחת חוות הדעת"),
  });

  // Invalid / expired link — one calm message, no detail about why.
  if (!info) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <div className="glass p-8 text-center space-y-4">
          <h1 className="font-display text-2xl font-bold text-foreground">הקישור אינו תקין</h1>
          <p className="text-sm text-muted-foreground">
            ייתכן שהקישור פג או שאינו מלא. אפשר לכתוב חוות דעת ישירות מעמוד המוצר בחנות.
          </p>
          <Link to="/shop">
            <Button className="press">חזרה לחנות</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-lg">
        <div className="glass p-8 text-center space-y-4">
          <div className="glass glass-gold [--glass-radius:9999px] mx-auto flex h-20 w-20 items-center justify-center">
            <CheckCircle2 className="h-10 w-10 text-accent" aria-hidden="true" />
          </div>
          <h1 className="font-display text-2xl font-bold text-foreground">תודה על חוות הדעת!</h1>
          <p className="text-sm text-muted-foreground">
            חוות הדעת התקבלה ותפורסם לאחר בדיקה קצרה. תודה שעזרת לקונים הבאים.
          </p>
          <Link to="/shop">
            <Button variant="outline" className="press">
              המשך לקנות
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId) {
      toast.error("נא לבחור מוצר");
      return;
    }
    if (!name.trim()) {
      toast.error("נא להזין שם");
      return;
    }
    mutation.mutate();
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-xl">
      <PageHeader
        eyebrow="חוות דעת מאומתת"
        title="איך היה?"
        sub={'חוות הדעת שלך תסומן כ"קונה מאומת" ותעזור לקונים הבאים. היא תתפרסם לאחר בדיקה.'}
      />

      <form onSubmit={onSubmit} className="glass p-6 space-y-5">
        {products.length > 1 ? (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-foreground">על איזה מוצר?</legend>
            <div className="space-y-2">
              {products.map((p) => (
                <label
                  key={p.product_id}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    productId === p.product_id ? "hairline-gold bg-secondary/60" : "hairline"
                  }`}
                >
                  <input
                    type="radio"
                    name="product"
                    value={p.product_id}
                    checked={productId === p.product_id}
                    onChange={() => setProductId(p.product_id)}
                    className="accent-accent"
                  />
                  <span className="text-foreground">{p.product_name}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : (
          <div className="flex items-center gap-2 rounded-lg hairline-gold bg-secondary/50 px-3 py-2.5 text-sm">
            <BadgeCheck className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
            <span className="text-foreground">{products[0]?.product_name}</span>
          </div>
        )}

        <div>
          {/* Not a <label>: StarInput is a radiogroup, not a single labelable
              control, so a bare <label htmlFor> can't point at it. The visible
              caption is a <p>; the radiogroup carries its own aria-label. */}
          <p className="mb-1 text-sm font-medium leading-none">הדירוג שלך</p>
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
            rows={5}
          />
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={mutation.isPending} className="press">
            {mutation.isPending ? "שולח..." : "שליחת חוות דעת"}
          </Button>
          <span className="text-xs text-muted-foreground">חוות הדעת תפורסם לאחר בדיקה.</span>
        </div>
      </form>
    </div>
  );
}
