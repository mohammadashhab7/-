import { MapPin, Phone, Mail, Clock } from "lucide-react";
import { useGetSettings } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";

export default function ContactPage() {
  const { data: settings } = useGetSettings();
  return (
    <div className="container mx-auto max-w-5xl px-4 py-16">
      <header className="text-center mb-12">
        <h1 className="font-serif text-4xl md:text-5xl text-primary mb-4">اتصل بنا</h1>
        <p className="text-foreground/70 text-lg">نسعد دائمًا بالتواصل معكم</p>
      </header>
      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">العنوان</div>
                <div className="text-foreground/70">{settings?.addressAr || "دمشق، سوريا"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">الهاتف</div>
                <div className="text-foreground/70 ltr-numbers">{settings?.phone || "—"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">البريد الإلكتروني</div>
                <div className="text-foreground/70">{settings?.email || "—"}</div>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-primary mt-1" />
              <div>
                <div className="font-medium">ساعات العمل</div>
                <div className="text-foreground/70">{settings?.openingHoursAr || "السبت — الخميس: 9 صباحًا — 11 مساءً"}</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6">
            <h2 className="font-serif text-2xl text-primary mb-4">زورونا في المتجر</h2>
            <p className="text-foreground/70 leading-relaxed">
              يسعدنا استقبالكم في فروعنا للاستمتاع بتجربة طازجة من حلويات الدمشقي،
              المُحضّرة يوميًا بأيدي حرفيين مهرة وفق وصفات عائلية متوارثة.
            </p>
            <div className="mt-6 aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground">
              خريطة الموقع
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
