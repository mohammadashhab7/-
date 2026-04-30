import { useState } from "react";
import {
  useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  getListCategoriesQueryKey,
  getListPublicCategoriesQueryKey,
  getListPublicProductsQueryKey,
  getListFeaturedProductsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Category } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import MediaPicker from "@/components/admin/MediaPicker";

export default function AdminCategoriesPage() {
  const { data: categories, isLoading } = useListCategories();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateCategory();
  const updateMut = useUpdateCategory();
  const deleteMut = useDeleteCategory();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ slug: "", nameAr: "", nameEn: "", descriptionAr: "", sortOrder: 0, imageUrl: "" });

  // Refresh both admin and public-facing caches so storefront visitors see
  // the new category data on their next focus/refetch instead of the
  // previous version flashing first.
  const refresh = () => {
    qc.invalidateQueries({ queryKey: getListCategoriesQueryKey() });
    qc.invalidateQueries({ queryKey: getListPublicCategoriesQueryKey() });
    // Public product/featured listings include the category name, so they
    // can also go stale when categories change.
    qc.invalidateQueries({ queryKey: getListPublicProductsQueryKey() });
    qc.invalidateQueries({ queryKey: getListFeaturedProductsQueryKey() });
  };
  const reset = () => { setForm({ slug: "", nameAr: "", nameEn: "", descriptionAr: "", sortOrder: 0, imageUrl: "" }); setEditing(null); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (c: Category) => {
    setEditing(c);
    setForm({ slug: c.slug, nameAr: c.nameAr, nameEn: c.nameEn || "", descriptionAr: c.descriptionAr || "", sortOrder: c.sortOrder, imageUrl: c.imageUrl || "" });
    setOpen(true);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...form, sortOrder: Number(form.sortOrder), imageUrl: form.imageUrl || undefined };
    const cb = {
      onSuccess: () => { refresh(); setOpen(false); reset(); toast({ title: "تم الحفظ" }); },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    };
    if (editing) updateMut.mutate({ id: editing.id, data }, cb);
    else createMut.mutate({ data }, cb);
  };

  const remove = (id: string) => {
    if (!confirm("حذف هذه الفئة؟")) return;
    deleteMut.mutate({ id }, { onSuccess: () => { refresh(); toast({ title: "تم الحذف" }); } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>الفئات</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button onClick={openNew} data-testid="button-new-category"><Plus className="ml-2 h-4 w-4" />فئة جديدة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل فئة" : "فئة جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>المعرّف (slug)</Label><Input required value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></div>
              <div><Label>الاسم بالعربية</Label><Input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
              <div><Label>Name (English)</Label><Input value={form.nameEn} onChange={(e) => setForm({ ...form, nameEn: e.target.value })} /></div>
              <div><Label>الوصف</Label><Textarea value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} /></div>
              <div><Label>الترتيب</Label><Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></div>
              <MediaPicker
                label="صورة الفئة"
                value={form.imageUrl}
                onChange={(url) => setForm({ ...form, imageUrl: url })}
                kind="image"
                testId="media-picker-category-image"
              />
              <DialogFooter><Button type="submit" disabled={createMut.isPending || updateMut.isPending}>حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>المعرّف</TableHead><TableHead>الترتيب</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {categories?.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nameAr}</TableCell>
                  <TableCell className="font-mono text-sm">{c.slug}</TableCell>
                  <TableCell>{c.sortOrder}</TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
