import { useMemo, useState } from "react";
import {
  useListWholesaleOrders,
  useCreateWholesaleOrder,
  useConfirmWholesaleOrder,
  useDeliverWholesaleOrder,
  useCancelWholesaleOrder,
  useListBusinessUnits,
  useListProducts,
  useGetMe,
  getListWholesaleOrdersQueryKey,
  type WholesaleOrder,
  type WholesaleOrderStatus as WholesaleOrderStatusType,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, X, Check, CircleSlash, Truck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDateTime, formatQty, formatSyp } from "@/lib/format";

interface DraftItem {
  productId: string;
  quantity: number;
  unitPriceMinor: number;
}

const STATUS_VARIANT: Record<
  WholesaleOrderStatusType,
  "default" | "secondary" | "destructive" | "outline"
> = {
  draft: "outline",
  confirmed: "secondary",
  delivered: "default",
  cancelled: "destructive",
};

export default function AdminWholesalePage() {
  const { data: me } = useGetMe();
  const { data: orders, isLoading } = useListWholesaleOrders();
  const { data: businessUnits } = useListBusinessUnits();
  const { data: products } = useListProducts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const createMut = useCreateWholesaleOrder();
  const confirmMut = useConfirmWholesaleOrder();
  const deliverMut = useDeliverWholesaleOrder();
  const cancelMut = useCancelWholesaleOrder();

  const role = (me?.role ?? null) as string | null;
  const isPrivileged = role === "admin" || role === "owner";
  const assignedBuId = me?.assignedBusinessUnitId ?? null;
  const assignedBu = useMemo(
    () => businessUnits?.find((b) => b.id === assignedBuId) ?? null,
    [businessUnits, assignedBuId],
  );
  const isFactoryUser = isPrivileged || assignedBu?.kind === "factory";
  const showrooms = useMemo(
    () =>
      (businessUnits ?? []).filter((b) => b.kind === "showroom" && b.isActive),
    [businessUnits],
  );
  const factories = useMemo(
    () =>
      (businessUnits ?? []).filter((b) => b.kind === "factory" && b.isActive),
    [businessUnits],
  );

  const [open, setOpen] = useState(false);
  const [sellerId, setSellerId] = useState("");
  const [buyerId, setBuyerId] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { productId: "", quantity: 0, unitPriceMinor: 0 },
  ]);

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: getListWholesaleOrdersQueryKey() });

  const resetForm = () => {
    setSellerId("");
    setBuyerId("");
    setNotes("");
    setItems([{ productId: "", quantity: 0, unitPriceMinor: 0 }]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const filtered = items.filter(
      (i) => i.productId && i.quantity > 0 && i.unitPriceMinor >= 0,
    );
    if (!buyerId || filtered.length === 0) return;
    createMut.mutate(
      {
        data: {
          sellerBusinessUnitId:
            isPrivileged && !assignedBu ? sellerId || undefined : undefined,
          buyerBusinessUnitId: buyerId,
          notesAr: notes || undefined,
          items: filtered.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitPriceMinor: Number(i.unitPriceMinor),
          })),
        },
      },
      {
        onSuccess: () => {
          invalidate();
          setOpen(false);
          resetForm();
          toast({ title: "تم إنشاء فاتورة الجملة كمسودة" });
        },
        onError: (err: unknown) =>
          toast({
            title: "خطأ",
            description: (err as Error)?.message,
            variant: "destructive",
          }),
      },
    );
  };

  const onConfirm = (id: string) =>
    confirmMut.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "تم تأكيد الفاتورة" });
        },
        onError: (err: unknown) =>
          toast({
            title: "خطأ",
            description: (err as Error)?.message,
            variant: "destructive",
          }),
      },
    );
  const onDeliver = (id: string) =>
    deliverMut.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({
            title: "تم التسليم",
            description: "تم تحريك المخزون وتسجيل الإيراد والمصروف",
          });
        },
        onError: (err: unknown) =>
          toast({
            title: "خطأ",
            description: (err as Error)?.message,
            variant: "destructive",
          }),
      },
    );
  const onCancel = (id: string) =>
    cancelMut.mutate(
      { id },
      {
        onSuccess: () => {
          invalidate();
          toast({ title: "تم الإلغاء" });
        },
        onError: (err: unknown) =>
          toast({
            title: "خطأ",
            description: (err as Error)?.message,
            variant: "destructive",
          }),
      },
    );

  const STATUS_LABEL_AR: Record<WholesaleOrderStatusType, string> = {
    draft: "مسودة",
    confirmed: "مؤكد",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };

  const totalLine = (it: DraftItem) =>
    Math.max(0, Number(it.quantity) || 0) *
    Math.max(0, Number(it.unitPriceMinor) || 0);
  const draftTotal = items.reduce((sum, i) => sum + totalLine(i), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>فواتير الجملة (المعمل ↔ المعارض)</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {isFactoryUser
              ? "أنشئ فاتورة بيع جملة للمعارض. عند التسليم يُسجَّل الإيراد للمعمل والمصروف للمعرض تلقائياً."
              : "فواتير الشراء من المعمل. تظهر فقط بعد تأكيد المعمل لها."}
          </p>
        </div>
        {isFactoryUser && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button data-testid="btn-new-wholesale">
                <Plus className="ml-2 h-4 w-4" />
                فاتورة جملة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>فاتورة جملة جديدة (مسودة)</DialogTitle>
              </DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                {isPrivileged && !assignedBu && factories.length > 1 && (
                  <div>
                    <Label>المعمل البائع</Label>
                    <Select value={sellerId} onValueChange={setSellerId}>
                      <SelectTrigger data-testid="select-seller">
                        <SelectValue placeholder="اختر المعمل" />
                      </SelectTrigger>
                      <SelectContent>
                        {factories.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.nameAr}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div>
                  <Label>المعرض المشتري</Label>
                  <Select value={buyerId} onValueChange={setBuyerId}>
                    <SelectTrigger data-testid="select-buyer">
                      <SelectValue placeholder="اختر المعرض" />
                    </SelectTrigger>
                    <SelectContent>
                      {showrooms.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <div className="flex justify-between mb-2">
                    <Label>البنود (الكمية × 1000 + سعر الجملة بالأغوار)</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setItems([
                          ...items,
                          { productId: "", quantity: 0, unitPriceMinor: 0 },
                        ])
                      }
                      data-testid="btn-add-item"
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  {items.map((it, i) => (
                    <div key={i} className="flex gap-2 mb-2">
                      <Select
                        value={it.productId}
                        onValueChange={(v) =>
                          setItems(
                            items.map((x, j) =>
                              j === i ? { ...x, productId: v } : x,
                            ),
                          )
                        }
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="منتج" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nameAr}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        className="w-24"
                        placeholder="الكمية"
                        value={it.quantity}
                        onChange={(e) =>
                          setItems(
                            items.map((x, j) =>
                              j === i
                                ? { ...x, quantity: Number(e.target.value) }
                                : x,
                            ),
                          )
                        }
                        data-testid={`input-qty-${i}`}
                      />
                      <Input
                        type="number"
                        className="w-32"
                        placeholder="السعر (أغوار)"
                        value={it.unitPriceMinor}
                        onChange={(e) =>
                          setItems(
                            items.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    unitPriceMinor: Number(e.target.value),
                                  }
                                : x,
                            ),
                          )
                        }
                        data-testid={`input-price-${i}`}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          setItems(items.filter((_, j) => j !== i))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div>
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </div>

                <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                  <span className="text-sm font-medium">الإجمالي</span>
                  <span
                    className="text-lg font-bold"
                    data-testid="text-draft-total"
                  >
                    {formatSyp(draftTotal)}
                  </span>
                </div>

                <DialogFooter>
                  <Button
                    type="submit"
                    disabled={!buyerId || createMut.isPending}
                    data-testid="btn-submit-wholesale"
                  >
                    حفظ كمسودة
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p>جاري التحميل...</p>
        ) : (orders ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            لا توجد فواتير جملة بعد.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الرقم</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>البائع</TableHead>
                <TableHead>المشتري</TableHead>
                <TableHead>البنود</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead className="text-left">إجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(orders ?? []).map((o: WholesaleOrder) => {
                const status = o.status as WholesaleOrderStatusType;
                const isSeller = o.sellerBusinessUnitId === assignedBuId;
                const canMutate = isPrivileged || isSeller;
                return (
                  <TableRow
                    key={o.id}
                    data-testid={`wholesale-row-${o.id}`}
                  >
                    <TableCell className="font-mono text-xs">
                      {o.orderNumber}
                    </TableCell>
                    <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={STATUS_VARIANT[status]}
                        data-testid={`wholesale-status-${o.id}`}
                      >
                        {STATUS_LABEL_AR[status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.sellerNameAr ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.buyerNameAr ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-0.5">
                        {o.items.map((it, i) => (
                          <div key={i}>
                            {it.productNameAr}: {formatQty(it.quantity)} ×{" "}
                            {formatSyp(it.unitPriceMinor)}
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="font-bold">
                      {formatSyp(o.totalMinor)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-start flex-wrap">
                        {canMutate && status === "draft" && (
                          <>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={confirmMut.isPending}
                              onClick={() => onConfirm(o.id)}
                              data-testid={`btn-confirm-${o.id}`}
                            >
                              <Check className="h-3 w-3 ml-1" />
                              تأكيد
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={cancelMut.isPending}
                              onClick={() => onCancel(o.id)}
                              data-testid={`btn-cancel-${o.id}`}
                            >
                              <CircleSlash className="h-3 w-3 ml-1" />
                              إلغاء
                            </Button>
                          </>
                        )}
                        {canMutate && status === "confirmed" && (
                          <>
                            <Button
                              size="sm"
                              disabled={deliverMut.isPending}
                              onClick={() => onDeliver(o.id)}
                              data-testid={`btn-deliver-${o.id}`}
                            >
                              <Truck className="h-3 w-3 ml-1" />
                              تسليم
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={cancelMut.isPending}
                              onClick={() => onCancel(o.id)}
                              data-testid={`btn-cancel-${o.id}`}
                            >
                              <CircleSlash className="h-3 w-3 ml-1" />
                              إلغاء
                            </Button>
                          </>
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
