import { createFileRoute } from "@tanstack/react-router";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import {
  bulkUpdateProducts,
  listCategoriesForBulk,
  listProductVariants,
  saveProductVariants,
  getProductCategoryIds,
  setProductCategories,
  setProductPrice,
  undoPriceBatch,
  listPriceBatches,
  productPriceHistory,
  listProductImages,
  saveProductGallery,
  createProductsQuick,
  type AdminVariantRow,
} from "@/lib/admin-products.functions";
import { autoSlug, galleryFromProduct, slugSuffix, splitGallery } from "@/lib/admin-catalog";
import {
  categoryOptions,
  categoryWithDescendants,
  priceBreakdown,
  slugProblem,
  type CategoryNode,
} from "@/lib/admin-pricing";
import { SITE_DISCOUNT } from "@/lib/pricing";
import { PriceCell } from "@/components/admin/PriceCell";
import { PriceHistoryDialog } from "@/components/admin/PriceHistoryDialog";
import { CategoryPicker } from "@/components/admin/CategoryPicker";
import { GalleryEditor } from "@/components/admin/GalleryEditor";
import { QuickAddDialog } from "@/components/admin/QuickAddDialog";
import { usePhotoUpload } from "@/components/admin/usePhotoUpload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, Layers, History, Copy, ImagePlus } from "lucide-react";

/** Catalog-health filters — the same two predicates the dashboard tile counts. */
type HealthFilter = "no-image" | "out-of-stock" | "no-price" | "no-sku";
const HEALTH_FILTERS: HealthFilter[] = ["no-image", "out-of-stock", "no-price", "no-sku"];
type SortKey = "created_at" | "name" | "price";
type SortDir = "asc" | "desc";

const HEALTH_HE: Record<HealthFilter, string> = {
  "no-image": "מוצרים פעילים ללא תמונה",
  "out-of-stock": "מוצרים פעילים שאזלו מהמלאי",
  "no-price": "מוצרים פעילים ללא מחיר (לא ניתנים לקנייה)",
  "no-sku": "מוצרים פעילים ללא מק״ט",
};

export const Route = createFileRoute("/admin/products")({
  // Lets the dashboard's low-stock and catalog-health cards deep-link to a
  // pre-filtered list (e.g. /admin/products?q=<sku> or ?health=no-image), and
  // makes every filtered/sorted view a shareable URL.
  validateSearch: (
    s: Record<string, unknown>,
  ): { q?: string; health?: HealthFilter; sort?: SortKey; dir?: SortDir; cat?: string } => ({
    q: typeof s.q === "string" && s.q ? s.q : undefined,
    // Category slug. Filtering by a category includes its sub-categories.
    cat: typeof s.cat === "string" && s.cat && s.cat.length <= 120 ? s.cat : undefined,
    health: HEALTH_FILTERS.includes(s.health as HealthFilter)
      ? (s.health as HealthFilter)
      : undefined,
    sort: s.sort === "created_at" || s.sort === "name" || s.sort === "price" ? s.sort : undefined,
    dir: s.dir === "asc" || s.dir === "desc" ? s.dir : undefined,
  }),
  component: AdminProducts,
});

type Product = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  short_description: string | null;
  price: number;
  sale_price: number | null;
  sku: string | null;
  stock_status: string;
  stock_qty: number | null;
  thumbnail_url: string | null;
  is_active: boolean;
  track_stock: boolean;
};

const PAGE_SIZE = 25;

type BulkKind = "price_pct" | "price_set" | "category" | "active" | "stock_status" | "restock";

function AdminProducts() {
  const qc = useQueryClient();
  const { q: qFromUrl, health, sort, dir, cat } = Route.useSearch();
  const navigate = Route.useNavigate();
  const sortKey: SortKey = sort ?? "created_at";
  // Newest-first stays the default; the other keys read naturally ascending.
  const sortDir: SortDir = dir ?? (sortKey === "created_at" ? "desc" : "asc");
  const [search, setSearch] = useState(qFromUrl ?? "");
  const [debounced, setDebounced] = useState(qFromUrl ?? "");
  const [page, setPage] = useState(0);
  const [editing, setEditing] = useState<Product | null>(null);
  // "שכפל": the product a new one is copied from.
  const [duplicateFrom, setDuplicateFrom] = useState<Product | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [open, setOpen] = useState(false);
  // Set by ProductDialog whenever the form differs from what it opened with, so
  // a stray Escape / backdrop click can't discard a half-written product.
  const productDirtyRef = useRef(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // "Every product in the filtered category", not just the rows on screen.
  const [scopeAll, setScopeAll] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [busyBatch, setBusyBatch] = useState<string | null>(null);

  const runBulk = useServerFn(bulkUpdateProducts);
  const loadCategories = useServerFn(listCategoriesForBulk);
  const saveCategories = useServerFn(setProductCategories);
  const savePrice = useServerFn(setProductPrice);
  const runUndo = useServerFn(undoPriceBatch);
  const loadBatches = useServerFn(listPriceBatches);
  const saveGalleryFn = useServerFn(saveProductGallery);
  const createQuick = useServerFn(createProductsQuick);
  const uploadPhoto = usePhotoUpload();

  useEffect(() => {
    setSearch(qFromUrl ?? "");
  }, [qFromUrl]);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => setPage(0), [debounced, health, sortKey, sortDir, cat]);
  // A selection only makes sense for rows the admin can currently see — the
  // action applies to ids, not to "the filter", so carrying it across a search
  // or page change would act on rows that scrolled out of view.
  useEffect(() => {
    setSelected(new Set());
    setScopeAll(false);
  }, [debounced, page, health, sortKey, sortDir, cat]);

  /** Patch the URL so any filtered/sorted view can be bookmarked or shared. */
  const patchSearch = (patch: {
    health?: HealthFilter;
    sort?: SortKey;
    dir?: SortDir;
    cat?: string;
  }) => navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false });

  // The category list feeds the filter, the bulk dialog and the product dialog.
  const { data: categories = [] } = useQuery({
    queryKey: ["admin-all-categories"],
    queryFn: () => loadCategories(),
    staleTime: 5 * 60_000,
  });
  const catNodes = categories as CategoryNode[];
  const catOptions = categoryOptions(catNodes);
  const catNode = cat ? catNodes.find((c) => c.slug === cat) : undefined;
  const catIds = cat ? categoryWithDescendants(catNodes, cat).map((c) => c.id) : [];

  const { data, isFetching } = useQuery({
    queryKey: ["admin-products", debounced, page, health ?? "", sortKey, sortDir, cat ?? ""],
    placeholderData: keepPreviousData,
    // A category filter waits for the category list, which it needs to include
    // the sub-categories.
    enabled: !cat || catIds.length > 0,
    queryFn: async () => {
      // With a category, an inner join keeps only products linked to it or to
      // one of its sub-categories; the joined rows are dropped again below.
      let query = cat
        ? supabase
            .from("products")
            .select("*, product_categories!inner(category_id)", { count: "exact" })
            .in("product_categories.category_id", catIds)
        : supabase.from("products").select("*", { count: "exact" });
      const term = debounced
        .replace(/[,()%\\]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
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
      } else if (health === "no-price") {
        query = query.eq("is_active", true).or("price.is.null,price.lte.0");
      } else if (health === "no-sku") {
        query = query.eq("is_active", true).or("sku.is.null,sku.eq.");
      }
      const from = page * PAGE_SIZE;
      const { data, error, count } = await query
        .order(sortKey, { ascending: sortDir === "asc" })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      // Keep only product columns: the edit dialog saves the row it was opened
      // with, and a stray joined field would make that update fail.
      const rows = (data ?? []).map((r) => {
        const { product_categories: _joined, ...product } = r as Product & {
          product_categories?: unknown;
        };
        return product as Product;
      });
      return { rows, total: count ?? 0 };
    },
  });
  const filtered = data?.rows ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const { data: batches = [], isFetching: batchesLoading } = useQuery({
    queryKey: ["admin-price-batches"],
    enabled: historyOpen,
    queryFn: () => loadBatches(),
  });

  const undo = async (batchId: string) => {
    setBusyBatch(batchId);
    try {
      const r = await runUndo({ data: { batchId } });
      toast.success(
        r.skipped
          ? `הוחזר המחיר הקודם ל-${r.restored} מוצרים · ${r.skipped} דולגו כי מחירם שונה מאז`
          : `הוחזר המחיר הקודם (${r.restored} מוצרים)`,
      );
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-price-batches"] });
    } catch (e: any) {
      toast.error(e?.message ?? "הביטול נכשל");
    } finally {
      setBusyBatch(null);
    }
  };

  /** Inline price edit from the table. Throws so the cell keeps the typed value. */
  const saveInlinePrice = async (p: Product, next: number) => {
    try {
      const res = await savePrice({ data: { productId: p.id, price: next } });
      toast.success(`המחיר עודכן: ₪${Number(p.price)} ← ₪${next}`, {
        action: { label: "בטל", onClick: () => void undo(res.batchId) },
        duration: 10_000,
      });
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-price-batches"] });
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בעדכון המחיר");
      throw e;
    }
  };

  // Offer "all N in this category" once the whole page is ticked and the view
  // is exactly the category — no search or health filter narrowing it.
  const canScopeAll = !!catNode && !debounced.trim() && !health && total > filtered.length;
  const bulkCount = scopeAll ? total : selected.size;

  const allOnPageSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setScopeAll(false);
    setSelected((cur) => {
      const next = new Set(cur);
      if (allOnPageSelected) filtered.forEach((p) => next.delete(p.id));
      else filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };
  const toggleOne = (id: string) => {
    setScopeAll(false);
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onSave = async (
    form: Partial<Product>,
    categoryIds: string[],
    gallery: string[] | null,
  ) => {
    // Required-field guard. products.slug is `text UNIQUE NOT NULL`, and the
    // empty string satisfies NOT NULL — so without this the first save of a
    // Hebrew-named product (slugify() returns "" for any name with no Latin
    // characters, by its own design) SUCCEEDED and created a live product whose
    // URL is /product/ — matching no route, invisible to every customer, while
    // the owner saw "נוסף". Covers the update branch too, which sends the whole
    // form and could blank an existing slug the same way.
    const name = (form.name ?? "").trim();
    const slug = (form.slug ?? "").trim();
    if (!name) return toast.error("יש להזין שם מוצר");
    // An existing product keeps whatever slug it has (216 live ones are
    // Hebrew); only a new or edited slug must be Latin. See slugProblem.
    const slugError = slugProblem(slug, editing?.slug ?? null);
    if (slugError) return toast.error(slugError);
    // The one DB error the owner is guaranteed to hit, in Hebrew: the raw
    // Postgres text ("duplicate key value violates unique constraint …") tells a
    // non-technical shop owner nothing about which field to change.
    const saveError = (error: { code?: string; message: string }) =>
      toast.error(
        error.code === "23505"
          ? `כתובת ה-Slug "${slug}" כבר תפוסה על ידי מוצר אחר — בחרו כתובת אחרת`
          : error.message,
      );

    // Product CRUD stays on the anon client (RLS admin-gated), exactly as before.
    let productId = editing?.id;
    if (editing) {
      const { error } = await supabase
        .from("products")
        .update({ ...form, name, slug })
        .eq("id", editing.id);
      if (error) return saveError(error);
    } else {
      const { data: inserted, error } = await supabase
        .from("products")
        .insert({
          slug,
          name,
          price: form.price ?? 0,
          sale_price: form.sale_price ?? null,
          sku: form.sku ?? null,
          description: form.description ?? null,
          short_description: form.short_description ?? null,
          thumbnail_url: form.thumbnail_url ?? null,
          stock_status: form.stock_status ?? "instock",
          is_active: form.is_active ?? true,
          track_stock: form.track_stock ?? false,
          stock_qty: form.stock_qty ?? null,
        })
        .select("id")
        .single();
      if (error) return saveError(error);
      productId = inserted?.id;
    }

    // Category assignment goes through the admin server fn (service role). The
    // product itself is already saved, so a category failure is a warning, not a
    // rollback — the owner can re-open and re-save the categories.
    let categoriesOk = true;
    if (productId) {
      try {
        await saveCategories({ data: { productId, categoryIds } });
      } catch (e: any) {
        categoriesOk = false;
        toast.error(e?.message ?? "המוצר נשמר אך שיוך הקטגוריות נכשל.");
      }
    }
    // Photos: the first is already in thumbnail_url (saved above); the rest go
    // to product_images. Like categories, a failure here is a warning.
    let photosOk = true;
    if (productId && gallery) {
      try {
        await saveGalleryFn({ data: { productId, ...splitGallery(gallery) } });
      } catch (e: any) {
        photosOk = false;
        toast.error(e?.message ?? "המוצר נשמר אך שמירת התמונות נכשלה.");
      }
    }
    if (categoriesOk && photosOk) toast.success(editing ? "עודכן" : "נוסף");

    // Reached only after a successful save — the work is persisted, so drop the
    // unsaved-changes flag before closing.
    productDirtyRef.current = false;
    setOpen(false);
    setEditing(null);
    setDuplicateFrom(null);
    qc.invalidateQueries({ queryKey: ["admin-products"] });
    if (productId) {
      qc.invalidateQueries({ queryKey: ["admin-product-cats", productId] });
      qc.invalidateQueries({ queryKey: ["admin-price-log", productId] });
      qc.invalidateQueries({ queryKey: ["admin-product-images", productId] });
    }
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold">מוצרים ({total})</h1>
        {/* Radix routes Escape, outside-pointer AND the X through onOpenChange,
            so this single guard covers all three ways the dialog could silently
            throw away a half-written product. Because the dialog is controlled,
            simply not calling setOpen keeps it open. */}
        <Dialog
          open={open}
          onOpenChange={(v) => {
            if (
              !v &&
              productDirtyRef.current &&
              !confirm("יש שינויים שלא נשמרו במוצר. לצאת בלי לשמור?")
            )
              return;
            setOpen(v);
            if (!v) {
              productDirtyRef.current = false;
              setEditing(null);
              setDuplicateFrom(null);
            }
          }}
        >
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="outline"
              className="gap-2 max-sm:w-11 max-sm:px-0"
              aria-label="היסטוריית מחירים"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-4 w-4" />
              <span className="max-sm:sr-only">היסטוריית מחירים</span>
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => setQuickOpen(true)}>
              <ImagePlus className="h-4 w-4" /> הוספה מהירה
              <span className="max-sm:hidden"> מתמונות</span>
            </Button>
            <DialogTrigger asChild>
              <Button
                onClick={() => {
                  setEditing(null);
                  setDuplicateFrom(null);
                  setOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="h-4 w-4" /> {catNode ? `חדש ב${catNode.name}` : "חדש"}
              </Button>
            </DialogTrigger>
          </div>
          <ProductDialog
            key={
              editing?.id ??
              (duplicateFrom ? `dup-${duplicateFrom.id}` : `new-${catNode?.id ?? ""}`)
            }
            product={editing}
            template={duplicateFrom}
            onSave={onSave}
            dirtyRef={productDirtyRef}
            defaultCategoryIds={catNode ? [catNode.id] : []}
          />
        </Dialog>
      </div>
      <div className="mb-4 grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap sm:gap-3">
        <div className="col-span-2 sm:min-w-[220px] sm:max-w-sm sm:flex-1">
          <Label htmlFor="prod-search" className="text-xs text-muted-foreground">
            חיפוש
          </Label>
          <Input
            id="prod-search"
            type="search"
            enterKeyHint="search"
            className="max-sm:min-h-11"
            placeholder="חיפוש: שם / מק״ט / slug..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="col-span-2 sm:w-64">
          <Label htmlFor="prod-cat" className="text-xs text-muted-foreground">
            קטגוריה
          </Label>
          <select
            id="prod-cat"
            value={cat ?? ""}
            onChange={(e) => patchSearch({ cat: e.target.value || undefined })}
            className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
          >
            <option value="">כל הקטגוריות</option>
            {catOptions.map((o) => (
              <option key={o.id} value={o.slug}>
                {`${"\u00a0\u00a0\u00a0".repeat(o.depth)}${o.depth ? "↳ " : ""}${o.name}`}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:w-56">
          <Label htmlFor="prod-health" className="text-xs text-muted-foreground">
            סינון תקינות
          </Label>
          <select
            id="prod-health"
            value={health ?? ""}
            onChange={(e) =>
              patchSearch({ health: (e.target.value || undefined) as HealthFilter | undefined })
            }
            className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
          >
            <option value="">כל המוצרים</option>
            {HEALTH_FILTERS.map((h) => (
              <option key={h} value={h}>
                {HEALTH_HE[h]}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0 sm:w-56">
          <Label htmlFor="prod-sort" className="text-xs text-muted-foreground">
            מיון
          </Label>
          <select
            id="prod-sort"
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => {
              const [k, d] = e.target.value.split(":") as [SortKey, SortDir];
              const isDefault = k === "created_at" && d === "desc";
              patchSearch({ sort: isDefault ? undefined : k, dir: isDefault ? undefined : d });
            }}
            className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
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
          <span>
            מוצגים רק: {HEALTH_HE[health]} · {total} מוצרים
          </span>
          <Button size="sm" variant="outline" onClick={() => patchSearch({ health: undefined })}>
            הצג את כל המוצרים
          </Button>
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3 backdrop-blur">
          <span className="text-sm font-medium">
            {scopeAll && catNode
              ? `נבחרו כל ${total} המוצרים ב${catNode.name} (כולל תתי-קטגוריות)`
              : `נבחרו ${selected.size} מוצרים`}
          </span>
          {!scopeAll && canScopeAll && allOnPageSelected && catNode && (
            <Button size="sm" variant="link" className="px-0" onClick={() => setScopeAll(true)}>
              לבחור את כל {total} המוצרים ב{catNode.name}
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={() => setBulkOpen(true)}>
            <Layers className="h-4 w-4" /> פעולות מרובות
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelected(new Set());
              setScopeAll(false);
            }}
          >
            נקה בחירה
          </Button>
        </div>
      )}

      {/* Phone: a card per product — photo, name, stock, the inline price and
          the three row actions as 44px buttons. Same handlers as the table. */}
      <ul
        className={`space-y-2 sm:hidden transition-opacity duration-200 ease-out ${isFetching ? "opacity-60" : ""}`}
      >
        {!isFetching && filtered.length === 0 && (
          <li className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            לא נמצאו מוצרים התואמים לסינון הנוכחי.
          </li>
        )}
        {filtered.length > 0 && (
          <li>
            <label className="flex min-h-11 items-center gap-3 px-1 text-sm text-muted-foreground">
              <Checkbox
                checked={allOnPageSelected}
                onCheckedChange={toggleAll}
                aria-label="בחר את כל המוצרים בעמוד"
              />
              בחירת כל המוצרים בעמוד
            </label>
          </li>
        )}
        {filtered.map((p) => (
          <li
            key={p.id}
            className={`rounded-xl border border-glass-line p-3 ${selected.has(p.id) ? "bg-primary/5" : "bg-card"}`}
          >
            <div className="flex items-start gap-3">
              <label className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center">
                <Checkbox
                  checked={selected.has(p.id)}
                  onCheckedChange={() => toggleOne(p.id)}
                  aria-label={`בחר ${p.name}`}
                />
              </label>
              {p.thumbnail_url ? (
                <img
                  src={p.thumbnail_url}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-14 w-14 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-14 w-14 shrink-0 rounded-md border border-dashed bg-muted"
                />
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-sm font-medium">{p.name}</div>
                <div className="mt-0.5 text-xs">
                  <span
                    className={p.stock_status === "instock" ? "text-green-700" : "text-destructive"}
                  >
                    {p.stock_status === "instock" ? "במלאי" : "אזל"}
                  </span>
                  {p.track_stock && (
                    <span className="text-muted-foreground"> · במעקב {p.stock_qty ?? 0}</span>
                  )}
                  {!p.is_active && <span className="text-muted-foreground"> · לא פעיל</span>}
                </div>
              </div>
            </div>
            <div className="mt-2 flex items-start justify-between gap-2">
              <PriceCell
                price={Number(p.price)}
                salePrice={p.sale_price === null ? null : Number(p.sale_price)}
                label={p.name}
                onSave={(next) => saveInlinePrice(p, next)}
              />
              <div className="flex gap-1.5">
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`עריכת ${p.name}`}
                  onClick={() => {
                    setDuplicateFrom(null);
                    setEditing(p);
                    setOpen(true);
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`שכפול ${p.name}`}
                  onClick={() => {
                    setEditing(null);
                    setDuplicateFrom(p);
                    setOpen(true);
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="outline"
                  aria-label={`מחיקת ${p.name}`}
                  onClick={() => onDelete(p.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <div
        className={`rounded-lg border bg-card overflow-x-auto transition-opacity duration-200 ease-out max-sm:hidden ${isFetching ? "opacity-60" : ""}`}
      >
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
              <th className="p-3 font-medium">מחיר קטלוג</th>
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
                  {p.thumbnail_url && (
                    <img
                      src={p.thumbnail_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                </td>
                <td className="p-3 max-w-xs">
                  <div className="line-clamp-2">{p.name}</div>
                </td>
                <td className="p-2 align-top">
                  <PriceCell
                    price={Number(p.price)}
                    salePrice={p.sale_price === null ? null : Number(p.sale_price)}
                    label={p.name}
                    onSave={(next) => saveInlinePrice(p, next)}
                  />
                </td>
                <td className="p-3">
                  <span
                    className={p.stock_status === "instock" ? "text-green-600" : "text-destructive"}
                  >
                    {p.stock_status === "instock" ? "במלאי" : "אזל"}
                  </span>
                  {p.track_stock && (
                    <span className="block text-[11px] text-muted-foreground">
                      במעקב · {p.stock_qty ?? 0}
                    </span>
                  )}
                </td>
                <td className="p-3">{p.is_active ? "✓" : "✗"}</td>
                <td className="p-3 flex gap-2 justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    aria-label={`עריכת ${p.name}`}
                    onClick={() => {
                      setDuplicateFrom(null);
                      setEditing(p);
                      setOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    title="שכפל — מוצר חדש על בסיס זה (למשל צבע או גודל אחר)"
                    aria-label={`שכפול ${p.name}`}
                    onClick={() => {
                      setEditing(null);
                      setDuplicateFrom(p);
                      setOpen(true);
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
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
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            הקודם
          </Button>
          <span>
            עמוד {page + 1} מתוך {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            הבא
          </Button>
        </div>
      )}

      <BulkDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        count={bulkCount}
        categories={catNodes}
        onApply={async (action) => {
          try {
            const res: any = await runBulk({
              data:
                scopeAll && catNode
                  ? { categoryId: catNode.id, action }
                  : { ids: [...selected], action },
            });
            // Price actions come back as one logged batch — offer to undo it.
            toast.success(
              `עודכנו ${res.updated} מוצרים${res.skipped ? ` (${res.skipped} ללא שינוי)` : ""}`,
              res.batchId
                ? {
                    action: { label: "בטל", onClick: () => void undo(res.batchId) },
                    duration: 15_000,
                  }
                : undefined,
            );
            qc.invalidateQueries({ queryKey: ["admin-price-batches"] });
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
            setScopeAll(false);
            qc.invalidateQueries({ queryKey: ["admin-products"] });
          } catch (e: any) {
            toast.error(e?.message ?? "שגיאה בעדכון המוצרים");
          }
        }}
      />

      <PriceHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        batches={batches}
        loading={batchesLoading && batches.length === 0}
        busyBatch={busyBatch}
        onUndo={(id) => void undo(id)}
      />

      <QuickAddDialog
        key={`quick-${catNode?.id ?? ""}`}
        open={quickOpen}
        onOpenChange={setQuickOpen}
        categories={catNodes}
        defaultCategoryId={catNode?.id}
        uploadPhoto={uploadPhoto}
        create={(input) => createQuick({ data: input })}
        onCreated={(category, result) => {
          if (result.created.length > 0) {
            toast.success(`נוספו ${result.created.length} מוצרים ל${category.name}`);
          }
          if (result.failed.length > 0) {
            toast.error(
              `${result.failed.length} מוצרים לא נוצרו: ${result.failed.map((f) => f.name).join(", ")}`,
            );
          }
          qc.invalidateQueries({ queryKey: ["admin-products"] });
          // Show the shelf the new products went to, newest first.
          patchSearch({ cat: category.slug, sort: undefined, dir: undefined });
          setSearch("");
        }}
      />
    </div>
  );
}

function BulkDialog({
  open,
  onOpenChange,
  count,
  categories,
  onApply,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  count: number;
  categories: CategoryNode[];
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
      case "price_pct":
        return { kind, pct };
      case "price_set":
        return { kind, price };
      case "restock":
        return { kind, qty };
      case "active":
        return { kind, value: activeValue };
      case "stock_status":
        return { kind, value: stockValue };
      case "category":
        return { kind, category_id: categoryId, mode: categoryMode };
    }
  };

  const apply = async () => {
    if (kind === "category" && !categoryId) {
      toast.error("יש לבחור קטגוריה");
      return;
    }
    if (kind === "price_set" && !(price > 0)) {
      toast.error("המחיר חייב להיות גדול מ-0");
      return;
    }
    if (kind === "price_pct" && (!pct || pct < -90 || pct > 300)) {
      toast.error("יש להזין אחוז שינוי בין 90- ל-300 (לא 0)");
      return;
    }
    setBusy(true);
    try {
      await onApply(build());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>פעולות מרובות · {count} מוצרים</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bulk-kind">פעולה</Label>
            <select
              id="bulk-kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as BulkKind)}
              className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
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
              className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
            >
              <option value="instock">במלאי</option>
              <option value="outofstock">אזל</option>
            </select>
          )}

          {kind === "restock" && (
            <div>
              <Label htmlFor="bulk-qty">כמות במלאי</Label>
              <Input
                id="bulk-qty"
                type="number"
                min={0}
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
              />
            </div>
          )}

          {kind === "price_pct" && (
            <div>
              <Label htmlFor="bulk-pct">שינוי באחוזים (למשל 10 או 15-)</Label>
              <Input
                id="bulk-pct"
                type="number"
                value={pct}
                onChange={(e) => setPct(Number(e.target.value))}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                מוצרים במחיר 0 ("לפי שער הזהב") לא ישונו. המחירים מעוגלים לשקל שלם.
              </p>
              {pct !== 0 && (
                <p className="mt-1 text-[11px] font-medium">
                  לדוגמה: ₪100 ← ₪{Math.max(1, Math.round(100 * (1 + pct / 100)))} (הלקוח ישלם ₪
                  {priceBreakdown(Math.max(1, Math.round(100 * (1 + pct / 100))), null).customer})
                </p>
              )}
            </div>
          )}

          {kind === "price_set" && (
            <div>
              <Label htmlFor="bulk-price">מחיר קטלוג אחיד (₪)</Label>
              <Input
                id="bulk-price"
                type="number"
                min={1}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
              />
              {price > 0 && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  הלקוח ישלם ₪{priceBreakdown(price, null).customer}
                </p>
              )}
            </div>
          )}

          {kind === "category" && (
            <div className="space-y-2">
              <select
                value={categoryMode}
                onChange={(e) => setCategoryMode(e.target.value as any)}
                className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
              >
                <option value="add">הוסף לקטגוריה</option>
                <option value="remove">הסר מקטגוריה</option>
              </select>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
              >
                <option value="">— בחרו קטגוריה —</option>
                {categoryOptions(categories).map((o) => (
                  <option key={o.id} value={o.id}>
                    {`${"\u00a0\u00a0\u00a0".repeat(o.depth)}${o.depth ? "↳ " : ""}${o.name}`}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isPriceAction && (
            <div className="rounded-md border border-amber-400/70 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
              פעולה זו משנה את מחיר הקטלוג של {count} מוצרים. השינוי נשמר ב"היסטוריית מחירים" ואפשר
              לבטל אותו בלחיצה.
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={apply} disabled={busy}>
            {busy ? "מעדכן..." : `החל על ${count} מוצרים`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** A new product starts from these. */
const NEW_PRODUCT: Partial<Product> = {
  name: "",
  slug: "",
  price: 0,
  stock_status: "instock",
  is_active: true,
  track_stock: false,
};

/**
 * "שכפל": a new product pre-filled from an existing one, minus its identity.
 * The name is kept as is on purpose: products with the same name are grouped
 * as models of one product (name_norm → list_products_collapsed and
 * list_product_models), which is what a copy in another colour should be.
 */
function duplicateSeed(t: Product): Partial<Product> {
  return {
    name: t.name,
    slug: "",
    price: t.price,
    sale_price: t.sale_price,
    sku: null,
    description: t.description,
    short_description: t.short_description,
    thumbnail_url: t.thumbnail_url,
    stock_status: t.stock_status,
    is_active: t.is_active,
    track_stock: t.track_stock,
    stock_qty: t.stock_qty,
  };
}

function ProductDialog({
  product,
  template = null,
  onSave,
  dirtyRef,
  defaultCategoryIds = [],
}: {
  product: Product | null;
  /** New product only: copy fields, categories and photos from this one. */
  template?: Product | null;
  /** `gallery` is null when the photos were not changed. */
  onSave: (f: Partial<Product>, categoryIds: string[], gallery: string[] | null) => void;
  /** Parent-owned flag driving the unsaved-changes confirm on dismissal. */
  dirtyRef?: { current: boolean };
  /** For a new product: the category the list is filtered to, pre-ticked. */
  defaultCategoryIds?: string[];
}) {
  // Set by VariantsPanel while it has unsaved size rows; the footer שמור flushes
  // them before saving the product, so edited size prices are never dropped.
  const variantsSaveRef = useRef<null | (() => Promise<boolean>)>(null);
  const seed: Partial<Product> = product ?? (template ? duplicateSeed(template) : NEW_PRODUCT);
  const [form, setForm] = useState<Partial<Product>>(seed);
  // Dirty = the form differs from what the dialog opened with. Derived by
  // comparison rather than by flagging each of the ~12 setForm call sites, so a
  // newly-added field can't quietly escape the guard. The component is remounted
  // per product (key=id), so this seed is always the right baseline.
  const initialFormRef = useRef(JSON.stringify(seed));
  // An existing product keeps the slug the owner chose — never rewrite it. A new
  // product gets one generated (autoSlug) until the owner edits the slug itself.
  const [slugTouched, setSlugTouched] = useState(!!product);
  const suffixRef = useRef(slugSuffix());
  const prices = priceBreakdown(Number(form.price ?? 0), form.sale_price ?? null);

  // Categories and photos come from the product being edited, or, for a
  // duplicate, from the product being copied.
  const sourceId = product?.id ?? template?.id;

  // --- Categories ---------------------------------------------------------
  const loadAllCats = useServerFn(listCategoriesForBulk);
  const loadProductCats = useServerFn(getProductCategoryIds);
  const [categoryIds, setCategoryIds] = useState<Set<string>>(
    () => new Set(product || template ? [] : defaultCategoryIds),
  );

  const { data: allCategories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin-all-categories"],
    queryFn: () => loadAllCats(),
  });
  // Seed the picker with the product's current categories when editing. The
  // dialog is remounted per product (key=…), so this runs fresh each open.
  const { data: currentCatIds } = useQuery({
    queryKey: ["admin-product-cats", sourceId],
    enabled: !!sourceId,
    queryFn: () => loadProductCats({ data: { productId: sourceId! } }),
  });
  useEffect(() => {
    if (currentCatIds) setCategoryIds(new Set(currentCatIds));
  }, [currentCatIds]);

  // --- Photos -------------------------------------------------------------
  const loadImages = useServerFn(listProductImages);
  const uploadPhoto = usePhotoUpload();
  const [gallery, setGallery] = useState<string[]>(seed.thumbnail_url ? [seed.thumbnail_url] : []);
  const initialGalleryRef = useRef(JSON.stringify(gallery));
  const [photosBusy, setPhotosBusy] = useState(false);
  const { data: images, isError: imagesError } = useQuery({
    queryKey: ["admin-product-images", sourceId],
    enabled: !!sourceId,
    queryFn: () => loadImages({ data: { productId: sourceId! } }),
  });
  useEffect(() => {
    if (!images) return;
    const g = galleryFromProduct(seed.thumbnail_url, images);
    setGallery(g);
    initialGalleryRef.current = JSON.stringify(g);
    // seed is fixed for this mount (key=…); only the query result drives this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images]);
  const galleryDirty = JSON.stringify(gallery) !== initialGalleryRef.current;

  useEffect(() => {
    if (dirtyRef) {
      dirtyRef.current = JSON.stringify(form) !== initialFormRef.current || galleryDirty;
    }
  }, [form, galleryDirty, dirtyRef]);

  // New product: the slug follows the name and the first chosen category —
  // `<category>-<5 digits>` for a Hebrew name — until the owner types one.
  const primaryCategorySlug = allCategories.find((c) => c.id === [...categoryIds][0])?.slug ?? null;
  useEffect(() => {
    if (product || slugTouched) return;
    const name = (form.name ?? "").trim();
    const next = name ? autoSlug(name, primaryCategorySlug, suffixRef.current) : "";
    setForm((prev) => (prev.slug === next ? prev : { ...prev, slug: next }));
  }, [form.name, primaryCategorySlug, product, slugTouched]);

  const toggleCategory = (id: string) =>
    setCategoryIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {product ? "עריכת מוצר" : template ? "מוצר חדש — שכפול" : "מוצר חדש"}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div>
            <Label>שם *</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => {
                const name = e.target.value;
                setForm((prev) => ({ ...prev, name }));
              }}
            />
            {template && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {(form.name ?? "").trim() === template.name.trim()
                  ? "שם זהה למוצר המקורי — באתר יוצג כדגם נוסף שלו (למשל צבע אחר)."
                  : "שם שונה — באתר יוצג ככרטיס מוצר נפרד."}
              </p>
            )}
          </div>
          <div>
            <Label>Slug *</Label>
            <Input
              dir="ltr"
              value={form.slug ?? ""}
              onChange={(e) => {
                setSlugTouched(true);
                setForm((prev) => ({ ...prev, slug: e.target.value }));
              }}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {!product && !slugTouched
                ? "נוצרת אוטומטית מהשם ומהקטגוריה — אין צורך לשנות."
                : "כתובת הדף באתר: orzadik.com/product/slug — אותיות אנגליות קטנות, ספרות ומקפים."}
            </p>
          </div>
          <div>
            <Label>מחיר קטלוג (₪)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.price ?? 0}
              onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
            />
            {Number(form.price ?? 0) > 0 ? (
              <p className="mt-1 text-[11px] text-muted-foreground">
                הלקוח משלם ₪{prices.customer} (אחרי {Math.round(SITE_DISCOUNT * 100)}% הנחת אתר) ·
                חבר מועדון ₪{prices.member}
              </p>
            ) : (
              <p className="mt-1 text-[11px] font-medium text-destructive">
                מחיר 0 — המוצר לא יימכר באתר.
              </p>
            )}
          </div>
          <div>
            {/* This column is the genuine FORMER price, shown struck through
                next to what the customer pays (getDisplayOriginal). It was
                labelled "מחיר מבצע", which reads as the opposite. */}
            <Label>מחיר קודם — מוצג מחוק (לא חובה)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={form.sale_price ?? ""}
              onChange={(e) =>
                setForm({ ...form, sale_price: e.target.value ? Number(e.target.value) : null })
              }
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              {prices.struck !== null
                ? `באתר יוצג: ₪${prices.struck} מחוק ליד ₪${prices.customer}`
                : "יוצג מחוק רק אם הוא גבוה מהמחיר שהלקוח משלם. מלאו רק מחיר קודם אמיתי."}
            </p>
          </div>
          <div>
            <Label>מק״ט</Label>
            <Input
              value={form.sku ?? ""}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
            />
          </div>
          <div>
            <Label>סטטוס מלאי</Label>
            <select
              value={form.stock_status ?? "instock"}
              onChange={(e) => setForm({ ...form, stock_status: e.target.value })}
              className="flex h-11 w-full rounded-md border bg-background px-3 text-sm sm:h-10"
            >
              <option value="instock">במלאי</option>
              <option value="outofstock">אזל</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <GalleryEditor
              urls={gallery}
              onChange={setGallery}
              uploadPhoto={uploadPhoto}
              onBusyChange={setPhotosBusy}
            />
          </div>
        </div>
        <div>
          <Label>תיאור קצר</Label>
          <Textarea
            rows={3}
            value={form.short_description ?? ""}
            onChange={(e) => setForm({ ...form, short_description: e.target.value })}
          />
        </div>
        <div>
          <Label>תיאור מלא</Label>
          <Textarea
            rows={6}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        {/* Categories. Assigning here writes product_categories on save, so a new
            product no longer starts orphaned. Replace-set: the saved list is
            exactly what is ticked below. */}
        <CategoryPicker
          categories={allCategories as CategoryNode[]}
          selected={categoryIds}
          onToggle={toggleCategory}
          loading={catsLoading}
        />

        <div className="flex items-center gap-2">
          <Switch
            checked={form.is_active ?? true}
            onCheckedChange={(v) => setForm({ ...form, is_active: v })}
          />
          <Label>פעיל</Label>
        </div>

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

        {product && <PriceLog productId={product.id} />}

        {/* Sizes. Only for an existing product — variant rows hang off a
            product id, so there is nothing to show before the first save. */}
        {product && (
          <VariantsPanel
            productId={product.id}
            parentPrice={Number(form.price ?? 0)}
            saveRef={variantsSaveRef}
          />
        )}
      </div>
      <DialogFooter>
        {(() => {
          // When editing, the category picker is seeded asynchronously from
          // currentCatIds (see the useEffect above). Saving before that query
          // resolves would pass an empty categoryIds to the replace-set server
          // fn, silently wiping the product's existing category memberships.
          // Gate the save on the load having completed. For a NEW product the
          // query is disabled (currentCatIds stays undefined), so the !!product
          // guard keeps save enabled there.
          const categoriesLoading = !!sourceId && currentCatIds === undefined;
          // Same for the photos: saving before they load would replace the
          // gallery with just the main image.
          // A failed load keeps the main image only and does not block saving;
          // the gallery is written only if the owner then changes it.
          const photosLoading = !!sourceId && images === undefined && !imagesError;
          return (
            <Button
              onClick={async () => {
                // Validate BEFORE flushing the size rows: otherwise a bad slug
                // would still commit product_variants (with a "נשמרו N גדלים"
                // success toast) and only then reject the product save, leaving
                // a success toast on top of a half-applied save.
                const nameOk = (form.name ?? "").trim();
                if (!nameOk) return toast.error("יש להזין שם מוצר");
                const slugError = slugProblem(form.slug ?? "", product?.slug ?? null);
                if (slugError) return toast.error(slugError);
                // Commit pending size rows — they are the prices checkout
                // charges. A failed size write aborts, so the dialog stays open
                // with the edits intact instead of closing over a partial save.
                const ok = await (variantsSaveRef.current?.() ?? Promise.resolve(true));
                if (!ok) return;
                // NOTE: deliberately NOT clearing dirtyRef here. onSave can still
                // reject (duplicate slug, DB error) and leave the dialog open
                // holding the edits — clearing first would disarm the
                // unsaved-changes guard for exactly that case. The success path
                // closes via the parent's setOpen(false), and because the Radix
                // Root is controlled that never routes through onOpenChange, so
                // no confirm can fire on a successful save anyway.
                // The first photo is the main image. A new product always saves
                // its photos; an existing one only when they were changed.
                const saveGallery = !product || galleryDirty;
                onSave(
                  saveGallery ? { ...form, thumbnail_url: gallery[0] ?? null } : form,
                  [...categoryIds],
                  saveGallery ? gallery : null,
                );
              }}
              disabled={photosBusy || categoriesLoading || photosLoading}
            >
              {photosBusy
                ? "מעלה תמונות..."
                : categoriesLoading || photosLoading
                  ? "טוען..."
                  : "שמור"}
            </Button>
          );
        })()}
      </DialogFooter>
    </DialogContent>
  );
}

const SOURCE_HE: Record<string, string> = {
  edit: "עריכה",
  inline: "טבלה",
  bulk_set: "מחיר אחיד",
  bulk_pct: "שינוי באחוזים",
  undo: "ביטול",
};

/** The product's last few logged price changes (product_price_changes). */
function PriceLog({ productId }: { productId: string }) {
  const load = useServerFn(productPriceHistory);
  const { data: rows = [] } = useQuery({
    queryKey: ["admin-price-log", productId],
    queryFn: () => load({ data: { productId } }),
  });
  if (rows.length === 0) return null;
  const money = (v: number | null) => (v === null ? "—" : `₪${Math.round(v)}`);
  return (
    <div className="rounded-md border p-3">
      <p className="mb-2 text-sm font-semibold">שינויי מחיר אחרונים</p>
      <ul className="space-y-1 text-[12px] text-muted-foreground">
        {rows.map((r, i) => (
          <li key={i}>
            {new Date(r.changedAt).toLocaleString("he-IL", {
              timeZone: "Asia/Jerusalem",
              day: "numeric",
              month: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}{" "}
            · {SOURCE_HE[r.source] ?? r.source} · {money(r.oldPrice)} ← {money(r.newPrice)}
            {r.oldSalePrice !== r.newSalePrice &&
              ` · מחיר קודם ${money(r.oldSalePrice)} ← ${money(r.newSalePrice)}`}
          </li>
        ))}
      </ul>
    </div>
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
function VariantsPanel({
  productId,
  parentPrice,
  saveRef,
}: {
  productId: string;
  parentPrice: number;
  /** Lets the dialog's main שמור flush pending size edits before it closes. */
  saveRef?: { current: null | (() => Promise<boolean>) };
}) {
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
  useEffect(() => {
    if (data) setRows(data);
  }, [data]);

  const update = (id: string, patch: Partial<AdminVariantRow>) =>
    setRows((cur) => (cur ?? []).map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // "Different from the product price" is judged against the price currently in
  // the form above, so the warning tracks what a save would leave behind.
  const differs = (r: AdminVariantRow) => r.price !== null && Number(r.price) !== parentPrice;
  const differingCount = (rows ?? []).filter(differs).length;

  // Returns whether the rows are now persisted, so the dialog's main שמור can
  // abort its close when a size write fails instead of silently dropping it.
  const onSaveRows = async (): Promise<boolean> => {
    if (!rows || rows.length === 0) return true;
    if (rows.some((r) => !r.label.trim())) {
      toast.error("לכל גודל חייב להיות שם");
      return false;
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
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "שגיאה בשמירת הגדלים");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Are there edited size rows the owner hasn't pressed "שמור גדלים" for?
  const dirtyRows = !!rows && !!data && JSON.stringify(rows) !== JSON.stringify(data);

  // Expose a flush to the dialog footer. Pressing the big שמור at the bottom is
  // the natural thing to do after fixing a size price, but that button saved
  // only the product and closed — silently discarding the edited variant prices,
  // which are the ones checkout actually charges. Now it commits them first.
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = async () => {
      if (!dirtyRows) return true;
      return onSaveRows();
    };
    return () => {
      saveRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saveRef, dirtyRows, rows]);

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
          ל־{differingCount} גדלים יש מחיר משלהם, שונה ממחיר המוצר. שינוי מחיר המוצר למעלה לא ישנה
          אותם.
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
                <Label htmlFor={`v-label-${r.id}`} className="text-[11px] text-muted-foreground">
                  שם הגודל
                </Label>
                <Input
                  id={`v-label-${r.id}`}
                  value={r.label}
                  onChange={(e) => update(r.id, { label: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor={`v-price-${r.id}`} className="text-[11px] text-muted-foreground">
                  מחיר הגודל (₪)
                </Label>
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
                <Label htmlFor={`v-sort-${r.id}`} className="text-[11px] text-muted-foreground">
                  סדר
                </Label>
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
