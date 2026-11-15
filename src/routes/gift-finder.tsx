import { useMemo, type ReactNode } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ProductCard } from "@/components/ProductCard";
import { PageHeader } from "@/components/PageHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CardSkeleton } from "@/components/Skeletons";
import { fetchCollectionProducts } from "@/lib/collection-products";
import { budgetByKey, filterGifts, giftOccasions, GIFT_BUDGETS } from "@/lib/gift-finder";

/**
 * מוצא המתנות — three short questions (occasion, budget, a name or not), and a
 * shelf of real products from the occasion collections the site already
 * curates (collections.ts), narrowed by the price the shopper pays. The answers
 * live in the URL (?occasion=&budget=&name=1), so a result can be shared or
 * sent on WhatsApp. Rules and tests: src/lib/gift-finder.ts.
 */

const SITE = "https://orzadik.com";
/** How many matches to show; the full shelf is one link away. */
const SHOWN = 24;
/** How many of the collection's products to narrow down from. */
const POOL = 300;

type GiftSearch = { occasion?: string; budget?: string; name?: "1" };

export const Route = createFileRoute("/gift-finder")({
  validateSearch: (s: Record<string, unknown>): GiftSearch => ({
    occasion: typeof s.occasion === "string" ? s.occasion.slice(0, 60) : undefined,
    budget: typeof s.budget === "string" ? s.budget.slice(0, 20) : undefined,
    name: s.name === "1" || s.name === 1 ? "1" : undefined,
  }),
  head: () => ({
    meta: [
      { title: "מוצא המתנות | אור זרוע לצדיק" },
      {
        name: "description",
        content:
          "שלוש שאלות קצרות: לאיזה אירוע, באיזה תקציב והאם להוסיף שם אישי. ומדף מתנות מותאם מתוך הקטלוג של אור זרוע לצדיק.",
      },
      { property: "og:title", content: "מוצא המתנות | אור זרוע לצדיק" },
      { property: "og:url", content: `${SITE}/gift-finder` },
    ],
    links: [{ rel: "canonical", href: `${SITE}/gift-finder` }],
  }),
  component: GiftFinderPage,
});

function Question({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className="font-display text-lg font-semibold">
        {n}. {title}
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`press rounded-full border px-4 py-2 text-sm transition-[background-color,color,border-color] duration-150 ease-out ${
        pressed
          ? "border-primary bg-primary font-semibold text-primary-foreground"
          : "bg-card [@media(hover:hover)_and_(pointer:fine)]:hover:border-accent"
      }`}
    >
      {children}
    </button>
  );
}

function GiftFinderPage() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/gift-finder" });
  // The coming holiday leads, like the homepage's occasion rail.
  const occasions = useMemo(() => giftOccasions(Date.now()), []);
  const occasion = occasions.find((o) => o.collection.slug === search.occasion) ?? null;
  const budget = budgetByKey(search.budget);
  const withName = search.name === "1";
  const set = (patch: Partial<GiftSearch>) =>
    void navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false });

  const { data, isLoading, isError } = useQuery({
    queryKey: ["gift-finder", occasion?.collection.slug],
    queryFn: () => fetchCollectionProducts(occasion!.collection, POOL),
    enabled: !!occasion,
    staleTime: 5 * 60 * 1000,
  });
  const matches = useMemo(
    () => (data ? filterGifts(data, budget, withName) : []),
    [data, budget, withName],
  );

  const shelfLink = occasion && (
    <Link
      to="/collection/$slug"
      params={{ slug: occasion.collection.slug }}
      className="text-accent underline underline-offset-2"
    >
      כל המתנות ל{occasion.label}
    </Link>
  );

  return (
    <div className="pb-16">
      <div className="container mx-auto px-4 py-3">
        <Breadcrumb items={[{ label: "בית", to: "/" }, { label: "מוצא המתנות" }]} />
        <PageHeader
          eyebrow="מתנה לכל שמחה"
          title="מוצא המתנות"
          sub="שלוש שאלות קצרות, ומדף מתנות מתוך הקטלוג שמתאים לאירוע, לתקציב, ולשם אישי אם תרצו."
        />
      </div>

      <section className="container mx-auto max-w-3xl space-y-6 px-4" aria-label="השאלות">
        <Question n={1} title="לאיזה אירוע?">
          {occasions.map((o) => (
            <Chip
              key={o.collection.slug}
              pressed={occasion?.collection.slug === o.collection.slug}
              onClick={() => set({ occasion: o.collection.slug })}
            >
              {o.label}
            </Chip>
          ))}
        </Question>
        <Question n={2} title="באיזה תקציב?">
          {GIFT_BUDGETS.map((b) => (
            <Chip
              key={b.key}
              pressed={budget.key === b.key}
              onClick={() => set({ budget: b.key === "any" ? undefined : b.key })}
            >
              {b.label}
            </Chip>
          ))}
        </Question>
        <Question n={3} title="להוסיף שם אישי?">
          <Chip pressed={!withName} onClick={() => set({ name: undefined })}>
            לא צריך
          </Chip>
          <Chip pressed={withName} onClick={() => set({ name: "1" })}>
            כן, ברקמה, בהטבעה או בחריטה
          </Chip>
        </Question>
      </section>

      <section className="container mx-auto mt-10 px-4" aria-live="polite">
        {!occasion ? (
          <p className="text-center text-muted-foreground">בחרו אירוע, והמתנות יופיעו כאן.</p>
        ) : isLoading ? (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <CardSkeleton key={i} className="aspect-[3/4]" />
            ))}
          </div>
        ) : isError ? (
          <p className="text-center text-muted-foreground">
            לא הצלחנו לטעון את המתנות כרגע. אפשר לעבור על {shelfLink}.
          </p>
        ) : matches.length === 0 ? (
          <p className="mx-auto max-w-xl text-center text-muted-foreground">
            לא מצאנו מתנה ל{occasion.label} בטווח הזה{withName ? " עם שם אישי" : ""}. נסו טווח אחר,
            או עברו על {shelfLink}.
          </p>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground">
              {matches.length === 1
                ? "מתנה אחת"
                : matches.length > SHOWN
                  ? `${SHOWN} מתוך ${matches.length} מתנות`
                  : `${matches.length} מתנות`}{" "}
              ל{occasion.label}
              {budget.key !== "any" ? `, ${budget.label}` : ""}
              {withName ? ", עם אפשרות לשם אישי" : ""}
            </p>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {matches.slice(0, SHOWN).map((p, i) => (
                <ProductCard key={p.id} p={p} eager={i < 4} />
              ))}
            </div>
            <p className="mt-8 text-center">{shelfLink}</p>
          </>
        )}
      </section>
    </div>
  );
}
