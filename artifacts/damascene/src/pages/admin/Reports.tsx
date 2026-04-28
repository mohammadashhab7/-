import { useState } from "react";
import { useGetSalesTrend, useGetTopProducts, useGetFinancialReport } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatSyp, formatDate } from "@/lib/format";

export default function AdminReportsPage() {
  const [days, setDays] = useState(30);
  const { data: trend } = useGetSalesTrend({ days });
  const { data: top } = useGetTopProducts({ limit: 10, days });
  const today = new Date().toISOString().slice(0, 10);
  const dateFrom = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const { data: report } = useGetFinancialReport({ dateFrom, dateTo: today });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-serif text-primary">التقارير</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-foreground/70">الفترة:</span>
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 أيام</SelectItem>
              <SelectItem value="30">30 يومًا</SelectItem>
              <SelectItem value="90">90 يومًا</SelectItem>
            </SelectContent>
          </Select>
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
              <Tooltip formatter={(v: any, key) => key === "sales" ? formatSyp(Number(v) * 100) : v} />
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
    </div>
  );
}
