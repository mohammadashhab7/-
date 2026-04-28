import { useState } from "react";
import {
  useGetFinancialReport, useListFinancialEntries, useCreateFinancialEntry,
  getListFinancialEntriesQueryKey, getGetFinancialReportQueryKey,
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
import { Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatSyp, formatDate } from "@/lib/format";

function BookSummary({ title, book }: { title: string; book: any }) {
  if (!book) return null;
  return (
    <Card>
      <CardHeader><CardTitle className="text-lg">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex justify-between"><span>الإيرادات</span><span className="text-green-700 font-medium">{formatSyp(book.incomeMinor)}</span></div>
        <div className="flex justify-between"><span>المصاريف</span><span className="text-destructive font-medium">{formatSyp(book.expenseMinor)}</span></div>
        <div className="flex justify-between border-t pt-2 font-medium"><span>الصافي</span><span className={book.netMinor >= 0 ? "text-green-700" : "text-destructive"}>{formatSyp(book.netMinor)}</span></div>
      </CardContent>
    </Card>
  );
}

export default function AdminFinancialsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(monthAgo);
  const [dateTo, setDateTo] = useState(today);
  const { data: report } = useGetFinancialReport({ dateFrom, dateTo });
  const { data: entries } = useListFinancialEntries({ dateFrom, dateTo });
  const createEntry = useCreateFinancialEntry();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ module: "store" as "store" | "production", type: "expense" as "income" | "expense", category: "", descriptionAr: "", amountMinor: 0, occurredOn: today });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    createEntry.mutate({ data: { ...form, amountMinor: Number(form.amountMinor) } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListFinancialEntriesQueryKey() });
        qc.invalidateQueries({ queryKey: getGetFinancialReportQueryKey() });
        setOpen(false); toast({ title: "تم الحفظ" });
      },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-serif text-primary">المالية (دفتر الإنتاج ودفتر المتجر)</h1>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-40" />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-40" />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4" />قيد جديد</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>قيد مالي جديد</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>الدفتر</Label>
                    <Select value={form.module} onValueChange={(v: any) => setForm({ ...form, module: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="store">المتجر</SelectItem><SelectItem value="production">الإنتاج</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div><Label>النوع</Label>
                    <Select value={form.type} onValueChange={(v: any) => setForm({ ...form, type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="income">إيراد</SelectItem><SelectItem value="expense">مصروف</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>التصنيف</Label><Input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="إيجار، رواتب، مواد خام..." /></div>
                <div><Label>الوصف</Label><Textarea value={form.descriptionAr} onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label>المبلغ (×100)</Label><Input type="number" required value={form.amountMinor} onChange={(e) => setForm({ ...form, amountMinor: Number(e.target.value) })} /></div>
                  <div><Label>التاريخ</Label><Input type="date" required value={form.occurredOn} onChange={(e) => setForm({ ...form, occurredOn: e.target.value })} /></div>
                </div>
                <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-3">
        <BookSummary title="دفتر الإنتاج" book={report?.production} />
        <BookSummary title="دفتر المتجر" book={report?.store} />
        <BookSummary title="مجمّع" book={report?.combined} />
      </div>

      <Card>
        <CardHeader><CardTitle>القيود</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>التاريخ</TableHead><TableHead>الدفتر</TableHead><TableHead>النوع</TableHead>
              <TableHead>التصنيف</TableHead><TableHead>الوصف</TableHead><TableHead>المبلغ</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {entries?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell>{formatDate(e.occurredOn)}</TableCell>
                  <TableCell><Badge variant="outline">{e.module === "store" ? "المتجر" : "الإنتاج"}</Badge></TableCell>
                  <TableCell><Badge variant={e.type === "income" ? "default" : "secondary"}>{e.type === "income" ? "إيراد" : "مصروف"}</Badge></TableCell>
                  <TableCell>{e.category}</TableCell>
                  <TableCell className="text-sm">{e.descriptionAr || "-"}</TableCell>
                  <TableCell className={"font-medium " + (e.type === "income" ? "text-green-700" : "text-destructive")}>{formatSyp(e.amountMinor)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
