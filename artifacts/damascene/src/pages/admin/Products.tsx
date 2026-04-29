import { useState } from "react";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListCategories, getListProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Product } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatSyp } from "@/lib/format";
import MediaPicker from "@/components/admin/MediaPicker";

const emptyForm = {
  slug: "", sku: "", nameAr: "", nameEn: "", descriptionAr: "",
  categoryId: "", priceMinor: 0, unit: "kg", weightGrams: 0,
  imageUrl: "", isActive: true, isFeatured: false, reorderThreshold: 0,
};

export default function AdminProductsPage() {
  const { data: products, isLoading } = useListProducts();
  const { data: cats } = useListCategories();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateProduct();
  const updateMut = useUpdateProduct();
  const deleteMut = useDeleteProduct();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => qc.invalidateQueries({ queryKey: getListProductsQueryKey() });
  const reset = () => { setForm(emptyForm); setEditing(null); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({
      slug: p.slug, sku: p.sku || "", nameAr: p.nameAr, nameEn: p.nameEn || "",
      descriptionAr: p.descriptionAr || "", categoryId: p.categoryId || "",
      priceMinor: p.priceMinor, unit: p.unit, weightGrams: p.weightGrams || 0,
      imageUrl: p.imageUrl || "", isActive: p.isActive, isFeatured: p.isFeatured,
      reorderThreshold: p.reorderThreshold || 0,
    });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...form, priceMinor: Number(form.priceMinor), weightGrams: Number(form.weightGrams) || undefined, reorderThreshold: Number(form.reorderThreshold) || undefined, categoryId: form.categoryId || undefined };
    const cb = {
      onSuccess: () => { refresh(); setOpen(false); reset(); toast({ title: "تم الحفظ" }); },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    };
    if (editing) updateMut.mutate({ id: editing.id, data }, cb);
    else createMut.mutate({ data }, cb);
  };

  const remove = (id: string) => {
    if (!confirm("حذف هذا المنتج؟")) return;
    deleteMut.mutate({ id }, { onSuccess: () => { refresh(); toast({ title: "تم الحذف" }); } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>المنتجات</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button onClick={openNew} data-testid="button-new-product"><Plus className="ml-2 h-4 w-4" />منتج جديد</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>{editing ? "تعديل منتج" : "منتج جديد"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 grid grid-cols-2 gap-3">
                <div><Label>المعرّف (slug)</Label><Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
                <div><Label>SKU</Label><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              </div>
              <div className="col-span-2"><Label>الاسم بالعربية</Label><Input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
              <div className="col-span-2"><Label>Name (English)</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
              <div className="col-span-2"><Label>الوصف</Label><Textarea value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} /></div>
              <div><Label>الفئة</Label>
                <Select value={form.categoryId || "_none"} onValueChange={(v) => setForm({ ...form, categoryId: v === "_none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">بدون</SelectItem>
                    {cats?.map((c) => <SelectItem key={c.id} value={c.id}>{c.nameAr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الوحدة</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">كغ</SelectItem>
                    <SelectItem value="piece">قطعة</SelectItem>
                    <SelectItem value="box">علبة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>السعر (ل.س × 100)</Label><Input type="number" required value={form.priceMinor} onChange={(e) => setForm({ ...form, priceMinor: Number(e.target.value) })} /></div>
              <div><Label>الوزن (غ)</Label><Input type="number" value={form.weightGrams} onChange={(e) => setForm({ ...form, weightGrams: Number(e.target.value) })} /></div>
              <div className="col-span-2">
                <MediaPicker
                  label="صورة المنتج"
                  value={form.imageUrl}
                  onChange={(url) => setForm({ ...form, imageUrl: url })}
                  kind="image"
                  testId="media-picker-product-image"
                />
              </div>
              <div><Label>حد إعادة الطلب</Label><Input type="number" value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) })} /></div>
              <div className="flex items-center gap-2 mt-6"><Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} /><Label>نشط</Label></div>
              <div className="flex items-center gap-2"><Switch checked={form.isFeatured} onCheckedChange={(v) => setForm({ ...form, isFeatured: v })} /><Label>مميّز</Label></div>
              <DialogFooter className="col-span-2"><Button type="submit" disabled={createMut.isPending || updateMut.isPending}>حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الفئة</TableHead><TableHead>السعر</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {products?.map((p) => (
                <TableRow key={p.id} data-testid={`row-product-${p.slug}`}>
                  <TableCell className="font-medium">{p.nameAr}</TableCell>
                  <TableCell>{p.categoryNameAr || "-"}</TableCell>
                  <TableCell>{formatSyp(p.priceMinor)}</TableCell>
                  <TableCell className="space-x-1 space-x-reverse">
                    {p.isActive ? <Badge variant="secondary">نشط</Badge> : <Badge variant="outline">غير نشط</Badge>}
                    {p.isFeatured && <Badge>مميّز</Badge>}
                  </TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
