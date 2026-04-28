import { useState } from "react";
import {
  useListSalesOrders, useUpdateSalesOrderStatus, useGetSalesOrder,
  getListSalesOrdersQueryKey, getGetSalesOrderQueryKey,
  type OrderStatus,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { formatSyp, formatDateTime, ORDER_STATUS_AR, CHANNEL_AR, PAYMENT_METHOD_AR } from "@/lib/format";

const statusOptions: OrderStatus[] = ["pending_payment", "paid", "pending", "confirmed", "preparing", "ready", "out_for_delivery", "completed", "cancelled", "refunded"];

function OrderTable({ channel }: { channel: "online" | "pos" }) {
  const { data: orders, isLoading } = useListSalesOrders({ channel });
  const updateStatus = useUpdateSalesOrderStatus();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: detail } = useGetSalesOrder(openId || "", {
    query: {
      enabled: !!openId,
      queryKey: getGetSalesOrderQueryKey(openId || ""),
    },
  });

  const handleStatus = (id: string, status: OrderStatus) => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey({ channel }) });
        toast({ title: "تم التحديث" });
      },
    });
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p>جاري التحميل...</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>رقم الطلب</TableHead><TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead><TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead><TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {orders?.map((o) => (
                  <TableRow key={o.id} data-testid={`row-order-${o.orderNumber}`}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                    <TableCell>{o.customerName || "-"}</TableCell>
                    <TableCell className="font-medium">{formatSyp(o.totalMinor)}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => handleStatus(o.id, v as OrderStatus)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{statusOptions.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_AR[s]}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell><Button size="sm" variant="outline" onClick={() => setOpenId(o.id)}>عرض</Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      <Dialog open={!!openId} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader><DialogTitle>تفاصيل الطلب {detail?.orderNumber}</DialogTitle></DialogHeader>
          {detail && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div><span className="text-foreground/60">القناة:</span> {CHANNEL_AR[detail.channel]}</div>
                <div><span className="text-foreground/60">الحالة:</span> <Badge variant="secondary">{ORDER_STATUS_AR[detail.status]}</Badge></div>
                <div><span className="text-foreground/60">العميل:</span> {detail.customerName || "-"}</div>
                <div><span className="text-foreground/60">الهاتف:</span> {detail.customerPhone || "-"}</div>
                {detail.deliveryAddress && <div className="col-span-2"><span className="text-foreground/60">العنوان:</span> {detail.deliveryAddress}</div>}
                <div><span className="text-foreground/60">الدفع:</span> {detail.paymentMethod ? PAYMENT_METHOD_AR[detail.paymentMethod] : "-"}</div>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الكمية</TableHead><TableHead>السعر</TableHead><TableHead>الإجمالي</TableHead></TableRow></TableHeader>
                <TableBody>
                  {detail.items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell>{it.productNameAr}</TableCell>
                      <TableCell>{it.quantity}</TableCell>
                      <TableCell>{formatSyp(it.unitPriceMinor)}</TableCell>
                      <TableCell>{formatSyp(it.lineTotalMinor)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between pt-3 border-t font-medium">
                <span>الإجمالي:</span><span>{formatSyp(detail.totalMinor)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AdminOrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-serif text-primary">الطلبات</h1>
      <Tabs defaultValue="online">
        <TabsList>
          <TabsTrigger value="online">الإنترنت</TabsTrigger>
          <TabsTrigger value="pos">نقطة البيع</TabsTrigger>
        </TabsList>
        <TabsContent value="online"><OrderTable channel="online" /></TabsContent>
        <TabsContent value="pos"><OrderTable channel="pos" /></TabsContent>
      </Tabs>
    </div>
  );
}
