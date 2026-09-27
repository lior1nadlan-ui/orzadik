// Category picker for the product dialog: search, the tree with indentation,
// and the chosen categories as removable chips at the top.
//
// It replaces a flat A-Z list of 102 checkboxes, in which a sub-category like
// "כיפות סרוגות" sat far from its parent and nothing could be searched.

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoryOptions, type CategoryNode } from "@/lib/admin-pricing";
import { filterCategories } from "@/lib/admin-catalog";

export function CategoryPicker({
  categories,
  selected,
  onToggle,
  loading,
  emptyNote = "לא נבחרה קטגוריה — מוצר בלי קטגוריה לא יופיע בדפי הקטגוריות באתר.",
}: {
  categories: CategoryNode[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  loading?: boolean;
  /** What to say while nothing is chosen. The default is the product form's warning. */
  emptyNote?: string;
}) {
  const [query, setQuery] = useState("");
  const options = useMemo(() => categoryOptions(categories), [categories]);
  const shown = filterCategories(options, query);
  const byId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  return (
    <fieldset className="rounded-md border p-3 space-y-2">
      <legend className="px-1 text-sm font-semibold">קטגוריות</legend>

      {selected.size > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {[...selected].map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onToggle(id)}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/5 px-2.5 py-1 text-xs hover:bg-primary/10"
              aria-label={`הסר את ${byId.get(id)?.name ?? "הקטגוריה"}`}
            >
              {byId.get(id)?.name ?? "…"}
              <X className="h-3 w-3" />
            </button>
          ))}
        </div>
      ) : (
        !loading && (
          <p className="text-[11px] font-medium text-amber-800 dark:text-amber-300">{emptyNote}</p>
        )
      )}

      <Input
        placeholder="חיפוש קטגוריה…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9"
      />

      {loading && <p className="text-xs text-muted-foreground">טוען קטגוריות…</p>}
      {!loading && shown.length === 0 && (
        <p className="text-xs text-muted-foreground">לא נמצאה קטגוריה בשם הזה.</p>
      )}
      <div className="max-h-56 space-y-1 overflow-y-auto pe-1">
        {shown.map((o) => {
          const cid = `cat-${o.id}`;
          return (
            <div
              key={o.id}
              className="flex items-center gap-2"
              style={{ paddingInlineStart: `${o.depth * 1.25}rem` }}
            >
              <Checkbox
                id={cid}
                checked={selected.has(o.id)}
                onCheckedChange={() => onToggle(o.id)}
              />
              <Label
                htmlFor={cid}
                className={`cursor-pointer text-sm ${o.depth === 0 ? "font-medium" : "font-normal"}`}
              >
                {o.name}
              </Label>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
