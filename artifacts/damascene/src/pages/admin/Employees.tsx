import { useState } from "react";
import {
  useListEmployees, useCreateEmployee, useUpdateEmployee,
  useListSalaries, usePaySalary, useListAttendance, useCreateAttendance,
  getListEmployeesQueryKey, getListSalariesQueryKey, getListAttendanceQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@workspace/api-client-react";
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
import { Plus, Pencil } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useFormatPrice, formatDate } from "@/lib/format";

const empty = { fullNameAr: "", role: "", phone: "", nationalId: "", baseSalaryMinor: 0, hiredOn: new Date().toISOString().slice(0, 10), notesAr: "", isActive: true };

function EmployeesTab() {
  const formatSyp = useFormatPrice();
  const { data, isLoading } = useListEmployees();
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateEmployee();
  const update = useUpdateEmployee();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState(empty);

  const refresh = () => qc.invalidateQueries({ queryKey: getListEmployeesQueryKey() });
  const reset = () => { setForm(empty); setEditing(null); };
  const openEdit = (e: Employee) => { setEditing(e); setForm({ ...empty, ...e }); setOpen(true); };
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    const data: any = { ...form, baseSalaryMinor: Number(form.baseSalaryMinor) };
    const cb = { onSuccess: () => { refresh(); setOpen(false); reset(); toast({ title: "تم الحفظ" }); } };
    if (editing) update.mutate({ id: editing.id, data }, cb);
    else create.mutate({ data }, cb);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>الموظفون</CardTitle>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
          <DialogTrigger asChild><Button onClick={() => { reset(); setOpen(true); }}><Plus className="ml-2 h-4 w-4" />موظف جديد</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>{editing ? "تعديل موظف" : "موظف جديد"}</DialogTitle></DialogHeader>
            <form onSubmit={submit} className="space-y-3">
              <div><Label>الاسم الكامل</Label><Input required value={form.fullNameAr} onChange={(e) => setForm({ ...form, fullNameAr: e.target.value })} /></div>
              <div><Label>الوظيفة</Label><Input required value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>الهاتف</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                <div><Label>الرقم الوطني</Label><Input value={form.nationalId} onChange={(e) => setForm({ ...form, nationalId: e.target.value })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>الراتب الأساسي (×100)</Label><Input type="number" required value={form.baseSalaryMinor} onChange={(e) => setForm({ ...form, baseSalaryMinor: Number(e.target.value) })} /></div>
                <div><Label>تاريخ التعيين</Label><Input type="date" required value={form.hiredOn} onChange={(e) => setForm({ ...form, hiredOn: e.target.value })} /></div>
              </div>
              <div><Label>ملاحظات</Label><Textarea value={form.notesAr} onChange={(e) => setForm({ ...form, notesAr: e.target.value })} /></div>
              <DialogFooter><Button type="submit">حفظ</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>الاسم</TableHead><TableHead>الوظيفة</TableHead><TableHead>الهاتف</TableHead><TableHead>الراتب</TableHead><TableHead>تاريخ التعيين</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">{e.fullNameAr}</TableCell>
                  <TableCell>{e.role}</TableCell>
                  <TableCell className="ltr-numbers">{e.phone || "-"}</TableCell>
                  <TableCell>{formatSyp(e.baseSalaryMinor)}</TableCell>
                  <TableCell>{formatDate(e.hiredOn)}</TableCell>
                  <TableCell><Button variant="ghost" size="icon" onClick={() => openEdit(e)}><Pencil className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function SalariesTab() {
  const formatSyp = useFormatPrice();
  const month = new Date().toISOString().slice(0, 7);
  const [m, setM] = useState(month);
  const { data } = useListSalaries({ month: m });
  const pay = usePaySalary();
  const qc = useQueryClient();
  const { toast } = useToast();
  const handlePay = (s: any) => {
    pay.mutate({ data: { employeeId: s.employeeId, month: s.month, amount: s.totalAmountMinor, bonus: s.bonusMinor || 0, deduction: s.deductionMinor || 0 } }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListSalariesQueryKey() }); toast({ title: "تم الدفع" }); },
    });
  };
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>الرواتب</CardTitle>
          <Input type="month" value={m} onChange={(e) => setM(e.target.value)} className="w-44" />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>الشهر</TableHead><TableHead>الأساسي</TableHead><TableHead>المكافأة</TableHead><TableHead>الحسم</TableHead><TableHead>الإجمالي</TableHead><TableHead>الحالة</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.employeeNameAr}</TableCell>
                <TableCell>{s.month}</TableCell>
                <TableCell>{formatSyp(s.baseAmountMinor)}</TableCell>
                <TableCell>{formatSyp(s.bonusMinor)}</TableCell>
                <TableCell>{formatSyp(s.deductionMinor)}</TableCell>
                <TableCell className="font-medium">{formatSyp(s.totalAmountMinor)}</TableCell>
                <TableCell>{s.isPaid ? <Badge variant="secondary">مدفوع</Badge> : <Badge variant="outline">معلّق</Badge>}</TableCell>
                <TableCell>{!s.isPaid && <Button size="sm" onClick={() => handlePay(s)}>دفع</Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AttendanceTab() {
  const month = new Date().toISOString().slice(0, 7);
  const [m, setM] = useState(month);
  const { data: employees } = useListEmployees();
  const [selectedEmp, setSelectedEmp] = useState("");
  const effectiveEmp = selectedEmp || employees?.[0]?.id || "";
  const { data } = useListAttendance(
    effectiveEmp,
    { month: m },
    { query: { enabled: !!effectiveEmp } as Parameters<typeof useListAttendance>[2] extends { query?: infer Q } ? Q : never },
  );
  const create = useCreateAttendance();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [empId, setEmpId] = useState("");
  const [form, setForm] = useState({ date: new Date().toISOString().slice(0, 10), status: "present" as any, hoursWorked: 8, note: "" });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!empId) return;
    create.mutate({ id: empId, data: { ...form, hoursWorked: Number(form.hoursWorked) || undefined } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getListAttendanceQueryKey(empId, { month: m }) });
        setOpen(false);
        toast({ title: "تم التسجيل" });
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>الحضور</CardTitle>
          <div className="flex items-center gap-2">
            <Input type="month" value={m} onChange={(e) => setM(e.target.value)} className="w-44" />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="ml-2 h-4 w-4" />تسجيل</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>تسجيل حضور</DialogTitle></DialogHeader>
                <form onSubmit={submit} className="space-y-3">
                  <div><Label>الموظف</Label>
                    <Select value={empId} onValueChange={setEmpId}>
                      <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                      <SelectContent>{employees?.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullNameAr}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>التاريخ</Label><Input type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></div>
                  <div><Label>الحالة</Label>
                    <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="present">حاضر</SelectItem><SelectItem value="absent">غائب</SelectItem>
                        <SelectItem value="late">متأخر</SelectItem><SelectItem value="leave">إجازة</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>ساعات العمل</Label><Input type="number" value={form.hoursWorked} onChange={(e) => setForm({ ...form, hoursWorked: Number(e.target.value) })} /></div>
                  <DialogFooter><Button type="submit" disabled={!empId}>حفظ</Button></DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>الموظف</TableHead><TableHead>التاريخ</TableHead><TableHead>الحالة</TableHead><TableHead>ساعات</TableHead></TableRow></TableHeader>
          <TableBody>
            {data?.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{employees?.find((e) => e.id === a.employeeId)?.fullNameAr || a.employeeId}</TableCell>
                <TableCell>{formatDate(a.date)}</TableCell>
                <TableCell><Badge variant="outline">{a.status}</Badge></TableCell>
                <TableCell>{a.hoursWorked || "-"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AdminEmployeesPage() {
  return (
    <Tabs defaultValue="employees">
      <TabsList>
        <TabsTrigger value="employees">الموظفون</TabsTrigger>
        <TabsTrigger value="attendance">الحضور</TabsTrigger>
        <TabsTrigger value="salaries">الرواتب</TabsTrigger>
      </TabsList>
      <TabsContent value="employees"><EmployeesTab /></TabsContent>
      <TabsContent value="attendance"><AttendanceTab /></TabsContent>
      <TabsContent value="salaries"><SalariesTab /></TabsContent>
    </Tabs>
  );
}
