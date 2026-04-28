import { useState } from "react";
import {
  useGetSalesTrend,
  useGetTopProducts,
  useGetFinancialReport,
  useGetMaterialSpend,
  useGetStoreKpis,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download } from "lucide-react";
import { formatSyp, formatDate } from "@/lib/format";

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? "/api").replace(/\/$/, "");

export default function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const { data: trend } = useGetSalesTrend({ days });
  const { data: top } = useGetTopProducts({ limit: 10, days });
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data: report } = useGetFinancialReport({ dateFrom, dateTo: today });
  const { data: materialSpend } = useGetMaterialSpend({ fromDate: dateFrom, toDate: today });
  const { data: storeKpis } = useGetStoreKpis({ fromDate: dateFrom, toDate: today });

  const csvHref = (path: string) => `${API_BASE}${path}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-serif text-primary">التقارير</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-foreground/70">الفترة:</span>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 أيام</SelectItem>
              <SelectItem value="30">30 يومًا</SelectItem>
              <SelectItem value="90">90 يومًا</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" asChild data-testid="btn-export-financial">
            <a href={csvHref(`/reports/financial.csv?dateFrom=${dateFrom}&dateTo=${today}`)}>
              <Download className="h-4 w-4 ml-1" /> CSV مالي
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="btn-export-cogs">
            <a href={csvHref(`/reports/cogs.csv?dateFrom=${dateFrom}&dateTo=${today}`)}>
              <Download className="h-4 w-4 ml-1" /> CSV التكلفة
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="btn-export-trend">
            <a href={csvHref(`/reports/sales-trend.csv?days=${days}`)}>
              <Download className="h-4 w-4 ml-1" /> CSV اتجاه
            </a>
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="btn-export-top">
            <a href={csvHref(`/reports/top-products.csv?days=${days}`)}>
              <Download className="h-4 w-4 ml-1" /> CSV الأعلى
            </a>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <Card><CardHeader><CardTitle className="text-sm text-foreground/70">إجمالي المبيعات</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatSyp(report?.combined?.incomeMinor)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-foreground/70">إجمالي المصاريف</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-destructive">{formatSyp(report?.combined?.expenseMinor)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm text-foreground/70">صافي الربح</CardTitle></CardHeader>
          <CardContent><div className={"text-2xl font-bold " + ((report?.combined?.netMinor || 0) >= 0 ? "text-green-700" : "text-destructive")}>{formatSyp(report?.combined?.netMinor)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>اتجاه المبيعات</CardTitle></CardHeader>
        <CardContent style={{ height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={(trend || []).map((p) => ({ ...p, sales: p.salesMinor / 100 }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(v) => v.slice(5)} />
              <YAxis />
              <Tooltip
                formatter={(v: number | string, key: string) =>
                  key === "sales" ? formatSyp(Number(v) * 100) : String(v)
                }
              />
              <Bar dataKey="sales" fill="hsl(var(--primary))" name="المبيعات" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>المنتجات الأكثر مبيعًا</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>المنتج</TableHead><TableHead>الوحدات المباعة</TableHead><TableHead>الإيرادات</TableHead></TableRow></TableHeader>
            <TableBody>
              {top?.map((t) => (
                <TableRow key={t.productId}>
                  <TableCell className="font-medium">{t.productNameAr}</TableCell>
                  <TableCell>{t.unitsSold}</TableCell>
                  <TableCell className="font-medium">{formatSyp(t.revenueMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card data-testid="card-store-kpis">
        <CardHeader>
          <CardTitle>مؤشرات المتجر (POS مقابل الإنترنت)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-3">
            <div className="rounded-md border p-3">
              <div className="text-xs text-foreground/70">إجمالي الطلبات</div>
              <div className="text-xl font-bold" data-testid="store-kpi-total-orders">{storeKpis?.totalOrders ?? 0}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-foreground/70">إجمالي الإيرادات</div>
              <div className="text-xl font-bold" data-testid="store-kpi-total-revenue">{formatSyp(storeKpis?.totalRevenueMinor)}</div>
            </div>
            <div className="rounded-md border p-3">
              <div className="text-xs text-foreground/70">متوسط قيمة الطلب</div>
              <div className="text-xl font-bold" data-testid="store-kpi-aov">{formatSyp(storeKpis?.avgOrderValueMinor)}</div>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium mb-2">حسب القناة</h3>
              <Table>
                <TableHeader><TableRow><TableHead>القناة</TableHead><TableHead>الطلبات</TableHead><TableHead>الإيرادات</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(storeKpis?.byChannel || []).map((c) => (
                    <TableRow key={c.channel} data-testid={`store-kpi-channel-${c.channel}`}>
                      <TableCell>{c.channel === "pos" ? "نقطة البيع" : "الإنترنت"}</TableCell>
                      <TableCell>{c.orders}</TableCell>
                      <TableCell className="font-medium">{formatSyp(c.revenueMinor)}</TableCell>
                    </TableRow>
                  ))}
                  {(storeKpis?.byChannel?.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-3">لا توجد بيانات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            <div>
              <h3 className="text-sm font-medium mb-2">حسب طريقة الدفع</h3>
              <Table>
                <TableHeader><TableRow><TableHead>الطريقة</TableHead><TableHead>الطلبات</TableHead><TableHead>الإيرادات</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(storeKpis?.byPaymentMethod || []).map((p) => (
                    <TableRow key={p.paymentMethod} data-testid={`store-kpi-payment-${p.paymentMethod}`}>
                      <TableCell>{p.paymentMethod}</TableCell>
                      <TableCell>{p.orders}</TableCell>
                      <TableCell className="font-medium">{formatSyp(p.revenueMinor)}</TableCell>
                    </TableRow>
                  ))}
                  {(storeKpis?.byPaymentMethod?.length ?? 0) === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-3">لا توجد بيانات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-material-spend">
        <CardHeader>
          <CardTitle>مصاريف المواد الأولية في الإنتاج</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border p-3 inline-block">
            <div className="text-xs text-foreground/70">إجمالي مصاريف المواد</div>
            <div className="text-2xl font-bold" data-testid="material-spend-total">{formatSyp(materialSpend?.totalSpendMinor)}</div>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المادة</TableHead>
                <TableHead>الكمية المستهلكة</TableHead>
                <TableHead>الوحدة</TableHead>
                <TableHead>التكلفة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(materialSpend?.byMaterial || []).map((m) => (
                <TableRow key={m.materialId} data-testid={`material-spend-row-${m.materialId}`}>
                  <TableCell className="font-medium">{m.nameAr}</TableCell>
                  <TableCell>{(m.quantityThousandths / 1000).toFixed(3)}</TableCell>
                  <TableCell>{m.unit}</TableCell>
                  <TableCell className="font-medium">{formatSyp(m.spendMinor)}</TableCell>
                </TableRow>
              ))}
              {(materialSpend?.byMaterial?.length ?? 0) === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-3">لا توجد دفعات إنتاج مكتملة في هذه الفترة</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
