// "על מה הקופון חל" in the CRM coupon form: the whole shop, categories (with
// their sub-categories) or chosen products. The same pickers as the promotions
// form, against the same admin-only server functions.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, X } from "lucide-react";
import { listCategoriesForBulk } from "@/lib/admin-products.functions";
import { productsByIds, searchPromotionProducts } from "@/lib/admin-promotions.functions";
import type { CouponScope } from "@/lib/coupons";
import { CategoryPicker } from "@/components/admin/CategoryPicker";
import { Input } from "@/components/ui/input";

const SCOPES: { value: CouponScope; label: string; hint: string }[] = [
  { value: "all", label: "כל האתר", hint: "כל המוצרים" },
  { value: "categories", label: "קטגוריות", hint: "כולל תתי-קטגוריות" },
  { value: "products", label: "מוצרים מסוימים", hint: "חיפוש ובחירה" },
];

type Picked = { id: string; name: string; sku: string | null };

export function CouponScopePicker({
  scope,
  categoryIds,
  productIds,
  onChange,
}: {
  scope: CouponScope;
  categoryIds: string[];
  productIds: string[];
  onChange: (next: { scope?: CouponScope; categoryIds?: string[]; productIds?: string[] }) => void;
}) {
  const loadCats = useServerFn(listCategoriesForBulk);
  const search = useServerFn(searchPromotionProducts);
  const loadPicked = useServerFn(productsByIds);

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin-categories-bulk"],
    queryFn: () => loadCats(),
    enabled: scope === "categories",
  });

  // Chosen products with names for the chips; seeded with the saved ids so an
  // existing coupon never loses its list while the names load.
  const [picked, setPicked] = useState<Picked[]>(() =>
    productIds.map((id) => ({ id, name: "…", sku: null })),
  );
  useEffect(() => {
    if (productIds.length === 0) return;
    void loadPicked({ data: { ids: productIds } }).then((rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      setPicked((cur) => cur.map((p) => byId.get(p.id) ?? p));
    });
    // Names once, for the ids the form opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setProducts = (next: Picked[]) => {
    setPicked(next);
    onChange({ productIds: next.map((p) => p.id) });
  };

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: results = [] } = useQuery({
    queryKey: ["coupon-product-search", debounced],
    enabled: scope === "products" && debounced.length >= 2,
    queryFn: () => search({ data: { q: debounced } }),
  });

  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-3">
        {SCOPES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => onChange({ scope: s.value })}
            aria-pressed={scope === s.value}
            className={`rounded-lg border p-2.5 text-right text-sm ${scope === s.value ? "border-primary bg-primary/5 font-semibold" : "hover:bg-muted"}`}
          >
            {s.label}
            <div className="text-xs font-normal text-muted-foreground">{s.hint}</div>
          </button>
        ))}
      </div>

      {scope === "categories" && (
        <CategoryPicker
          categories={categories}
          loading={catsLoading}
          emptyNote="בחרו קטגוריה אחת או יותר. תתי-הקטגוריות שלה נכללות אוטומטית."
          selected={new Set(categoryIds)}
          onToggle={(id) =>
            onChange({
              categoryIds: categoryIds.includes(id)
                ? categoryIds.filter((c) => c !== id)
                : [...categoryIds, id],
            })
          }
        />
      )}

      {scope === "products" && (
        <div className="space-y-2 rounded-md border p-3">
          {picked.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {picked.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setProducts(picked.filter((x) => x.id !== p.id))}
                  className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs hover:bg-primary/10"
                  aria-label={`הסרת ${p.name}`}
                >
                  {p.name}
                  <X className="h-3 w-3" />
                </button>
              ))}
            </div>
          )}
          <div className="relative">
            <Search className="absolute right-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="חיפוש מוצר לפי שם או מק״ט…"
              className="pr-8"
              aria-label="חיפוש מוצר"
            />
          </div>
          {results.length > 0 && (
            <ul className="max-h-48 overflow-y-auto rounded border text-sm">
              {results
                .filter((r) => !picked.some((p) => p.id === r.id))
                .map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-right hover:bg-muted"
                      onClick={() =>
                        setProducts([...picked, { id: r.id, name: r.name, sku: r.sku }])
                      }
                    >
                      <span className="truncate">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted-foreground">{r.sku ?? ""}</span>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
