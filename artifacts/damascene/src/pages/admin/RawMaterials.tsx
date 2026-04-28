import { useState } from "react";
import {
  useListRawMaterials, useCreateRawMaterial, useUpdateRawMaterial, useDeleteRawMaterial,
  getListRawMaterialsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { RawMaterial } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatSyp } from "@/lib/format";

const empty = { sku: "", nameAr: "", unit: "kg", costPerUnitMinor: 0, reorderThreshold: 0 };

export default function AdminRawMaterialsPage() {
  const { data, isLoading } = useListRawMaterials();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateRawMaterial();
  const updateMut = useUpdateRawMaterial();
  const deleteMut = useDeleteRawMaterial();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [form, setForm] = useState(empty);

  const refresh = () => qc.invalidateQueries({ queryKey: getListRawMaterialsQueryKey() });
  const reset = () => { setForm(empty); setEditing(null); };
  const openNew = () => { reset(); setOpen(true); };
  const openEdit = (m: RawMaterial) => {
    setEditing(m);
    setForm({ sku: m.sku, nameAr: m.nameAr, unit: m.unit, costPerUnitMinor: m.costPerUnitMinor, reorderThreshold: m.reorderThreshold || 0 });
    setOpen(true);
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data: any = { ...form, costPerUnitMinor: Number(form.costPerUnitMinor), reorderThreshold: Number(form.reorderThreshold) || undefined };
    const cb = { onSuccess: () => { refresh(); setOpen(false); reset(); toast({ title: "تم الحفظ" }); }, onError: () => toast({ title: "خطأ", variant: "destructive" }) };
    if (editing) updateMut.mutate({ id: editing.id, data }, cb);
    else createMut.mutate({ data }, cb);
  };
  const remove = (id: string) => {
    if (!confirm("حذف؟")) return;
    deleteMut.mutate({ id }, { onSuccess: () => { refresh(); toast({ title: "تم الحذف" }); } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>المواد الخام</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button onClick={openNew}><Plus className="ml-2 h-4 w-4" />مادة جديدة</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "تعديل" : "مادة خام جديدة"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>SKU</Label><Input required value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></div>
              <div><Label>الاسم</Label><Input required value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} /></div>
              <div><Label>الوحدة</Label>
                <Select value={form.unit} onValueChange={(v) => setForm({ ...form, unit: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">كغ</SelectItem><SelectItem value="g">غ</SelectItem>
                    <SelectItem value="l">لتر</SelectItem><SelectItem value="ml">مل</SelectItem>
                    <SelectItem value="piece">قطعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الكلفة لكل وحدة (ل.س × 100)</Label><Input type="number" required value={form.costPerUnitMinor} onChange={(e) => setForm({ ...form, costPerUnitMinor: Number(e.target.value) })} /></div>
              <div><Label>حد إعادة الطلب</Label><Input type="number" value={form.reorderThreshold} onChange={(e) => setForm({ ...form, reorderThreshold: Number(e.target.value) })} /></div>
              <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>SKU</TableHead><TableHead>الاسم</TableHead><TableHead>الوحدة</TableHead><TableHead>الكلفة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-mono text-sm">{m.sku}</TableCell>
                  <TableCell className="font-medium">{m.nameAr}</TableCell>
                  <TableCell>{m.unit}</TableCell>
                  <TableCell>{formatSyp(m.costPerUnitMinor)}</TableCell>
                  <TableCell className="text-left">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
