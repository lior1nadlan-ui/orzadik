// "הוספה מהירה מתמונות" — add a shelf of new products in one go.
//
// Pick the category, drop the photos, and each photo becomes a row: a name
// (guessed from the file name when it is a real name) and a catalog price,
// with what the customer will pay shown underneath. One click creates them
// all in that category — no English URL to invent, no dialog per product.
// Descriptions and extra photos can be added later from the regular editor.

import { useMemo, useRef, useState, type DragEvent } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  categoryOptions,
  parsePriceInput,
  priceBreakdown,
  type CategoryNode,
} from "@/lib/admin-pricing";
import { nameFromFileName } from "@/lib/admin-catalog";

type Row = {
  key: string;
  fileName: string;
  preview: string;
  url: string | null;
  status: "uploading" | "ready" | "error";
  name: string;
  price: string;
};

export type QuickAddResult = {
  created: Array<{ id: string; slug: string; name: string }>;
  failed: Array<{ name: string; reason: string }>;
};

export function QuickAddDialog({
  open,
  onOpenChange,
  categories,
  defaultCategoryId,
  uploadPhoto,
  create,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categories: CategoryNode[];
  defaultCategoryId?: string;
  uploadPhoto: (file: File) => Promise<string>;
  create: (input: {
    categoryId: string;
    active: boolean;
    items: Array<{ name: string; price: number; imageUrl: string | null }>;
  }) => Promise<QuickAddResult>;
  onCreated: (category: CategoryNode, result: QuickAddResult) => void;
}) {
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? "");
  const [active, setActive] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => categoryOptions(categories), [categories]);

  const patch = (key: string, p: Partial<Row>) =>
    setRows((cur) => cur.map((r) => (r.key === key ? { ...r, ...p } : r)));

  const addFiles = (files: File[]) => {
    const images = files.filter((f) => f.type.startsWith("image/"));
    if (images.length === 0) return toast.error("יש לבחור קבצי תמונה.");
    const fresh: Row[] = images.map((f) => ({
      key: crypto.randomUUID(),
      fileName: f.name,
      preview: URL.createObjectURL(f),
      url: null,
      status: "uploading",
      name: nameFromFileName(f.name),
      price: "",
    }));
    setRows((cur) => [...cur, ...fresh]);
    fresh.forEach((row, i) => {
      uploadPhoto(images[i])
        .then((url) => patch(row.key, { url, status: "ready" }))
        .catch((e: any) => {
          patch(row.key, { status: "error" });
          toast.error(e?.message ?? `העלאת "${row.fileName}" נכשלה`);
        });
    });
  };

  const problems = rows.map((r) => {
    if (r.status === "uploading") return "מעלה…";
    if (!r.name.trim() || r.name.trim().length < 2) return "חסר שם";
    const p = parsePriceInput(r.price);
    if (!p.ok) return p.error;
    return null;
  });
  const uploading = rows.some((r) => r.status === "uploading");
  const readyCount = problems.filter((p) => p === null).length;
  const canCreate = !!categoryId && rows.length > 0 && readyCount === rows.length && !busy;

  const reset = () => {
    rows.forEach((r) => URL.revokeObjectURL(r.preview));
    setRows([]);
  };

  const submit = async () => {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return toast.error("יש לבחור קטגוריה");
    setBusy(true);
    try {
      const result = await create({
        categoryId,
        active,
        items: rows.map((r) => ({
          name: r.name.trim(),
          price: (parsePriceInput(r.price) as { ok: true; value: number }).value,
          imageUrl: r.status === "ready" ? r.url : null,
        })),
      });
      onCreated(cat, result);
      if (result.failed.length === 0) {
        reset();
        onOpenChange(false);
      } else {
        // Keep only the rows that failed, so the owner can fix and retry them.
        const failedNames = new Set(result.failed.map((f) => f.name));
        setRows((cur) => cur.filter((r) => failedNames.has(r.name.trim())));
      }
    } catch (e: any) {
      toast.error(e?.message ?? "יצירת המוצרים נכשלה");
    } finally {
      setBusy(false);
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(Array.from(e.dataTransfer.files ?? []));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && rows.length > 0 && !busy && !confirm("לסגור בלי ליצור את המוצרים?")) return;
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>הוספה מהירה מתמונות</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          בוחרים קטגוריה, מעלים תמונות — וכל תמונה הופכת למוצר. ממלאים שם ומחיר, ולוחצים "צור".
          תיאור ותמונות נוספות אפשר להוסיף אחר כך בעריכת המוצר.
        </p>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <Label htmlFor="quick-cat">קטגוריה</Label>
            <select
              id="quick-cat"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="flex h-10 w-full rounded-md border bg-background px-3 text-sm"
            >
              <option value="">— בחרו קטגוריה —</option>
              {options.map((o) => (
                <option key={o.id} value={o.id}>
                  {`${"   ".repeat(o.depth)}${o.depth ? "↳ " : ""}${o.name}`}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2 pb-2">
            <Switch id="quick-active" checked={active} onCheckedChange={setActive} />
            <Label htmlFor="quick-active">{active ? "לפרסם מיד באתר" : "לשמור כטיוטה"}</Label>
          </div>
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed px-3 py-6 text-center transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/50"
          }`}
        >
          <ImagePlus className="h-7 w-7 text-muted-foreground" />
          <span className="text-sm font-medium">גררו לכאן את תמונות המוצרים, או לחצו לבחירה</span>
          <span className="text-[11px] text-muted-foreground">
            תמונה אחת לכל מוצר · עד 50 בבת אחת · מוקטנות אוטומטית
          </span>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="sr-only"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            addFiles(files.slice(0, Math.max(0, 50 - rows.length)));
          }}
        />

        {rows.length > 0 && (
          <ul className="divide-y rounded-md border">
            {rows.map((r, i) => {
              const parsed = parsePriceInput(r.price);
              const problem = problems[i];
              return (
                <li key={r.key} className="flex items-start gap-3 p-2">
                  <img
                    src={r.preview}
                    alt=""
                    className={`h-16 w-16 shrink-0 rounded object-cover ${
                      r.status === "uploading" ? "opacity-50" : ""
                    } ${r.status === "error" ? "ring-2 ring-destructive" : ""}`}
                  />
                  <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_130px]">
                    <div>
                      <Label htmlFor={`qn-${r.key}`} className="text-[11px] text-muted-foreground">
                        שם המוצר
                      </Label>
                      <Input
                        id={`qn-${r.key}`}
                        value={r.name}
                        placeholder="לדוגמה: זוג פמוטי קריסטל 17 ס״מ"
                        onChange={(e) => patch(r.key, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`qp-${r.key}`} className="text-[11px] text-muted-foreground">
                        מחיר קטלוג (₪)
                      </Label>
                      <Input
                        id={`qp-${r.key}`}
                        dir="ltr"
                        inputMode="decimal"
                        value={r.price}
                        onChange={(e) => patch(r.key, { price: e.target.value })}
                      />
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {parsed.ok ? `ללקוח ₪${priceBreakdown(parsed.value, null).customer}` : " "}
                      </p>
                    </div>
                    <p
                      className={`text-[11px] sm:col-span-2 ${
                        r.status === "error"
                          ? "text-destructive"
                          : problem && r.status !== "uploading"
                            ? "text-amber-800 dark:text-amber-300"
                            : "text-muted-foreground"
                      }`}
                    >
                      {r.status === "error"
                        ? "התמונה לא הועלתה — המוצר ייווצר בלי תמונה, או הסירו את השורה"
                        : (problem ?? "מוכן")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(r.preview);
                      setRows((cur) => cur.filter((x) => x.key !== r.key));
                    }}
                    aria-label="הסר שורה"
                    className="grid h-8 w-8 shrink-0 place-content-center rounded hover:bg-muted"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="items-center gap-3 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {rows.length === 0
              ? "עדיין לא נבחרו תמונות"
              : `${readyCount} מתוך ${rows.length} מוכנים${uploading ? " · מעלה תמונות…" : ""}`}
          </span>
          <Button onClick={submit} disabled={!canCreate}>
            {busy ? "יוצר..." : `צור ${rows.length || ""} מוצרים`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
