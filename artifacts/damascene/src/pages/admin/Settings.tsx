import { useEffect, useState } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

export default function AdminSettingsPage() {
  const { data: settings } = useGetSettings();
  const update = useUpdateSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});

  useEffect(() => { if (settings) setForm(settings); }, [settings]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    update.mutate({ data: form }, {
      onSuccess: () => { qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() }); toast({ title: "تم الحفظ" }); },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  if (!settings) return <p>جاري التحميل...</p>;

  const F = ({ k, label, type = "text", textarea = false }: any) => (
    <div>
      <Label>{label}</Label>
      {textarea ? (
        <Textarea value={form[k] || ""} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
      ) : (
        <Input type={type} value={form[k] ?? ""} onChange={(e) => setForm({ ...form, [k]: type === "number" ? Number(e.target.value) : e.target.value })} />
      )}
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader><CardTitle>المتجر</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <F k="storeNameAr" label="اسم المتجر بالعربية" />
          <F k="storeNameEn" label="Store Name (English)" />
          <div className="sm:col-span-2"><F k="taglineAr" label="الشعار" /></div>
          <div className="sm:col-span-2"><F k="addressAr" label="العنوان" textarea /></div>
          <F k="phone" label="الهاتف" />
          <F k="email" label="البريد الإلكتروني" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>الأموال والتوصيل</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <F k="currency" label="العملة" />
          <F k="currencySymbol" label="رمز العملة" />
          <F k="taxPercent" label="نسبة الضريبة %" type="number" />
          <F k="deliveryFeeMinor" label="رسوم التوصيل (×100)" type="number" />
          <F k="freeDeliveryThresholdMinor" label="حد التوصيل المجاني (×100)" type="number" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>روابط التواصل</CardTitle></CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <F k="instagramUrl" label="إنستغرام" />
          <F k="facebookUrl" label="فيسبوك" />
          <F k="whatsappNumber" label="واتساب" />
        </CardContent>
      </Card>
      <Button type="submit" disabled={update.isPending}>حفظ الإعدادات</Button>
    </form>
  );
}
