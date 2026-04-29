import { useListMyOrders } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFormatPrice, formatDateTime, ORDER_STATUS_AR } from "@/lib/format";

export default function MyOrdersPage() {
  const { data: orders, isLoading } = useListMyOrders();
  const formatSyp = useFormatPrice();
  return (
    <Card>
      <CardHeader><CardTitle>طلباتي</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-foreground/60 text-sm">جاري التحميل...</p>
        ) : !orders || orders.length === 0 ? (
          <p className="text-foreground/60 text-sm">لا توجد طلبات.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>رقم الطلب</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المنتجات</TableHead>
                <TableHead>الإجمالي</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orders.map((o) => (
                <TableRow key={o.id} data-testid={`row-order-${o.orderNumber}`}>
                  <TableCell className="font-mono text-sm">{o.orderNumber}</TableCell>
                  <TableCell>{formatDateTime(o.createdAt)}</TableCell>
                  <TableCell><Badge variant="secondary">{ORDER_STATUS_AR[o.status] || o.status}</Badge></TableCell>
                  <TableCell className="text-sm text-foreground/70">{o.items.length} منتج</TableCell>
                  <TableCell className="font-medium">{formatSyp(o.totalMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
