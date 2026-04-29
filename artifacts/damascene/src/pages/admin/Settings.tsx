import { useEffect, useRef, useState } from "react";
import { useGetSettings, useUpdateSettings, getGetSettingsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import MediaPicker from "@/components/admin/MediaPicker";

type SettingsForm = Record<string, unknown>;

interface FieldProps {
  k: string;
  label: string;
  type?: "text" | "number" | "email" | "tel" | "url";
  textarea?: boolean;
  form: SettingsForm;
  onChange: (k: string, v: unknown) => void;
}

function Field({ k, label, type = "text", textarea = false, form, onChange }: FieldProps) {
  const raw = form[k];
  const stringValue =
    raw === null || raw === undefined ? "" : String(raw);

  if (textarea) {
    return (
      <div>
        <Label htmlFor={`field-${k}`}>{label}</Label>
        <Textarea
          id={`field-${k}`}
          value={stringValue}
          onChange={(e) => onChange(k, e.target.value)}
          data-testid={`input-${k}`}
        />
      </div>
    );
  }

  return (
    <div>
      <Label htmlFor={`field-${k}`}>{label}</Label>
      <Input
        id={`field-${k}`}
        type={type}
        value={stringValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(k, type === "number" ? (v === "" ? "" : Number(v)) : v);
        }}
        data-testid={`input-${k}`}
      />
    </div>
  );
}

export default function AdminSettingsPage() {
  const { data: settings } = useGetSettings();
  const update = useUpdateSettings();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<SettingsForm>({});
  const dirtyRef = useRef(false);

  // Hydrate form from server only when the user has not started editing.
  // This prevents background refetches (refetchOnWindowFocus, etc.) from
  // wiping in-progress edits.
  useEffect(() => {
    if (settings && !dirtyRef.current) {
      setForm(settings as unknown as SettingsForm);
    }
  }, [settings]);

  const updateField = (k: string, v: unknown) => {
    dirtyRef.current = true;
    setForm((f) => ({ ...f, [k]: v }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // Coerce empty number fields back to 0 so the API doesn't choke on "".
    const payload: SettingsForm = { ...form };
    for (const numKey of [
      "taxPercent",
      "deliveryFeeMinor",
      "freeDeliveryThresholdMinor",
    ]) {
      if (payload[numKey] === "" || payload[numKey] === undefined) {
        payload[numKey] = 0;
      }
    }
    update.mutate(
      { data: payload as Parameters<typeof update.mutate>[0]["data"] },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetSettingsQueryKey() });
          toast({ title: "تم الحفظ" });
        },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      },
    );
  };

  if (!settings) return <p>جاري التحميل...</p>;

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>المتجر</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field k="storeNameAr" label="اسم المتجر بالعربية" form={form} onChange={updateField} />
          <Field k="storeNameEn" label="Store Name (English)" form={form} onChange={updateField} />
          <div className="sm:col-span-2">
            <Field k="taglineAr" label="الشعار" form={form} onChange={updateField} />
          </div>
          <div className="sm:col-span-2">
            <Field k="addressAr" label="العنوان" textarea form={form} onChange={updateField} />
          </div>
          <Field k="phone" label="الهاتف" type="tel" form={form} onChange={updateField} />
          <Field k="email" label="البريد الإلكتروني" type="email" form={form} onChange={updateField} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>الأموال والتوصيل</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field k="currencySymbol" label="رمز العملة (مثال: ل.س, $, €)" form={form} onChange={updateField} />
          <Field k="taxPercent" label="نسبة الضريبة %" type="number" form={form} onChange={updateField} />
          <Field k="deliveryFeeMinor" label="رسوم التوصيل (×100)" type="number" form={form} onChange={updateField} />
          <Field k="freeDeliveryThresholdMinor" label="حد التوصيل المجاني (×100)" type="number" form={form} onChange={updateField} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>روابط التواصل</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-3">
          <Field k="instagramUrl" label="إنستغرام" type="url" form={form} onChange={updateField} />
          <Field k="facebookUrl" label="فيسبوك" type="url" form={form} onChange={updateField} />
          <Field k="whatsappNumber" label="واتساب" type="tel" form={form} onChange={updateField} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>شعار المتجر</CardTitle>
        </CardHeader>
        <CardContent>
          <MediaPicker
            label="صورة الشعار"
            value={(form.logoUrl as string | undefined) ?? ""}
            onChange={(url) => updateField("logoUrl", url)}
            kind="image"
            helperText="تُستخدم في المراسلات والفواتير وواجهة المتجر"
            testId="media-picker-logo"
          />
        </CardContent>
      </Card>

      <Button type="submit" disabled={update.isPending}>
        حفظ الإعدادات
      </Button>
    </form>
  );
}
