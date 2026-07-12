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

type Cat = { id: string; slug: string; name: string; description: string | null; sort_order: number };

function AdminCategories() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Cat | null>(null);
  const [open, setOpen] = useState(false);
  const { data: cats = [] } = useQuery({
    queryKey: ["admin-cats"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data as Cat[];
    },
  });

  const onSave = async (f: Partial<Cat>) => {
    if (editing) {
      const { error } = await supabase.from("categories").update(f).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("categories").insert({
        slug: f.slug!, name: f.name!, description: f.description ?? null, sort_order: f.sort_order ?? 0,
      });
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
            <th className="p-3">שם</th><th className="p-3">Slug</th><th className="p-3">סדר</th><th></th>
          </tr></thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-3">{c.name}</td>
                <td className="p-3 font-mono text-xs">{c.slug}</td>
                <td className="p-3">{c.sort_order}</td>
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

function CatDialog({ cat, onSave }: { cat: Cat | null; onSave: (f: Partial<Cat>) => void }) {
  const [form, setForm] = useState<Partial<Cat>>(cat ?? { name: "", slug: "", sort_order: 0 });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{cat ? "עריכת קטגוריה" : "קטגוריה חדשה"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>שם</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
        <div><Label>Slug</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
        <div><Label>תיאור</Label><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
        <div><Label>סדר תצוגה</Label><Input type="number" value={form.sort_order ?? 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSave(form)}>שמור</Button></DialogFooter>
    </DialogContent>
  );
}
