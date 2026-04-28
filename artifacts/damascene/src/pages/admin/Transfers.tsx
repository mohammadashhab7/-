import { useState } from "react";
import {
  useListTransfers, useCreateTransfer, useListInventoryLocations, useListProducts,
  getListTransfersQueryKey,
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
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatQty } from "@/lib/format";

interface Item { productId: string; quantity: number }

export default function AdminTransfersPage() {
  const { data: transfers, isLoading } = useListTransfers();
  const { data: locations } = useListInventoryLocations();
  const { data: products } = useListProducts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateTransfer();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: 0 }]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: {
      fromLocationId: from, toLocationId: to, notesAr: notes || undefined,
      items: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
    }}, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListTransfersQueryKey() });
        setOpen(false); setFrom(""); setTo(""); setNotes(""); setItems([{ productId: "", quantity: 0 }]);
        toast({ title: "تم التحويل" });
      },
      onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
    });
  };

  const findLoc = (id: string) => locations?.find((l) => l.id === id)?.nameAr || id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>التحويلات بين المواقع</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4" />تحويل جديد</Button></DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>تحويل جديد</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>من</Label>
                  <Select value={from} onValueChange={setFrom}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.nameAr}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>إلى</Label>
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.nameAr}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2"><Label>العناصر (الكمية × 1000)</Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setItems([...items, { productId: "", quantity: 0 }])}><Plus className="h-3 w-3" /></Button>
                </div>
                {items.map((it, i) => (
                  <div key={i} className="flex gap-2 mb-2">
                    <Select value={it.productId} onValueChange={(v) => setItems(items.map((x, j) => j === i ? { ...x, productId: v } : x))}>
                      <SelectTrigger className="flex-1"><SelectValue placeholder="منتج" /></SelectTrigger>
                      <SelectContent>{products?.map((p) => <SelectItem key={p.id} value={p.id}>{p.nameAr}</SelectItem>)}</SelectContent>
                    </Select>
                    <Input type="number" className="w-32" value={it.quantity} onChange={(e) => setItems(items.map((x, j) => j === i ? { ...x, quantity: Number(e.target.value) } : x))} />
                    <Button type="button" variant="ghost" size="icon" onClick={() => setItems(items.filter((_, j) => j !== i))}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
              <div><Label>ملاحظات</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
              <DialogFooter><Button type="submit" disabled={!from || !to || createMut.isPending}>تنفيذ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>التاريخ</TableHead><TableHead>من</TableHead><TableHead>إلى</TableHead><TableHead>العناصر</TableHead><TableHead>ملاحظات</TableHead></TableRow></TableHeader>
            <TableBody>
              {transfers?.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                  <TableCell>{findLoc(t.fromLocationId)}</TableCell>
                  <TableCell>{findLoc(t.toLocationId)}</TableCell>
                  <TableCell>
                    <div className="text-sm space-y-0.5">
                      {t.items.map((it, i) => (<div key={i}>{it.productNameAr}: {formatQty(it.quantity)}</div>))}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-foreground/70">{t.notesAr || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
