// CRM → מבצעים. Create, schedule, edit and end promotions; each one shows on
// the site as a promotional price with a -X% badge (docs/promotions-wave.md).
//
// The owner flow, top to bottom: name and site label → percent → what it
// covers (the whole store / categories / chosen products) → dates → a live
// preview of how many products and what they will cost → save. A running
// promotion can be ended from its row.
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgePercent, Plus, Search, X } from "lucide-react";
import {
  listPromotions,
  previewPromotion,
  savePromotion,
  endPromotion,
  searchPromotionProducts,
  productsByIds,
  type PromotionListItem,
} from "@/lib/admin-promotions.functions";
import { listCategoriesForBulk } from "@/lib/admin-products.functions";
import {
  STATUS_LABEL,
  HIGH_DISCOUNT,
  MAX_PERCENT,
  scopeSummary,
  promotionInputErrors,
  toLocalInput,
  fromLocalInput,
  defaultWindow,
  type PromotionInput,
  type PromotionScope,
  type PromotionStatus,
} from "@/lib/admin-promotions";
import { formatPromoEnd } from "@/lib/promotions";
import { formatILS } from "@/lib/cart";
import { CategoryPicker } from "@/components/admin/CategoryPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/promotions")({ component: AdminPromotions });

const STATUS_CLS: Record<PromotionStatus, string> = {
  active: "bg-emerald-100 text-emerald-900",
  scheduled: "bg-amber-100 text-amber-900",
  ended: "bg-muted text-muted-foreground",
  disabled: "bg-destructive/10 text-destructive",
};

const SCOPES: { value: PromotionScope; label: string; hint: string }[] = [
  { value: "categories", label: "קטגוריות", hint: "כולל כל תתי-הקטגוריות" },
  { value: "products", label: "מוצרים מסוימים", hint: "חיפוש ובחירה" },
  { value: "all", label: "כל החנות", hint: "כל המוצרים באתר" },
];

type PickedProduct = { id: string; name: string; sku: string | null; price: number };

const emptyForm = (): PromotionInput & { id?: string } => ({
  name: "",
  badge_label: "",
  percent_off: 10,
  scope: "categories",
  category_ids: [],
  product_ids: [],
  ...defaultWindow(),
  confirm_high_discount: false,
});

function AdminPromotions() {
  const qc = useQueryClient();
  const load = useServerFn(listPromotions);
  const end = useServerFn(endPromotion);

  const { data: promotions = [], isLoading } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: () => load(),
    // Status moves with the clock (scheduled → active → ended).
    refetchInterval: 60_000,
  });

  const [editing, setEditing] = useState<(PromotionInput & { id?: string }) | null>(null);

  const endMut = useMutation({
    mutationFn: (id: string) => end({ data: { id } }),
    onSuccess: () => {
      toast.success("המבצע הסתיים. המחירים באתר חוזרים לרגילים תוך דקה.");
      void qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const running = promotions.filter((p) => p.status === "active");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold">מבצעים</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            הנחה באחוזים על מחיר האתר, לתקופה מוגדרת. באתר יופיעו מחיר המבצע, המחיר הרגיל מחוק
            ותווית ההנחה.
          </p>
        </div>
        <Button onClick={() => setEditing(emptyForm())}>
          <Plus className="ms-1 h-4 w-4" /> מבצע חדש
        </Button>
      </div>

      {running.length > 0 && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
          <BadgePercent className="me-1 inline h-4 w-4" />
          {running.length === 1
            ? "מבצע אחד פעיל עכשיו"
            : `${running.length} מבצעים פעילים עכשיו`}:{" "}
          {running.map((p) => `${p.name} (${p.percent_off}%)`).join(" · ")}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">טוען…</p>
      ) : promotions.length === 0 ? (
        <div className="rounded-lg border p-8 text-center text-sm text-muted-foreground">
          עוד לא נוצרו מבצעים. לחצו על "מבצע חדש" כדי להתחיל.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-right">
              <tr>
                <th className="p-3 font-medium">מבצע</th>
                <th className="p-3 font-medium">הנחה</th>
                <th className="p-3 font-medium">על מה</th>
                <th className="p-3 font-medium">תאריכים</th>
                <th className="p-3 font-medium">סטטוס</th>
                <th className="p-3 font-medium">מכירות</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {promotions.map((p) => (
                <PromotionRow
                  key={p.id}
                  p={p}
                  onEdit={() =>
                    setEditing({
                      id: p.id,
                      name: p.name,
                      badge_label: p.badge_label ?? "",
                      percent_off: p.percent_off,
                      scope: p.scope,
                      category_ids: p.category_ids,
                      product_ids: p.product_ids,
                      starts_at: p.starts_at,
                      ends_at: p.ends_at,
                      confirm_high_discount: p.percent_off > HIGH_DISCOUNT,
                    })
                  }
                  onEnd={() => {
                    const verb = p.status === "active" ? "לסיים עכשיו" : "לבטל";
                    if (window.confirm(`${verb} את "${p.name}"?`)) endMut.mutate(p.id);
                  }}
                  ending={endMut.isPending && endMut.variables === p.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PromotionDialog
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void qc.invalidateQueries({ queryKey: ["admin-promotions"] });
          }}
        />
      )}
    </div>
  );
}

function PromotionRow({
  p,
  onEdit,
  onEnd,
  ending,
}: {
  p: PromotionListItem;
  onEdit: () => void;
  onEnd: () => void;
  ending: boolean;
}) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat("he-IL", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  return (
    <tr className="border-t align-top">
      <td className="p-3">
        <div className="font-medium">{p.name}</div>
        {p.badge_label && (
          <div className="text-xs text-muted-foreground">באתר: {p.badge_label}</div>
        )}
      </td>
      <td className="p-3 font-semibold" dir="ltr">
        -{p.percent_off}%
      </td>
      <td className="p-3">
        {scopeSummary(p)}
        {p.product_count !== null && (
          <div className="text-xs text-muted-foreground">{p.product_count} מוצרים פעילים</div>
        )}
      </td>
      <td className="p-3 whitespace-nowrap text-xs">
        <div>מ-{fmt(p.starts_at)}</div>
        <div>עד {fmt(p.ends_at)}</div>
      </td>
      <td className="p-3">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLS[p.status]}`}>
          {STATUS_LABEL[p.status]}
        </span>
      </td>
      <td className="p-3 text-xs">
        {p.paid_orders > 0 ? (
          <>
            <div>{p.paid_orders} הזמנות</div>
            <div className="text-muted-foreground">{formatILS(p.revenue)}</div>
          </>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="p-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={onEdit}>
            עריכה
          </Button>
          {(p.status === "active" || p.status === "scheduled") && (
            <Button size="sm" variant="destructive" onClick={onEnd} disabled={ending}>
              {p.status === "active" ? "סיים עכשיו" : "ביטול"}
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}

function PromotionDialog({
  initial,
  onClose,
  onSaved,
}: {
  initial: PromotionInput & { id?: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const save = useServerFn(savePromotion);
  const preview = useServerFn(previewPromotion);
  const loadCats = useServerFn(listCategoriesForBulk);
  const search = useServerFn(searchPromotionProducts);
  const loadPicked = useServerFn(productsByIds);

  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const isNew = !form.id;

  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin-categories-bulk"],
    queryFn: () => loadCats(),
  });

  // Chosen products, with names for the chips.
  // Seeded with the saved ids (names fill in when they load), so the sync below
  // never empties an existing promotion's product list while the names load.
  const [picked, setPicked] = useState<PickedProduct[]>(() =>
    initial.product_ids.map((id) => ({ id, name: "…", sku: null, price: 0 })),
  );
  useEffect(() => {
    if (initial.product_ids.length === 0) return;
    void loadPicked({ data: { ids: initial.product_ids } }).then((rows) => {
      const byId = new Map(rows.map((r) => [r.id, r]));
      setPicked((cur) => cur.map((p) => byId.get(p.id) ?? p));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setForm((f) => ({ ...f, product_ids: picked.map((p) => p.id) })), [picked]);

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const { data: results = [] } = useQuery({
    queryKey: ["promo-product-search", debounced],
    enabled: form.scope === "products" && debounced.length >= 2,
    queryFn: () => search({ data: { q: debounced } }),
  });

  // Live preview: how many products, and what they will cost.
  const previewKey = useMemo(
    () => [form.scope, form.category_ids.join(","), form.product_ids.join(","), form.percent_off],
    [form.scope, form.category_ids, form.product_ids, form.percent_off],
  );
  const { data: pv, isFetching: pvLoading } = useQuery({
    queryKey: ["promo-preview", ...previewKey],
    enabled:
      form.scope === "all" ||
      (form.scope === "categories" && form.category_ids.length > 0) ||
      (form.scope === "products" && form.product_ids.length > 0),
    queryFn: () =>
      preview({
        data: {
          scope: form.scope,
          category_ids: form.category_ids,
          product_ids: form.product_ids,
          percent_off: Number(form.percent_off) || 0,
        },
      }),
  });

  const errors = promotionInputErrors(
    { ...form, percent_off: Number(form.percent_off) },
    { isNew },
  );
  const saveMut = useMutation({
    mutationFn: () =>
      save({
        data: {
          ...form,
          percent_off: Number(form.percent_off),
          badge_label: form.badge_label?.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(
        isNew
          ? "המבצע נשמר. הוא יופיע באתר בזמן ההתחלה (עד דקה עיכוב)."
          : "השינויים נשמרו. האתר מתעדכן תוך דקה.",
      );
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = Number(form.percent_off) || 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "מבצע חדש" : "עריכת מבצע"}</DialogTitle>
          <DialogDescription>
            ההנחה נוספת על המחיר שהאתר גובה היום. באתר יוצגו מחיר המבצע, המחיר הרגיל מחוק ותווית{" "}
            <span dir="ltr">-{pct}%</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* 1. Name and site label */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="promo-name">שם המבצע (פנימי)</Label>
              <Input
                id="promo-name"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="למשל: חנוכה 2026"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-label">תווית לאתר (לא חובה)</Label>
              <Input
                id="promo-label"
                value={form.badge_label ?? ""}
                onChange={(e) => set("badge_label", e.target.value)}
                placeholder="למשל: מבצע חנוכה"
                maxLength={40}
              />
            </div>
          </div>

          {/* 2. Percent */}
          <div className="space-y-1.5">
            <Label htmlFor="promo-pct">אחוז הנחה</Label>
            <div className="flex items-center gap-2">
              <Input
                id="promo-pct"
                type="number"
                min={1}
                max={MAX_PERCENT}
                step={1}
                value={form.percent_off}
                onChange={(e) => set("percent_off", Number(e.target.value))}
                className="w-28"
                dir="ltr"
              />
              <span className="text-sm text-muted-foreground">% (עד {MAX_PERCENT})</span>
            </div>
            {pct > HIGH_DISCOUNT && (
              <label className="mt-2 flex items-center gap-2 text-sm text-destructive">
                <Checkbox
                  checked={!!form.confirm_high_discount}
                  onCheckedChange={(v) => set("confirm_high_discount", v === true)}
                />
                אני מאשר/ת הנחה של {pct}% — יותר מחצי מהמחיר.
              </label>
            )}
          </div>

          {/* 3. What it covers */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">על מה המבצע חל</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {SCOPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => set("scope", s.value)}
                  aria-pressed={form.scope === s.value}
                  className={`rounded-lg border p-3 text-right text-sm ${form.scope === s.value ? "border-primary bg-primary/5 font-semibold" : "hover:bg-muted"}`}
                >
                  {s.label}
                  <div className="text-xs font-normal text-muted-foreground">{s.hint}</div>
                </button>
              ))}
            </div>

            {form.scope === "categories" && (
              <CategoryPicker
                categories={categories}
                loading={catsLoading}
                emptyNote="בחרו קטגוריה אחת או יותר. תתי-הקטגוריות שלה נכללות אוטומטית."
                selected={new Set(form.category_ids)}
                onToggle={(id) =>
                  set(
                    "category_ids",
                    form.category_ids.includes(id)
                      ? form.category_ids.filter((c) => c !== id)
                      : [...form.category_ids, id],
                  )
                }
              />
            )}

            {form.scope === "products" && (
              <div className="space-y-2 rounded-md border p-3">
                {picked.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {picked.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPicked((cur) => cur.filter((x) => x.id !== p.id))}
                        className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs hover:bg-primary/10"
                        aria-label={`הסר את ${p.name}`}
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
                    placeholder="חיפוש לפי שם או מק״ט…"
                    className="pr-8"
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
                            onClick={() => setPicked((cur) => [...cur, r])}
                          >
                            <span className="truncate">{r.name}</span>
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {r.sku ?? ""}
                            </span>
                          </button>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}
          </fieldset>

          {/* 4. Dates */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="promo-start">התחלה</Label>
              <Input
                id="promo-start"
                type="datetime-local"
                value={toLocalInput(form.starts_at)}
                onChange={(e) => set("starts_at", fromLocalInput(e.target.value))}
                dir="ltr"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="promo-end">סיום (חובה)</Label>
              <Input
                id="promo-end"
                type="datetime-local"
                value={toLocalInput(form.ends_at)}
                onChange={(e) => set("ends_at", fromLocalInput(e.target.value))}
                dir="ltr"
              />
            </div>
          </div>

          {/* 5. Preview */}
          <div className="rounded-lg bg-muted/40 p-3 text-sm">
            <div className="mb-1 font-medium">תצוגה מקדימה</div>
            {pvLoading && !pv ? (
              <p className="text-muted-foreground">מחשב…</p>
            ) : !pv ? (
              <p className="text-muted-foreground">בחרו על מה המבצע חל כדי לראות את המוצרים.</p>
            ) : pv.count === 0 ? (
              <p className="text-destructive">אין מוצרים פעילים בבחירה הזו.</p>
            ) : (
              <div className="space-y-2">
                <p>
                  <strong>{pv.count}</strong> מוצרים יקבלו <span dir="ltr">-{pct}%</span>.
                  {pv.range && (
                    <>
                      {" "}
                      הזול ביותר: {formatILS(pv.range.from.regular)} ←{" "}
                      <strong>{formatILS(pv.range.from.pays)}</strong>; היקר ביותר:{" "}
                      {formatILS(pv.range.to.regular)} ←{" "}
                      <strong>{formatILS(pv.range.to.pays)}</strong>.
                    </>
                  )}
                </p>
                {pv.sample.length > 0 && (
                  <ul className="text-xs text-muted-foreground">
                    {pv.sample.map((s) => (
                      <li key={s.id} className="truncate">
                        {s.name}
                      </li>
                    ))}
                  </ul>
                )}
                {form.ends_at && (
                  <p className="text-xs text-muted-foreground">
                    באתר ייכתב: "המבצע בתוקף עד {formatPromoEnd(form.ends_at)}"
                  </p>
                )}
              </div>
            )}
          </div>

          {errors.length > 0 && (
            <ul className="list-disc space-y-0.5 pr-5 text-sm text-destructive">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            ביטול
          </Button>
          <Button
            onClick={() => saveMut.mutate()}
            disabled={errors.length > 0 || saveMut.isPending}
          >
            {saveMut.isPending ? "שומר…" : isNew ? "שמירה והפעלה" : "שמירת שינויים"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
