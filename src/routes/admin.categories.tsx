import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/categories")({
  component: AdminCategories,
});

type Cat = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  /** On-page SEO copy rendered at the bottom of the category page. */
  long_description: string | null;
  /** Hero banner image for the category page. */
  image_url: string | null;
  sort_order: number;
};

/** Empty inputs must be stored as NULL, not "", so the page falls back cleanly. */
const orNull = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

function AdminCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Cat | null>(null);
  const [open, setOpen] = useState(false);
  const { data: cats = [] } = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => {
      // Explicit column list so the SEO fields the form edits are always here.
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, description, long_description, image_url, sort_order")
        .order("sort_order");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const onSave = async (f: Partial<Cat>) => {
    const name = (f.name ?? "").trim();
    const slug = (f.slug ?? "").trim();
    if (!name || !slug) return toast.error("שם ו-Slug הם שדות חובה");
    // Explicit payload: never write back columns the form doesn't edit
    // (parent_slug, wp_id, timestamps) just because they rode along on the row.
    const payload = {
      name,
      slug,
      description: orNull(f.description),
      long_description: orNull(f.long_description),
      image_url: orNull(f.image_url),
      sort_order: f.sort_order ?? 0,
    };
    if (editing) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("נשמר"); setOpen(false); setEditing(null);
    qc.invalidateQueries({ queryKey: ["admin-cats"] });
  };

  const onDelete = async (id: string) => {
    if (!confirm("למחוק את הקטגוריה?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("נמחק");
    qc.invalidateQueries({ queryKey: ["admin-cats"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="font-display text-2xl font-bold">קטגוריות ({cats.length})</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> חדש</Button>
          </DialogTrigger>
          <CatDialog key={editing?.id ?? "new"} cat={editing} onSave={onSave} />
        </Dialog>
      </div>
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50"><tr className="text-right">
            <th className="p-3">שם</th><th className="p-3">Slug</th><th className="p-3">סדר</th>
            <th className="p-3">תוכן לעמוד הקטגוריה</th><th></th>
          </tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3 font-mono text-xs">{c.slug}</td>
                <td className="p-3">{c.sort_order}</td>
                {/* At-a-glance view of which categories still have no copy —
                    with 105 of them, the owner needs to see the gaps. */}
                <td className="p-3 whitespace-nowrap text-xs">
                  <Filled on={!!c.description} label="תיאור" />
                  <span className="text-muted-foreground/40"> · </span>
                  <Filled on={!!c.long_description} label="טקסט SEO" />
                  <span className="text-muted-foreground/40"> · </span>
                  <Filled on={!!c.image_url} label="תמונה" />
                </td>
                <td className="p-3 flex gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => onDelete(c.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Green when the field has content, muted when it's still empty. */
function Filled({ on, label }: { on: boolean; label: string }) {
  return (
    <span className={on ? "text-accent" : "text-muted-foreground/60"}>
      {label} {on ? "✓" : "—"}
    </span>
  );
}

function CatDialog({ cat, onSave }: { cat: Cat | null; onSave: (f: Partial<Cat>) => void }) {
  const [form, setForm] = useState<Partial<Cat>>(cat ?? { name: "", slug: "", sort_order: 0 });
  const descLen = (form.description ?? "").trim().length;
  return (
    <DialogContent className="max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{cat ? "עריכת קטגוריה" : "קטגוריה חדשה"}</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div><Label>שם</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div>
          <Label>תיאור קצר</Label>
          <Textarea
            rows={3}
            value={form.description ?? ""}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            מוצג מתחת לכותרת בעמוד הקטגוריה, ומשמש גם כתיאור המטא (meta description) בתוצאות החיפוש.
            מומלץ עד 160 תווים — גוגל גוזר טקסט ארוך יותר. אם נשאר ריק, נוצר תיאור כללי אוטומטי.
          </p>
          <p className={`mt-1 text-xs ${descLen > 160 ? "text-destructive" : "text-muted-foreground/70"}`}>
            {descLen}/160 תווים
          </p>
        </div>
        <div>
          <Label>טקסט SEO ארוך</Label>
          <Textarea
            rows={7}
            value={form.long_description ?? ""}
            onChange={(e) => setForm({ ...form, long_description: e.target.value })}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            נכתב בעברית ומוצג בתחתית עמוד הקטגוריה, מתחת למוצרים, תחת הכותרת "קצת על …".
            זהו התוכן שמנועי החיפוש קוראים — כדאי לכתוב כמה פסקאות ייחודיות לקטגוריה. ירידות שורה נשמרות.
            אם נשאר ריק, האזור פשוט לא מוצג.
          </p>
        </div>
        <div>
          <Label>כתובת תמונת באנר (URL)</Label>
          <Input
            type="url"
            dir="ltr"
            inputMode="url"
            placeholder="https://example.com/banner.jpg"
            value={form.image_url ?? ""}
            onChange={(e) => setForm({ ...form, image_url: e.target.value })}
          />
          {(form.image_url ?? "").trim().startsWith("http") && (
            <img
              src={(form.image_url ?? "").trim()}
              alt="תצוגה מקדימה של באנר הקטגוריה"
              loading="lazy"
              decoding="async"
              width={320}
              height={140}
              className="mt-2 h-[70px] w-40 rounded border object-cover"
            />
          )}
          <p className="mt-1 text-xs text-muted-foreground">
            תמונה רחבה שתוצג כבאנר בראש עמוד הקטגוריה (מומלץ יחס 21:8, לדוגמה 1600×700 פיקסלים).
            אם נשאר ריק, מוצגת כותרת טקסט בלבד.
          </p>
        </div>
        <div><Label>סדר תצוגה</Label><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSave(form)}>שמור</Button></DialogFooter>
    </DialogContent>
  );
}
