import { useState } from "react";
import {
  useGetDailyClosing, useCloseDailyClosing,
  getGetDailyClosingQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useFormatPrice, formatDate } from "@/lib/format";

export default function AdminClosingPage() {
  const formatSyp = useFormatPrice();
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const { data: closing, isLoading } = useGetDailyClosing(date);
  const closeMut = useCloseDailyClosing();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [counted, setCounted] = useState(0);
  const [note, setNote] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    closeMut.mutate({ date, data: { countedCash: Number(counted) || 0, note: note || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetDailyClosingQueryKey(date) });
        toast({ title: "تم إغلاق اليوم" });
      },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>إغلاق اليوم</CardTitle>
            <div className="flex items-center gap-2">
              <Label>التاريخ:</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? <p>جاري التحميل...</p> : closing ? (
            <div className="space-y-3 max-w-md">
              <div className="text-sm text-foreground/60">{formatDate(closing.date)}</div>
              <div className="flex justify-between"><span>عدد الفواتير:</span><span className="font-medium">{closing.completedCount}</span></div>
              <div className="flex justify-between"><span>إجمالي المبيعات:</span><span className="font-medium">{formatSyp(closing.salesTotalMinor)}</span></div>
              <div className="flex justify-between"><span>نقداً:</span><span className="font-medium">{formatSyp(closing.cashTotalMinor)}</span></div>
              <div className="flex justify-between"><span>بطاقة:</span><span className="font-medium">{formatSyp(closing.cardTotalMinor)}</span></div>
              {closing.otherTotalMinor !== undefined && closing.otherTotalMinor > 0 && (
                <div className="flex justify-between"><span>طرق أخرى:</span><span className="font-medium">{formatSyp(closing.otherTotalMinor)}</span></div>
              )}
              {closing.breakdown && (
                <div className="text-xs text-foreground/60 pt-2 border-t mt-2 space-y-1">
                  {Object.entries(closing.breakdown).map(([k, v]) => (
                    <div key={k} className="flex justify-between"><span>{k}</span><span dir="ltr">{formatSyp(Number(v))}</span></div>
                  ))}
                </div>
              )}
              {closing.isClosed ? (
                <div className="space-y-2 pt-3 border-t">
                  <Badge variant="secondary">مُغلق</Badge>
                  <div className="flex justify-between"><span>النقد المُحسوب:</span><span>{formatSyp(closing.countedCashMinor)}</span></div>
                  <div className="flex justify-between"><span>الفرق:</span><span className={Number(closing.varianceMinor || 0) === 0 ? "text-green-700" : "text-destructive"}>{formatSyp(closing.varianceMinor)}</span></div>
                  {closing.note && <p className="text-sm text-foreground/70">{closing.note}</p>}
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-3 pt-3 border-t">
                  <div><Label>النقد المُحسوب فعليًا (×100)</Label><Input type="number" required value={counted} onChange={(e) => setCounted(Number(e.target.value))} /></div>
                  <div><Label>ملاحظات</Label><Textarea value={note} onChange={(e) => setNote(e.target.value)} /></div>
                  <Button type="submit" disabled={closeMut.isPending}>إغلاق اليوم</Button>
                </form>
              )}
            </div>
          ) : (
            <p>لا توجد بيانات لهذا التاريخ.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
