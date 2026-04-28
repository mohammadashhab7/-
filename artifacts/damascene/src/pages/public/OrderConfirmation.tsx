import { Link } from "wouter";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OrderConfirmationPage({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="container mx-auto px-4 py-20 max-w-2xl text-center">
      <Card>
        <CardContent className="p-12">
          <CheckCircle2 className="h-20 w-20 text-primary mx-auto mb-6" />
          <h1 className="font-serif text-3xl text-primary mb-4">شكرًا لك!</h1>
          <p className="text-foreground/70 mb-2">تم استلام طلبك بنجاح</p>
          <p className="text-foreground/80 text-lg mb-8">
            رقم الطلب: <span className="font-mono font-medium" data-testid="text-order-number">{orderNumber}</span>
          </p>
          <p className="text-foreground/60 mb-8 text-sm leading-loose">
            سنتواصل معكم قريبًا لتأكيد الطلب وموعد التوصيل.
            يمكنكم متابعة حالة طلبكم من خلال حسابكم.
          </p>
          <div className="flex gap-3 justify-center">
            <Link href="/account/orders"><Button variant="outline">طلباتي</Button></Link>
            <Link href="/shop"><Button>متابعة التسوق</Button></Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
