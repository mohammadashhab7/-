import { useState } from "react";
import {
  useListRecipes, useCreateRecipe, useDeleteRecipe,
  useListProducts, useListRawMaterials,
  getListRecipesQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFormatPrice, formatQty } from "@/lib/format";

interface Item { materialId: string; quantity: number }

export default function AdminRecipesPage() {
  const formatSyp = useFormatPrice();
  const { data: recipes, isLoading } = useListRecipes();
  const { data: products } = useListProducts();
  const { data: materials } = useListRawMaterials();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateRecipe();
  const deleteMut = useDeleteRecipe();
  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState("");
  const [yieldQty, setYieldQty] = useState(1);
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ materialId: "", quantity: 0 }]);

  const refresh = () => qc.invalidateQueries({ queryKey: getListRecipesQueryKey() });
  const reset = () => { setProductId(""); setYieldQty(1); setNotes(""); setItems([{ materialId: "", quantity: 0 }]); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = {
      productId, yieldQuantity: Number(yieldQty), notesAr: notes || undefined,
      items: items.filter((i) => i.materialId).map((i) => ({ materialId: i.materialId, quantity: Number(i.quantity) })),
    };
    createMut.mutate({ data }, {
      onSuccess: () => { refresh(); setOpen(false); reset(); toast({ title: "تمت إضافة الوصفة" }); },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  const remove = (id: string) => {
    if (!confirm("حذف الوصفة؟")) return;
    deleteMut.mutate({ id }, { onSuccess: () => { refresh(); toast({ title: "تم الحذف" }); } });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>وصفات الإنتاج</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4" />وصفة جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>وصفة جديدة</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>المنتج</Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="اختر منتج" /></SelectTrigger>
                  <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nameAr}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>الإنتاج لكل دفعة (وحدات)</Label><Input type="number" min="1" value={yieldQty} onChange={(e) => setYieldQty(Number(e.target.value))} /></div>
              <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <div>
                <div className="flex items-center justify-between mb-2"><Label>المكوّنات (الكمية بالغرامات/الميل-لتر)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { materialId: "", quantity: 0 }])}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="space-y-2">
                  {items.map((it, i) => (
                    <div key={i} className="flex gap-2">
                      <Select value={it.materialId} onValueChange={(v) => setItems(items.map((x, j) => j === i ? { ...x, materialId: v } : x))}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="مادة" /></SelectTrigger>
                        <SelectContent>{materials?.map((m) => <SelectItem key={m.id} value={m.id}>{m.nameAr}</SelectItem>)}</SelectContent>
                      </Select>
                      <Input type="number" className="w-32" value={it.quantity} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                      <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter><Button type="submit" disabled={createMut.isPending || !productId}>حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الإنتاج/دفعة</TableHead><TableHead>المكوّنات</TableHead><TableHead>الكلفة/وحدة</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {recipes?.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.productNameAr}</TableCell>
                  <TableCell>{r.yieldQuantity}</TableCell>
                  <TableCell className="text-sm text-foreground/70">{r.items?.length ?? 0} مكوّن</TableCell>
                  <TableCell>{r.unitCostMinor != null ? formatSyp(r.unitCostMinor) : "-"}</TableCell>
                  <TableCell className="text-left"><Button variant="ghost" size="icon" onClick={() => remove(r.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
