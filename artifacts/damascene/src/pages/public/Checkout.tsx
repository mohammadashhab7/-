import { useState } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import {
  useGetCart,
  useCheckout,
  useGetSettings,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import { formatSyp } from "@/lib/format";

export default function CheckoutPage() {
  const { data: cart } = useGetCart();
  const { data: settings } = useGetSettings();
  const { user } = useUser();
  const checkout = useCheckout();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [name, setName] = useState(user?.fullName || "");
  const [phone, setPhone] = useState(user?.primaryPhoneNumber?.phoneNumber || "");
  const [email, setEmail] = useState(user?.primaryEmailAddress?.emailAddress || "");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  type PaymentMethod = "cod" | "stripe" | "paypal" | "bank_transfer";
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");

  if (!cart || cart.items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-xl text-foreground/70">سلتك فارغة</p>
        <Button className="mt-4" onClick={() => navigate("/shop")}>تسوق الآن</Button>
      </div>
    );
  }

  const deliveryFee = Number(settings?.deliveryFeeMinor || 0);
  const total = cart.subtotalMinor + deliveryFee;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    checkout.mutate(
      {
        data: {
          customerName: name,
          customerPhone: phone,
          customerEmail: email || undefined,
          deliveryAddress: address,
          deliveryNotes: notes || undefined,
          paymentMethod,
        },
      },
      {
        onSuccess: (order) => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: "تم استلام طلبك", description: order.orderNumber });
          navigate(`/order/${order.orderNumber}`);
        },
        onError: () => toast({ title: "تعذّر إتمام الطلب", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <h1 className="font-serif text-3xl text-primary mb-8">إتمام الطلب</h1>
      <form onSubmit={handleSubmit} className="grid md:grid-cols-[2fr_1fr] gap-8">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle>معلومات التواصل</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="name">الاسم الكامل *</Label>
                <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="phone">رقم الهاتف *</Label>
                  <Input id="phone" required value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
                </div>
                <div>
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>عنوان التوصيل</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="address">العنوان *</Label>
                <Textarea id="address" required value={address} onChange={(e) => setAddress(e.target.value)} placeholder="الحي، الشارع، رقم البناء، الطابق" data-testid="input-address" />
              </div>
              <div>
                <Label htmlFor="notes">ملاحظات للسائق</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-notes" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>طريقة الدفع</CardTitle></CardHeader>
            <CardContent>
              <RadioGroup
                value={paymentMethod}
                onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}
                className="space-y-3"
              >
                <label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="cod" data-testid="radio-cod" />
                  <span>الدفع عند الاستلام</span>
                </label>
                <label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="stripe" data-testid="radio-stripe" />
                  <span className="flex-1">
                    بطاقة ائتمان عبر Stripe
                    <span className="block text-xs text-foreground/60 mt-0.5">سيتم تسجيل الطلب كـ "بانتظار الدفع" — البوابة غير مفعّلة حالياً</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="paypal" data-testid="radio-paypal" />
                  <span className="flex-1">
                    PayPal
                    <span className="block text-xs text-foreground/60 mt-0.5">سيتم تسجيل الطلب كـ "بانتظار الدفع" — البوابة غير مفعّلة حالياً</span>
                  </span>
                </label>
                <label className="flex items-center gap-3 border rounded-md p-3 cursor-pointer hover:bg-accent">
                  <RadioGroupItem value="bank_transfer" data-testid="radio-bank-transfer" />
                  <span className="flex-1">
                    حوالة مصرفية
                    <span className="block text-xs text-foreground/60 mt-0.5">سيتم التواصل معكم لتأكيد الحوالة قبل التحضير</span>
                  </span>
                </label>
              </RadioGroup>
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit sticky top-24">
          <CardHeader><CardTitle>ملخص الطلب</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3 max-h-64 overflow-auto">
              {cart.items.map((it) => (
                <div key={it.id} className="flex gap-3">
                  {it.productImageUrl && (
                    <img src={imgSrc(it.productImageUrl)} alt="" className="w-12 h-12 object-cover rounded" />
                  )}
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{it.productNameAr}</div>
                    <div className="text-foreground/60">×{it.quantity}</div>
                  </div>
                  <div className="text-sm font-medium">{formatSyp(it.lineTotalMinor)}</div>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between text-sm">
              <span>المجموع الفرعي</span>
              <span data-testid="text-subtotal">{formatSyp(cart.subtotalMinor)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>رسوم التوصيل</span>
              <span>{formatSyp(deliveryFee)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-medium">
              <span>الإجمالي</span>
              <span data-testid="text-total">{formatSyp(total)}</span>
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={checkout.isPending} data-testid="button-place-order">
              {checkout.isPending ? "جاري الإرسال..." : "تأكيد الطلب"}
            </Button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
