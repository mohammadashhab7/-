import { useState } from "react";
import {
  useListTransfers,
  useCreateTransfer,
  useApproveTransfer,
  useCompleteTransfer,
  useCancelTransfer,
  useListInventoryLocations,
  useListProducts,
  getListTransfersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, X, Check, CircleSlash } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatQty } from "@/lib/format";

interface Item { productId: string; quantity: number }

type TransferStatus = "pending" | "approved" | "completed" | "cancelled";

const STATUS_LABEL: Record<TransferStatus, string> = {
  pending: "بانتظار الاعتماد",
  approved: "معتمد",
  completed: "مكتمل",
  cancelled: "ملغي",
};

const STATUS_VARIANT: Record<TransferStatus, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "secondary",
  completed: "default",
  cancelled: "destructive",
};

export default function AdminTransfersPage() {
  const { data: transfers, isLoading } = useListTransfers();
  const { data: locations } = useListInventoryLocations();
  const { data: products } = useListProducts();
  const qc = useQueryClient();
  const { toast } = useToast();
  const createMut = useCreateTransfer();
  const approveMut = useApproveTransfer();
  const completeMut = useCompleteTransfer();
  const cancelMut = useCancelTransfer();
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ productId: "", quantity: 0 }]);
  // When true, transfer is created and stock moves immediately. When false, a request is created (pending).
  const [executeImmediately, setExecuteImmediately] = useState(true);

  const invalidate = () => qc.invalidateQueries({ queryKey: getListTransfersQueryKey() });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createMut.mutate({ data: {
      fromLocationId: from,
      toLocationId: to,
      notesAr: notes || undefined,
      executeImmediately,
      items: items.filter((i) => i.productId).map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
    }}, {
      onSuccess: () => {
        invalidate();
        setOpen(false); setFrom(""); setTo(""); setNotes(""); setItems([{ productId: "", quantity: 0 }]); setExecuteImmediately(true);
        toast({ title: executeImmediately ? "تم التحويل" : "تم إنشاء طلب التحويل" });
      },
      onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
    });
  };

  const onApprove = (id: string) => approveMut.mutate({ id }, {
    onSuccess: () => { invalidate(); toast({ title: "تم الاعتماد" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const onComplete = (id: string) => completeMut.mutate({ id }, {
    onSuccess: () => { invalidate(); toast({ title: "تم تنفيذ التحويل" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });
  const onCancel = (id: string) => cancelMut.mutate({ id }, {
    onSuccess: () => { invalidate(); toast({ title: "تم الإلغاء" }); },
    onError: (e: any) => toast({ title: "خطأ", description: e?.message, variant: "destructive" }),
  });

  const findLoc = (id: string) => locations?.find((l) => l.id === id)?.nameAr || id;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>التحويلات بين المواقع</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button data-testid="btn-new-transfer"><Plus className="ml-2 h-4 w-4" />تحويل جديد</Button></DialogTrigger>
          <DialogContent className="max-w-xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>تحويل جديد</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>من</Label>
                  <Select value={from} onValueChange={setFrom}>
                    <SelectTrigger data-testid="select-from"><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>{locations?.map((l) => <SelectItem key={l.id} value={l.id}>{l.nameAr}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>إلى</Label>
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger data-testid="select-to"><SelectValue placeholder="اختر" /></SelectTrigger>
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
              <div className="flex items-center gap-3 rounded-md border bg-muted/40 p-3">
                <Switch
                  id="execute-immediately"
                  checked={executeImmediately}
                  onCheckedChange={setExecuteImmediately}
                  data-testid="switch-execute-immediately"
                />
                <div className="flex-1">
                  <Label htmlFor="execute-immediately" className="text-sm font-medium cursor-pointer">
                    تنفيذ فوري (تحريك المخزون الآن)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {executeImmediately
                      ? "سيتم خصم البضاعة من المصدر وإضافتها للوجهة فور الإرسال."
                      : "سيتم إنشاء طلب تحويل بحالة (بانتظار الاعتماد) دون تحريك المخزون."}
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={!from || !to || createMut.isPending} data-testid="btn-submit-transfer">
                  {executeImmediately ? "تنفيذ التحويل" : "إنشاء طلب"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>من</TableHead>
                <TableHead>إلى</TableHead>
                <TableHead>العناصر</TableHead>
                <TableHead>ملاحظات</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transfers?.map((t) => {
                const status = (t.status ?? "completed") as TransferStatus;
                return (
                  <TableRow key={t.id} data-testid={`transfer-row-${t.id}`}>
                    <TableCell>{formatDateTime(t.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[status]} data-testid={`transfer-status-${t.id}`}>
                        {STATUS_LABEL[status]}
                      </Badge>
                    </TableCell>
                    <TableCell>{findLoc(t.fromLocationId)}</TableCell>
                    <TableCell>{findLoc(t.toLocationId)}</TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        {t.items.map((it, i) => (<div key={i}>{it.productNameAr}: {formatQty(it.quantity)}</div>))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-foreground/70">{t.notesAr || "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-start flex-wrap">
                        {status === "pending" && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={approveMut.isPending}
                            onClick={() => onApprove(t.id)}
                            data-testid={`btn-approve-${t.id}`}
                          >
                            <Check className="h-3 w-3 ml-1" />اعتماد
                          </Button>
                        )}
                        {(status === "pending" || status === "approved") && (
                          <Button
                            size="sm"
                            disabled={completeMut.isPending}
                            onClick={() => onComplete(t.id)}
                            data-testid={`btn-complete-${t.id}`}
                          >
                            <Check className="h-3 w-3 ml-1" />تنفيذ
                          </Button>
                        )}
                        {(status === "pending" || status === "approved") && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={cancelMut.isPending}
                            onClick={() => onCancel(t.id)}
                            data-testid={`btn-cancel-${t.id}`}
                          >
                            <CircleSlash className="h-3 w-3 ml-1" />إلغاء
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
