import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { formatILS } from "@/lib/cart";
import {
  bulkUpdateProducts,
  listCategoriesForBulk,
  listProductVariants,
  saveProductVariants,
  type AdminVariantRow,
} from "@/lib/admin-products.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Layers } from "lucide-react";

/** Catalog-health filters — the same two predicates the dashboard tile counts. */
type HealthFilter = "no-image" | "out-of-stock";
type SortKey = "created_at" | "name" | "price";
type SortDir = "asc" | "desc";

const HEALTH_HE: Record<HealthFilter, string> = {
  "no-image": "מוצרים פעילים ללא תמונה",
  "out-of-stock": "מוצרים פעילים שאזלו מהמלאי",
};

export const Route = createFileRoute("/admin/products")({
  // Lets the dashboard's low-stock and catalog-health cards deep-link to a
  // pre-filtered list (e.g. /admin/products?q=<sku> or ?health=no-image), and
  // makes every filtered/sorted view a shareable URL.
  validateSearch: (
    s: Record<string, unknown>,
  ): { q?: string; health?: HealthFilter; sort?: SortKey; dir?: SortDir } => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    health: s.health === "no-image" || s.health === "out-of-stock" ? s.health : undefined,
    sort:
      s.sort === "created_at" || s.sort === "name" || s.sort === "price" ? s.sort : undefined,
    dir: s.dir === "asc" || s.dir === "desc" ? s.dir : undefined,
  }),
  component: AdminProducts,
});

type Product = {
  id: string; slug: string; name: string; description: string | null; short_description: string | null;
  price: number; sale_price: number | null; sku: string | null; stock_status: string;
  stock_qty: number | null; thumbnail_url: string | null; is_active: boolean;
  track_stock: boolean;
};

const PAGE_SIZE = 25;

/**
 * Hand-rolled slug maker (no dependency): lowercase, niqqud/diacritics stripped,
 * any run outside [a-z0-9] collapsed to a single "-", edges trimmed. A
 * Hebrew-only name has no Latin form and yields "", so the owner still types
 * those by hand; a name carrying Latin/numerals (brand names, model numbers,
 * sizes) gets a usable slug for free — sparing a non-technical owner the typing.
 */
function slugify(name: string): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[֑-ׇ]/g, "") // Hebrew niqqud / te'amim
    .replace(/[̀-ͯ]/g, "") // Latin combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

type BulkKind = "price_pct" | "price_set" | "category" | "active" | "stock_status" | "restock";

function AdminProducts() {
  const qc = useQueryClient();
  const { q: qFromUrl, health, sort, dir } = Route.useSearch();
  const navigate = Route.useNavigate();
  const sortKey: SortKey = sort ?? "created_at";
  // Newest-first stays the default; the other keys read naturally ascending.
  const sortDir: SortDir = dir ?? (sortKey === "created_at" ? "desc" : "asc");
  const [search, setSearch] = useState(qFromUrl ?? "");
  const [debounced, setDebounced] = useState(qFromUrl ?? "");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);

  const runBulk = useServerFn(bulkUpdateProducts);
  const loadCategories = useServerFn(listCategoriesForBulk);

  useEffect(() => { setSearch(qFromUrl ?? ""); }, [qFromUrl]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [debounced, health, sortKey, sortDir]);
  // A selection only makes sense for rows the admin can currently see — the
  // action applies to ids, not to "the filter", so carrying it across a search
  // or page change would act on rows that scrolled out of view.
  useEffect(() => { setSelected(new Set()); }, [debounced, page, health, sortKey, sortDir]);

  /** Patch the URL so any filtered/sorted view can be bookmarked or shared. */
  const patchSearch = (patch: { health?: HealthFilter; sort?: SortKey; dir?: SortDir }) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false });

  const { data, isFetching } = useQuery({
    queryKey: ["admin-products", debounced, page, health ?? "", sortKey, sortDir],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      let query = supabase.from("products").select("*", { count: "exact" });
      const term = debounced.replace(/[,()%\\]/g, " ").replace(/\s+/g, " ").trim();
      if (term) {
        const like = `%${term}%`;
        query = query.or(`name.ilike.${like},sku.ilike.${like},slug.ilike.${like}`);
      }
      // Byte-identical predicates to the dashboard's catalog-health counters
      // (src/lib/admin-crm.functions.ts) — including the is_active gate — so the
      // tile's number and this list can never disagree. The `.eq.` arm catches
      // empty-string thumbnails the manual product form can save.
      if (health === "no-image") {
        query = query.eq("is_active", true).or("thumbnail_url.is.null,thumbnail_url.eq.");
      } else if (health === "out-of-stock") {
        query = query.eq("is_active", true).eq("stock_status", "outofstock");
      }
      const from = page * PAGE_SIZE;
      const { data, error, count } = await query
        .order(sortKey, { ascending: sortDir === "asc" })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      return { rows: (data ?? []) as Product[], total: count ?? 0 };
    },
  });
  const filtered = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: categories = [] } = useQuery({
    queryKey: ["bulk-categories"],
    enabled: bulkOpen,
    queryFn: () => loadCategories(),
  });

  const allOnPageSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((cur) => {
      const next = new Set(cur);
      if (allOnPageSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setSelected((cur) => {
      const next = new Set(cur);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onSave = async (form: Partial<Product>) => {
    if (editing) {
      const { error } = await supabase.from("products").update(form).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("עודכן");
    } else {
      const { error } = await supabase.from("products").insert({
        slug: form.slug!, name: form.name!, price: form.price ?? 0, sale_price: form.sale_price ?? null,
        sku: form.sku ?? null, description: form.description ?? null, short_description: form.short_description ?? null,
        thumbnail_url: form.thumbnail_url ?? null, stock_status: form.stock_status ?? "instock",
        is_active: form.is_active ?? true,
        track_stock: form.track_stock ?? false,
        stock_qty: form.stock_qty ?? null,
      });
      if (error) return toast.error(error.message);
      toast.success("נוסף");
    }
    setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את המוצר?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("נמחק");
    qc.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <h1 className="font-display text-2xl font-bold">מוצרים ({total})</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> חדש</Button>
          </DialogTrigger>
          <ProductDialog key={editing?.id ?? "new"} product={editing} onSave={onSave} />
        </Dialog>
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1 max-w-sm">
          <Label htmlFor="prod-search" className="text-xs text-muted-foreground">חיפוש</Label>
          <Input
            id="prod-search"
            placeholder="חיפוש: שם / מק״ט / slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-56">
          <Label htmlFor="prod-health" className="text-xs text-muted-foreground">סינון תקינות</Label>
          <select
            id="prod-health"
            value={health ?? ""}
            onChange={(e) =>
              patchSearch({ health: (e.target.value || undefined) as HealthFilter | undefined })
            }
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="">כל המוצרים</option>
            <option value="no-image">{HEALTH_HE["no-image"]}</option>
            <option value="out-of-stock">{HEALTH_HE["out-of-stock"]}</option>
          </select>
        </div>
        <div className="w-56">
          <Label htmlFor="prod-sort" className="text-xs text-muted-foreground">מיון</Label>
          <select
            id="prod-sort"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
              const isDefault = k === "created_at" && d === "desc";
              patchSearch({ sort: isDefault ? undefined : k, dir: isDefault ? undefined : d });
            }}
            className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
          >
            <option value="created_at:desc">נוספו לאחרונה</option>
            <option value="created_at:asc">הוותיקים ביותר</option>
            <option value="name:asc">שם א׳–ת׳</option>
            <option value="name:desc">שם ת׳–א׳</option>
            <option value="price:asc">מחיר — מהנמוך לגבוה</option>
            <option value="price:desc">מחיר — מהגבוה לנמוך</option>
          </select>
        </div>
      </div>

      {health && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-amber-400/60 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          <span>מוצגים רק: {HEALTH_HE[health]} · {total} מוצרים</span>
          <Button size="sm" variant="outline" onClick={() => patchSearch({ health: undefined })}>
            הצג את כל המוצרים
          </Button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 backdrop-blur">
          <span className="text-sm font-medium">נבחרו {selected.size} מוצרים</span>
          <Button size="sm" className="gap-2" onClick={() => setBulkOpen(true)}>
            <Layers className="h-4 w-4" /> פעולות מרובות
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>נקה בחירה</Button>
        </div>
      )}

      <div className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="p-3 w-10">
                <Checkbox
                  checked={allOnPageSelected}
                  onCheckedChange={toggleAll}
                  aria-label="בחר את כל המוצרים בעמוד"
                />
              </th>
              <th className="p-3 font-medium">תמונה</th>
              <th className="p-3 font-medium">שם</th>
              <th className="p-3 font-medium">מחיר</th>
              <th className="p-3 font-medium">מלאי</th>
              <th className="p-3 font-medium">פעיל</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {!isFetching && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-sm text-muted-foreground">
                  לא נמצאו מוצרים התואמים לסינון הנוכחי.
                </td>
              </tr>
            )}
            {filtered.map((p) => (
              <tr key={p.id} className={`border-t ${selected.has(p.id) ? "bg-primary/5" : ""}`}>
                <td className="p-3">
                  <Checkbox
                    checked={selected.has(p.id)}
                    onCheckedChange={() => toggleOne(p.id)}
                    aria-label={`בחר ${p.name}`}
                  />
                </td>
                <td className="p-2">
                  {p.thumbnail_url && <img src={p.thumbnail_url} alt="" loading="lazy" decoding="async" className="h-12 w-12 rounded object-cover" />}
                </td>
                <td className="p-3 max-w-xs"><div className="line-clamp-2">{p.name}</div></td>
                <td className="p-3 whitespace-nowrap">{formatILS(p.sale_price ?? p.price)}</td>
                <td className="p-3">
                  <span className={p.stock_status === "instock" ? "text-green-600" : "text-destructive"}>
                    {p.stock_status === "instock" ? "במלאי" : "אזל"}
                  </span>
                  {p.track_stock && (
                    <span className="block text-[11px] text-muted-foreground">במעקב · {p.stock_qty ?? 0}</span>
                  )}
                </td>
                <td className="p-3">{p.is_active ? "✓" : "✗"}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(p); setOpen(true); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete(p.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4 text-sm">
          <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>הקודם</Button>
          <span>עמוד {page + 1} מתוך {pages}</span>
          <Button size="sm" variant="outline" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)}>הבא</Button>
        </div>
      )}

      <BulkDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={selected.size}
        categories={categories}
        onApply={async (action) => {
          try {
            const res: any = await runBulk({ data: { ids: [...selected], action } });
            toast.success(
              `עודכנו ${res.updated} מוצרים${res.skipped ? ` (${res.skipped} דולגו)` : ""}`,
            );
            // The price actions write products.price only. Where a product has
            // size rows with their own price, checkout charges the size price —
            // so say so instead of leaving the owner to discover it at the till.
            if (res.variantProducts > 0) {
              toast.warning(
                `${res.variantProducts} מוצרים כוללים גדלים עם מחיר נפרד — עדכנו אותם בנפרד`,
                { duration: 12_000 },
              );
            }
            setBulkOpen(false);
            setSelected(new Set());
            qc.invalidateQueries({ queryKey: ["admin-products"] });
          } catch (e: any) {
            toast.error(e?.message ?? "שגיאה בעדכון המוצרים");
          }
        }}
      />
    </div>
  );
}

function BulkDialog({
  open, onOpenChange, count, categories, onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  categories: Array<{ id: string; name: string }>;
  onApply: (action: any) => Promise<void>;
}) {
  const [kind, setKind] = useState<BulkKind>("active");
  const [pct, setPct] = useState(0);
  const [price, setPrice] = useState(0);
  const [qty, setQty] = useState(0);
  const [activeValue, setActiveValue] = useState(true);
  const [stockValue, setStockValue] = useState<"instock" | "outofstock">("instock");
  const [categoryId, setCategoryId] = useState("");
  const [categoryMode, setCategoryMode] = useState<"add" | "remove">("add");
  const [busy, setBusy] = useState(false);

  const isPriceAction = kind === "price_pct" || kind === "price_set";

  const build = () => {
    switch (kind) {
      case "price_pct": return { kind, pct };
      case "price_set": return { kind, price };
      case "restock": return { kind, qty };
      case "active": return { kind, value: activeValue };
      case "stock_status": return { kind, value: stockValue };
      case "category": return { kind, category_id: categoryId, mode: categoryMode };
    }
  };

  const apply = async () => {
    if (kind === "category" && !categoryId) {
      toast.error("יש לבחור קטגוריה");
      return;
    }
    setBusy(true);
    try { await onApply(build()); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>פעולות מרובות · {count} מוצרים</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-kind">פעולה</Label>
            <select
              id="bulk-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as BulkKind)}
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="active">שינוי סטטוס פעיל</option>
              <option value="stock_status">שינוי סטטוס מלאי</option>
              <option value="restock">עדכון כמות במלאי</option>
              <option value="price_pct">שינוי מחיר באחוזים</option>
              <option value="price_set">קביעת מחיר אחיד</option>
              <option value="category">שיוך / הסרה מקטגוריה</option>
            </select>
          </div>

          {kind === "active" && (
            <div className="flex items-center gap-2">
              <Switch checked={activeValue} onCheckedChange={setActiveValue} />
              <Label>{activeValue ? "הפוך לפעילים" : "הפוך ללא פעילים"}</Label>
            </div>
          )}

          {kind === "stock_status" && (
            <select
              value={stockValue}
              onChange={(e) => setStockValue(e.target.value as any)}
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="instock">במלאי</option>
              <option value="outofstock">אזל</option>
            </select>
          )}

          {kind === "restock" && (
            <div>
              <Label htmlFor="bulk-qty">כמות במלאי</Label>
              <Input id="bulk-qty" type="number" min={0} value={qty} onChange={(e) => setQty(Number(e.target.value))} />
            </div>
          )}

          {kind === "price_pct" && (
            <div>
              <Label htmlFor="bulk-pct">שינוי באחוזים (למשל 10 או 15-)</Label>
              <Input id="bulk-pct" type="number" value={pct} onChange={(e) => setPct(Number(e.target.value))} />
              <p className="mt-1 text-[11px] text-muted-foreground">
                מוצרים במחיר 0 ("לפי שער הזהב") לא ישונו.
              </p>
            </div>
          )}

          {kind === "price_set" && (
            <div>
              <Label htmlFor="bulk-price">מחיר אחיד (₪)</Label>
              <Input id="bulk-price" type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
          )}

          {kind === "category" && (
            <div className="space-y-2">
              <select
                value={categoryMode}
                onChange={(e) => setCategoryMode(e.target.value as any)}
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="add">הוסף לקטגוריה</option>
                <option value="remove">הסר מקטגוריה</option>
              </select>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
              >
                <option value="">— בחרו קטגוריה —</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}

          {isPriceAction && (
            <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              שימו לב: פעולה זו משנה את מחיר המדף של {count} מוצרים ואינה הפיכה בלחיצה אחת.
              ודאו שהבחירה נכונה לפני האישור.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={apply} disabled={busy}>{busy ? "מעדכן..." : `החל על ${count} מוצרים`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProductDialog({ product, onSave }: { product: Product | null; onSave: (f: Partial<Product>) => void }) {
  const [form, setForm] = useState<Partial<Product>>(
    product ?? { name: "", slug: "", price: 0, stock_status: "instock", is_active: true, track_stock: false }
  );
  // An existing product keeps the slug the owner chose — never rewrite it. A new
  // product auto-derives its slug from the name until the owner edits slug itself.
  const [slugTouched, setSlugTouched] = useState(!!product);
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{product ? "עריכת מוצר" : "מוצר חדש"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>שם *</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({ ...prev, name, slug: slugTouched ? prev.slug : slugify(name) }));
              }}
            />
          </div>
          <div>
            <Label>Slug *</Label>
            <Input
              dir="ltr"
              value={form.slug ?? ""}
              onChange={(e) => { setSlugTouched(true); setForm((prev) => ({ ...prev, slug: e.target.value })); }}
            />
          </div>
          <div><Label>מחיר</Label><Input type="number" step="0.01" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></div>
          <div><Label>מחיר מבצע</Label><Input type="number" step="0.01" value={form.sale_price ?? ""} onChange={(e) => setForm({ ...form, sale_price: e.target.value ? Number(e.target.value) : null })} /></div>
          <div><Label>מק״ט</Label><Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
          <div><Label>סטטוס מלאי</Label>
            <select value={form.stock_status ?? "instock"} onChange={(e) => setForm({ ...form, stock_status: e.target.value })} className="flex h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="instock">במלאי</option>
              <option value="outofstock">אזל</option>
            </select>
          </div>
          <div className="md:col-span-2"><Label>תמונה (URL)</Label><Input value={form.thumbnail_url ?? ""} onChange={(e) => setForm({ ...form, thumbnail_url: e.target.value })} /></div>
        </div>
        <div><Label>תיאור קצר</Label><Textarea rows={3} value={form.short_description ?? ""} onChange={(e) => setForm({ ...form, short_description: e.target.value })} /></div>
        <div><Label>תיאור מלא</Label><Textarea rows={6} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex items-center gap-2"><Switch checked={form.is_active ?? true} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>פעיל</Label></div>

        {/* Inventory. Off by default: with tracking on, a paid order decrements
            stock_qty and flips the product to "אזל" at zero. Leave it off for
            supplier items that are ordered on demand. */}
        <div className="rounded-md border p-3 space-y-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={form.track_stock ?? false}
              onCheckedChange={(v) => setForm({ ...form, track_stock: v })}
            />
            <Label>מעקב מלאי</Label>
          </div>
          {form.track_stock && (
            <div>
              <Label>כמות במלאי</Label>
              <Input
                type="number"
                min={0}
                value={form.stock_qty ?? 0}
                onChange={(e) => setForm({ ...form, stock_qty: Number(e.target.value) })}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                הכמות תרד אוטומטית עם כל הזמנה ששולמה. באפס המוצר יסומן כאזל.
              </p>
            </div>
          )}
        </div>

        {/* Sizes. Only for an existing product — variant rows hang off a
            product id, so there is nothing to show before the first save. */}
        {product && <VariantsPanel productId={product.id} parentPrice={Number(form.price ?? 0)} />}
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(form)}>שמור</Button>
      </DialogFooter>
    </DialogContent>
  );
}

/**
 * The size rows for one product — the prices checkout actually charges.
 *
 * A row whose `price` is set overrides `products.price` at checkout, and a row
 * explicitly marked out of stock is refused there. Both facts were invisible
 * from the admin until now, which is the whole reason this panel exists. Saving
 * here writes product_variants only; the parent product still saves separately
 * with the dialog's own שמור button.
 */
function VariantsPanel({ productId, parentPrice }: { productId: string; parentPrice: number }) {
  const qc = useQueryClient();
  const load = useServerFn(listProductVariants);
  const save = useServerFn(saveProductVariants);
  const [rows, setRows] = useState<AdminVariantRow[] | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin-variants", productId],
    queryFn: () => load({ data: { productId } }),
  });

  // Seed the editable copy once the server rows land (and again after a save
  // refetch), rather than deriving it during render.
  useEffect(() => { if (data) setRows(data); }, [data]);

  const update = (id: string, patch: Partial<AdminVariantRow>) =>
    setRows((cur) => (cur ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // "Different from the product price" is judged against the price currently in
  // the form above, so the warning tracks what a save would leave behind.
  const differs = (r: AdminVariantRow) => r.price !== null && Number(r.price) !== parentPrice;
  const differingCount = (rows ?? []).filter(differs).length;

  const onSaveRows = async () => {
    if (!rows || rows.length === 0) return;
    if (rows.some((r) => !r.label.trim())) {
      toast.error("לכל גודל חייב להיות שם");
      return;
    }
    setBusy(true);
    try {
      const res: any = await save({
        data: {
          productId,
          rows: rows.map((r) => ({
            id: r.id,
            label: r.label.trim(),
            price: r.price,
            in_stock: r.in_stock,
            sort_order: r.sort_order,
          })),
        },
      });
      toast.success(`נשמרו ${res.updated} גדלים`);
      qc.invalidateQueries({ queryKey: ["admin-variants", productId] });
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בשמירת הגדלים");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label className="text-sm font-semibold">גדלים ומחיריהם</Label>
        {rows && rows.length > 0 && (
          <Button size="sm" onClick={onSaveRows} disabled={busy}>
            {busy ? "שומר..." : "שמור גדלים"}
          </Button>
        )}
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">טוען גדלים…</p>}
      {isError && <p className="text-xs text-destructive">שגיאה בטעינת הגדלים.</p>}
      {rows && rows.length === 0 && (
        <p className="text-xs text-muted-foreground">למוצר זה לא מוגדרים גדלים.</p>
      )}

      {differingCount > 0 && (
        <div className="rounded-md border border-amber-400/70 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          ל־{differingCount} גדלים יש מחיר משלהם, שונה ממחיר המוצר. שינוי מחיר המוצר למעלה לא ישנה אותם.
        </div>
      )}

      {(rows ?? []).map((r) => {
        const mismatch = differs(r);
        return (
          <div
            key={r.id}
            className={`rounded-md border p-2 ${
              mismatch ? "border-amber-400/70 bg-amber-50/70 dark:bg-amber-950/10" : ""
            }`}
          >
            <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_90px_auto]">
              <div>
                <Label htmlFor={`v-label-${r.id}`} className="text-[11px] text-muted-foreground">שם הגודל</Label>
                <Input
                  id={`v-label-${r.id}`}
                  value={r.label}
                  onChange={(e) => update(r.id, { label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`v-price-${r.id}`} className="text-[11px] text-muted-foreground">מחיר הגודל (₪)</Label>
                <Input
                  id={`v-price-${r.id}`}
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="לפי מחיר המוצר"
                  value={r.price ?? ""}
                  onChange={(e) =>
                    update(r.id, { price: e.target.value === "" ? null : Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <Label htmlFor={`v-sort-${r.id}`} className="text-[11px] text-muted-foreground">סדר</Label>
                <Input
                  id={`v-sort-${r.id}`}
                  type="number"
                  min={0}
                  value={r.sort_order}
                  onChange={(e) => update(r.id, { sort_order: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex items-center gap-2 md:pb-1 md:self-end">
                <Switch
                  id={`v-stock-${r.id}`}
                  checked={r.in_stock}
                  onCheckedChange={(v) => update(r.id, { in_stock: v })}
                />
                <Label htmlFor={`v-stock-${r.id}`} className="text-xs whitespace-nowrap">
                  {r.in_stock ? "במלאי" : "אזל"}
                </Label>
              </div>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>מק״ט: {r.sku || "—"}</span>
              {r.price_delta !== 0 && <span>תוספת שמורה בשדה price_delta: {r.price_delta}</span>}
            </div>

            {mismatch && (
              <p className="mt-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
                מחיר הגודל שונה ממחיר המוצר — הלקוח מחויב לפי מחיר הגודל
              </p>
            )}
          </div>
        );
      })}

      {rows && rows.length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          שדה מחיר ריק פירושו שהגודל מחויב לפי מחיר המוצר. גודל שמסומן "אזל" לא ניתן להזמנה בקופה.
          הוספת גדלים חדשים או מחיקתם אינה זמינה כאן.
        </p>
      )}
    </div>
  );
}
