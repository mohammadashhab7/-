import { Link } from "wouter";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 text-center">
      <ShieldAlert className="h-16 w-16 text-destructive mb-4" />
      <h1 className="font-serif text-3xl text-primary mb-2">غير مصرح</h1>
      <p className="text-foreground/70 max-w-md mb-6">
        لا تملك صلاحية الوصول إلى هذه الصفحة. إذا كنت تعتقد أن هذا خطأ، يرجى
        التواصل مع المسؤول.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/">العودة للرئيسية</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/account">حسابي</Link>
        </Button>
      </div>
    </div>
  );
}
