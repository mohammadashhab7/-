import { useState } from "react";
import {
  useListProductionOrders, useCreateProductionOrder, useListRecipes,
  getListProductionOrdersQueryKey,
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
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatSyp, formatDateTime } from "@/lib/format";

export default function AdminProductionPage() {
  const { data: orders, isLoading } = useListProductionOrders();
  const { data: recipes } = useListRecipes();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateProductionOrder();
  const [open, setOpen] = useState(false);
  const [recipeId, setRecipeId] = useState("");
  const [batchCount, setBatchCount] = useState(1);
  const [notes, setNotes] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: { recipeId, batchCount: Number(batchCount), notesAr: notes || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListProductionOrdersQueryKey() });
        setOpen(false); setRecipeId(""); setBatchCount(1); setNotes("");
        toast({ title: "تم إنشاء أمر الإنتاج" });
      },
      onError: (e: any) => toast({ title: "خطأ", description: e?.message || "تعذّر الإنشاء", variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>أوامر الإنتاج</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4" />أمر إنتاج</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>أمر إنتاج جديد</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>الوصفة</Label>
                <Select value={recipeId} onValueChange={setRecipeId}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{recipes?.map((r) => <SelectItem key={r.id} value={r.id}>{r.productNameAr} ({r.yieldQuantity}/دفعة)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>عدد الدفعات</Label><Input type="number" min="1" required value={batchCount} onChange={(e) => setBatchCount(Number(e.target.value))} /></div>
              <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={!recipeId || createMut.isPending}>تنفيذ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>المنتج</TableHead><TableHead>الدفعات</TableHead><TableHead>الوحدات</TableHead><TableHead>الكلفة الإجمالية</TableHead><TableHead>الحالة</TableHead></TableRow></TableHeader>
            <TableBody>
              {orders?.map((o) => (
                <TableRow key={o.id}>
                  <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                  <TableCell className="font-medium">{o.productNameAr}</TableCell>
                  <TableCell>{o.batchCount}</TableCell>
                  <TableCell>{o.unitsProduced}</TableCell>
                  <TableCell>{formatSyp(o.totalCostMinor)}</TableCell>
                  <TableCell><Badge variant="secondary">{o.status === "completed" ? "مكتمل" : o.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
