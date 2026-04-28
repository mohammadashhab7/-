import { Link, useLocation } from "wouter";
import { useGetCart } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ShoppingBag } from "lucide-react";

function formatSyp(minor: number): string {
  return new Intl.NumberFormat("ar-SY").format(minor) + " ل.س";
}

export default function CartPage() {
  const { data: cart, isLoading } = useGetCart();
  const [, navigate] = useLocation();

  if (isLoading) {
    return (
      <div className="container mx-auto py-16 flex justify-center">
        <Spinner />
      </div>
    );
  }

  const items = cart?.items ?? [];
  const isEmpty = items.length === 0;

  return (
    <div className="container mx-auto px-4 sm:px-8 py-12" dir="rtl" data-testid="page-cart">
      <h1 className="font-serif text-3xl font-bold text-primary mb-8">سلة التسوق</h1>

      {isEmpty ? (
        <Card className="border-primary/20">
          <CardContent className="pt-10 pb-10 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <ShoppingBag className="h-7 w-7 text-primary" />
            </div>
            <h2 className="font-serif text-xl font-semibold mb-2">سلتك فارغة</h2>
            <p className="text-sm text-muted-foreground mb-6">
              لم تقم بإضافة أي منتجات حتى الآن. تصفح المتجر واختر ما يعجبك.
            </p>
            <Button asChild data-testid="link-cart-shop">
              <Link href="/shop">تصفح المتجر</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-3">
            {items.map((item) => (
              <Card key={item.productId} data-testid={`row-cart-item-${item.productId}`}>
                <CardContent className="py-4 flex items-center gap-4">
                  {item.productImageUrl ? (
                    <img
                      src={item.productImageUrl}
                      alt={item.productNameAr}
                      className="h-16 w-16 rounded-md object-cover border border-border"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-md bg-muted" />
                  )}
                  <div className="flex-1">
                    <div className="font-medium">{item.productNameAr}</div>
                    <div className="text-xs text-muted-foreground">
                      الكمية: {item.quantity}
                    </div>
                  </div>
                  <div className="font-semibold text-primary">
                    {formatSyp(item.lineTotalMinor)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-primary/20 h-fit">
            <CardContent className="pt-6 space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الإجمالي الفرعي</span>
                <span className="font-semibold">{formatSyp(cart!.subtotalMinor)}</span>
              </div>
              <Button
                className="w-full"
                onClick={() => navigate("/checkout")}
                data-testid="button-cart-checkout"
              >
                إتمام الشراء
              </Button>
              <Button
                variant="outline"
                className="w-full"
                asChild
                data-testid="link-cart-continue"
              >
                <Link href="/shop">متابعة التسوق</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
