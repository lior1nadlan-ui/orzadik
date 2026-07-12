import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatILS } from "@/lib/cart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/admin/products")({
  component: AdminProducts,
});

type Product = {
  id: string; slug: string; name: string; description: string | null; short_description: string | null;
  price: number; sale_price: number | null; sku: string | null; stock_status: string;
  stock_qty: number | null; thumbnail_url: string | null; is_active: boolean;
};

function AdminProducts() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);

  const { data: products = [] } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as Product[];
    },
  });

  const filtered = search ? products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase())) : products;

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
        <h1 className="font-display text-2xl font-bold">מוצרים ({filtered.length})</h1>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(null); setOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> חדש</Button>
          </DialogTrigger>
          <ProductDialog product={editing} onSave={onSave} />
        </Dialog>
      </div>
      <Input placeholder="חיפוש..." value={search} onChange={(e) => setSearch(e.target.value)} className="mb-4 max-w-sm" />
      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-right">
              <th className="p-3 font-medium">תמונה</th>
              <th className="p-3 font-medium">שם</th>
              <th className="p-3 font-medium">מחיר</th>
              <th className="p-3 font-medium">מלאי</th>
              <th className="p-3 font-medium">פעיל</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-2">
                  {p.thumbnail_url && <img src={p.thumbnail_url} alt="" className="h-12 w-12 rounded object-cover" />}
                </td>
                <td className="p-3 max-w-xs"><div className="line-clamp-2">{p.name}</div></td>
                <td className="p-3 whitespace-nowrap">{formatILS(p.sale_price ?? p.price)}</td>
                <td className="p-3"><span className={p.stock_status === "instock" ? "text-green-600" : "text-destructive"}>{p.stock_status === "instock" ? "במלאי" : "אזל"}</span></td>
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
    </div>
  );
}

function ProductDialog({ product, onSave }: { product: Product | null; onSave: (f: Partial<Product>) => void }) {
  const [form, setForm] = useState<Partial<Product>>(
    product ?? { name: "", slug: "", price: 0, stock_status: "instock", is_active: true }
  );
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{product ? "עריכת מוצר" : "מוצר חדש"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid md:grid-cols-2 gap-3">
          <div><Label>שם *</Label><Input value={form.name ?? ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Slug *</Label><Input value={form.slug ?? ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
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
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(form)}>שמור</Button>
      </DialogFooter>
    </DialogContent>
  );
}
