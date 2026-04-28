import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-[60vh] w-full flex items-center justify-center bg-background p-6"
      dir="rtl"
      data-testid="page-not-found"
    >
      <Card className="w-full max-w-md mx-4 border-primary/20">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Compass className="h-7 w-7 text-primary" />
          </div>
          <h1 className="font-serif text-3xl font-bold text-primary mb-2">
            الصفحة غير موجودة
          </h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            الصفحة التي تحاول الوصول إليها غير متوفرة أو تم نقلها. يمكنك العودة
            إلى الصفحة الرئيسية أو تصفح المتجر.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild data-testid="link-go-home">
              <Link href="/">
                <Home className="ml-2 h-4 w-4" />
                الصفحة الرئيسية
              </Link>
            </Button>
            <Button variant="outline" asChild data-testid="link-go-shop">
              <Link href="/shop">تصفح المتجر</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
