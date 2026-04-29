import { useMemo, useState } from "react";
import {
  useListSalesOrders, useUpdateSalesOrderStatus, useGetSalesOrder,
  getListSalesOrdersQueryKey, getGetSalesOrderQueryKey,
  type OrderStatus, type SalesOrder,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useFormatPrice, formatDateTime, ORDER_STATUS_AR, CHANNEL_AR, PAYMENT_METHOD_AR } from "@/lib/format";

const STATUS_OPTIONS: OrderStatus[] = [
  "pending_payment", "paid", "pending", "confirmed", "preparing",
  "ready", "out_for_delivery", "delivered", "completed", "cancelled", "refunded",
];
const CHANNEL_OPTIONS: Array<"online" | "pos"> = ["online", "pos"];

export default function AdminOrdersPage() {
  const formatSyp = useFormatPrice();
  const [channels, setChannels] = useState<Set<"online" | "pos">>(new Set(["online", "pos"]));
  const [statuses, setStatuses] = useState<Set<OrderStatus>>(new Set());
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [openId, setOpenId] = useState<string | null>(null);

  const updateStatus = useUpdateSalesOrderStatus();
  const qc = useQueryClient();
  const { toast } = useToast();

  // Fetch broad list (server filtering by single channel only when one is selected;
  // otherwise fetch all and filter client-side). Date filters always go to server.
  const useSingleChannel = channels.size === 1 ? Array.from(channels)[0] : undefined;
  const queryParams: Parameters<typeof useListSalesOrders>[0] = { limit: 200 };
  if (useSingleChannel) queryParams.channel = useSingleChannel;
  if (dateFrom) queryParams.dateFrom = dateFrom;
  if (dateTo) queryParams.dateTo = dateTo;

  const { data: orders, isLoading } = useListSalesOrders(queryParams);

  const filtered = useMemo(() => {
    if (!orders) return [] as SalesOrder[];
    return orders.filter((o) => {
      if (channels.size > 0 && !channels.has(o.channel)) return false;
      if (statuses.size > 0 && !statuses.has(o.status)) return false;
      return true;
    });
  }, [orders, channels, statuses]);

  const { data: detail } = useGetSalesOrder(openId || "", {
    query: { enabled: !!openId, queryKey: getGetSalesOrderQueryKey(openId || "") },
  });

  const handleStatus = (id: string, status: OrderStatus) => {
    updateStatus.mutate({ id, data: { status } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListSalesOrdersQueryKey(queryParams) });
        toast({ title: "تم التحديث" });
      },
    });
  };

  const toggleChannel = (c: "online" | "pos", v: boolean) => {
    setChannels((prev) => {
      const next = new Set(prev);
      if (v) next.add(c); else next.delete(c);
      return next;
    });
  };
  const toggleStatus = (s: OrderStatus, v: boolean) => {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (v) next.add(s); else next.delete(s);
      return next;
    });
  };
  const clearFilters = () => {
    setChannels(new Set(["online", "pos"]));
    setStatuses(new Set());
    setDateFrom("");
    setDateTo("");
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-serif text-primary">الطلبات</h1>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label className="block mb-2 text-sm">القناة</Label>
              <div className="flex flex-wrap gap-3" data-testid="filter-channels">
                {CHANNEL_OPTIONS.map((c) => (
                  <label key={c} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={channels.has(c)}
                      onCheckedChange={(v) => toggleChannel(c, !!v)}
                      data-testid={`filter-channel-${c}`}
                    />
                    {CHANNEL_AR[c]}
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="date-from" className="block mb-2 text-sm">من تاريخ</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  data-testid="filter-date-from"
                />
              </div>
              <div>
                <Label htmlFor="date-to" className="block mb-2 text-sm">إلى تاريخ</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  data-testid="filter-date-to"
                />
              </div>
            </div>
          </div>

          <div>
            <Label className="block mb-2 text-sm">الحالة</Label>
            <div className="flex flex-wrap gap-3" data-testid="filter-statuses">
              {STATUS_OPTIONS.map((s) => (
                <label key={s} className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox
                    checked={statuses.has(s)}
                    onCheckedChange={(v) => toggleStatus(s, !!v)}
                    data-testid={`filter-status-${s}`}
                  />
                  {ORDER_STATUS_AR[s]}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-sm text-muted-foreground">
              {filtered.length} طلب
            </span>
            <Button variant="outline" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
              مسح المرشحات
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {isLoading ? <p>جاري التحميل...</p> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>القناة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>العميل</TableHead>
                <TableHead>الإجمالي</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead></TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">لا توجد طلبات تطابق المرشحات</TableCell></TableRow>
                ) : filtered.map((o) => (
                  <TableRow key={o.id} data-testid={`row-order-${o.orderNumber}`}>
                    <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                    <TableCell><Badge variant={o.channel === "pos" ? "default" : "secondary"}>{CHANNEL_AR[o.channel]}</Badge></TableCell>
                    <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                    <TableCell>{o.customerName || "-"}</TableCell>
                    <TableCell className="font-medium">{formatSyp(o.totalMinor)}</TableCell>
                    <TableCell>
                      <Select value={o.status} onValueChange={(v) => handleStatus(o.id, v as OrderStatus)}>
                        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS_AR[s]}</SelectItem>)}</SelectContent>
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
              {detail.statusHistory && detail.statusHistory.length > 0 && (
                <div className="pt-3 border-t" data-testid="order-status-timeline">
                  <h3 className="font-medium mb-2">سجل الحالة</h3>
                  <ol className="space-y-2 border-r-2 border-border pr-4 me-2">
                    {detail.statusHistory.map((ev) => (
                      <li
                        key={ev.id}
                        data-testid={`timeline-event-${ev.toStatus}`}
                        className="relative"
                      >
                        <span className="absolute -right-[1.45rem] top-1 w-3 h-3 rounded-full bg-primary" />
                        <div className="flex items-center gap-2 flex-wrap">
                          {ev.fromStatus ? (
                            <>
                              <Badge variant="outline">{ORDER_STATUS_AR[ev.fromStatus]}</Badge>
                              <span className="text-foreground/40">←</span>
                            </>
                          ) : (
                            <span className="text-foreground/60 text-xs">إنشاء</span>
                          )}
                          <Badge variant="secondary">{ORDER_STATUS_AR[ev.toStatus]}</Badge>
                        </div>
                        <div className="text-xs text-foreground/60 mt-1">
                          {new Date(ev.changedAt).toLocaleString("ar-SY")}
                          {ev.changedByNameAr && <span> · {ev.changedByNameAr}</span>}
                        </div>
                        {ev.noteAr && (
                          <div className="text-xs text-foreground/80 mt-1">{ev.noteAr}</div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
