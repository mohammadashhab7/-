import { useState } from "react";
import {
  useListStock, useListInventoryLocations, useListLowStock,
  useCreateInventoryAdjustment, useListProducts, useListRawMaterials,
  getListStockQueryKey, getListLowStockQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { formatQty, formatSyp } from "@/lib/format";

export default function AdminInventoryPage() {
  const { data: locations } = useListInventoryLocations();
  const [locationId, setLocationId] = useState<string>("");
  const { data: stock } = useListStock(locationId ? { locationId } : undefined);
  const { data: lowStock } = useListLowStock();
  const { data: products } = useListProducts();
  const { data: materials } = useListRawMaterials();
  const adjMut = useCreateInventoryAdjustment();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [adjOpen, setAdjOpen] = useState(false);
  const [adj, setAdj] = useState({ locationId: "", itemType: "product" as "product" | "material", itemId: "", quantityChange: 0, note: "" });

  const submitAdj = (e: React.FormEvent) => {
    e.preventDefault();
    adjMut.mutate({ data: { ...adj, quantityChange: Number(adj.quantityChange) } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListStockQueryKey() });
        qc.invalidateQueries({ queryKey: getListLowStockQueryKey() });
        setAdjOpen(false); toast({ title: "تمت التسوية" });
      },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif text-primary">المخزون</h1>
        <Dialog open={adjOpen} onOpenChange={setAdjOpen}>
          <DialogTrigger asChild><Button>تسوية مخزون</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>تسوية مخزون</DialogTitle></DialogHeader>
            <form onSubmit={submitAdj} className="space-y-3">
              <div><Label>الموقع</Label>
                <Select value={adj.locationId} onValueChange={(v) => setAdj({ ...adj, locationId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>{locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.nameAr}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>النوع</Label>
                <Select value={adj.itemType} onValueChange={(v: any) => setAdj({ ...adj, itemType: v, itemId: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="product">منتج</SelectItem><SelectItem value="material">مادة خام</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>الصنف</Label>
                <Select value={adj.itemId} onValueChange={(v) => setAdj({ ...adj, itemId: v })}>
                  <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                  <SelectContent>
                    {(adj.itemType === "product" ? products : materials)?.map((it: any) => (
                      <SelectItem key={it.id} value={it.id}>{it.nameAr}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>التغيير في الكمية (× 1000؛ موجب أو سالب)</Label><Input type="number" required value={adj.quantityChange} onChange={(e) => setAdj({ ...adj, quantityChange: Number(e.target.value) })} /></div>
              <div><Label>ملاحظة</Label><Textarea value={adj.note} onChange={(e) => setAdj({ ...adj, note: e.target.value })} /></div>
              <DialogFooter><Button type="submit" disabled={!adj.locationId || !adj.itemId}>تسوية</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="stock">
        <TabsList>
          <TabsTrigger value="stock">المخزون الحالي</TabsTrigger>
          <TabsTrigger value="low">تنبيهات المخزون المنخفض ({lowStock?.length || 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="stock">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Label>الموقع:</Label>
                <Select value={locationId || "_all"} onValueChange={(v) => setLocationId(v === "_all" ? "" : v)}>
                  <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">جميع المواقع</SelectItem>
                    {locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.nameAr}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>الموقع</TableHead><TableHead>الصنف</TableHead><TableHead>النوع</TableHead><TableHead>الكمية</TableHead><TableHead>القيمة</TableHead></TableRow></TableHeader>
                <TableBody>
                  {stock?.map((s, i) => (
                    <TableRow key={i}>
                      <TableCell>{s.locationNameAr}</TableCell>
                      <TableCell className="font-medium">{s.itemNameAr}</TableCell>
                      <TableCell><Badge variant="outline">{s.itemType === "product" ? "منتج" : "مادة"}</Badge></TableCell>
                      <TableCell>{formatQty(s.quantity)} <span className="text-foreground/50 text-xs">{s.unit}</span></TableCell>
                      <TableCell>{s.valueMinor != null ? formatSyp(s.valueMinor) : "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="low">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader><TableRow><TableHead>الصنف</TableHead><TableHead>الكمية الحالية</TableHead><TableHead>حد إعادة الطلب</TableHead></TableRow></TableHeader>
                <TableBody>
                  {lowStock?.map((l, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{l.itemNameAr}</TableCell>
                      <TableCell className="text-destructive">{formatQty(l.totalQuantity)} <span className="text-xs">{l.unit}</span></TableCell>
                      <TableCell>{formatQty(l.reorderThreshold)} <span className="text-xs">{l.unit}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
