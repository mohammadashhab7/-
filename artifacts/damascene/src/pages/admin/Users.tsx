import { useListAdminUsers, useUpdateAdminUser, getListAdminUsersQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/format";

const ROLES = [
  { value: "owner", label: "مالك" },
  { value: "admin", label: "مدير" },
  { value: "cashier", label: "كاشير" },
  { value: "production", label: "إنتاج" },
  { value: "customer", label: "عميل" },
];

export default function AdminUsersPage() {
  const { data, isLoading } = useListAdminUsers();
  const update = useUpdateAdminUser();
  const qc = useQueryClient();
  const { toast } = useToast();

  const onChange = (id: string, payload: any) => {
    update.mutate({ id, data: payload }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getListAdminUsersQueryKey() }); toast({ title: "تم التحديث" }); },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  return (
    <Card>
      <CardHeader><CardTitle>المستخدمون والأدوار</CardTitle></CardHeader>
      <CardContent>
        {isLoading ? <p>جاري التحميل...</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>المستخدم</TableHead><TableHead>البريد</TableHead><TableHead>الدور</TableHead><TableHead>نشط</TableHead><TableHead>منذ</TableHead></TableRow></TableHeader>
            <TableBody>
              {data?.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={u.imageUrl} />
                        <AvatarFallback>{(u.name || u.email)[0]?.toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{u.name || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{u.email}</TableCell>
                  <TableCell>
                    <Select value={u.role} onValueChange={(v) => onChange(u.id, { role: v })}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>{ROLES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Switch checked={u.isActive} onCheckedChange={(v) => onChange(u.id, { isActive: v })} /></TableCell>
                  <TableCell className="text-sm text-foreground/60">{formatDate(u.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
