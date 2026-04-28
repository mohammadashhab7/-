import { useState } from "react";
import { Link } from "wouter";
import { Minus, Plus, ShoppingBag, ArrowRight } from "lucide-react";
import {
  useGetPublicProduct,
  useAddCartItem,
  getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import { formatSyp } from "@/lib/format";

export default function ProductDetailPage({ slug }: { slug: string }) {
  const { data: product, isLoading } = useGetPublicProduct(slug);
  const [qty, setQty] = useState(1);
  const [activeImg, setActiveImg] = useState(0);
  const addItem = useAddCartItem();
  const qc = useQueryClient();
  const { toast } = useToast();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12 grid md:grid-cols-2 gap-10">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }
  if (!product) {
    return (
      <div className="container mx-auto px-4 py-20 text-center">
        <p className="text-xl text-foreground/70">المنتج غير موجود</p>
        <Link href="/shop" className="inline-block mt-4 text-primary underline">
          العودة إلى المتجر
        </Link>
      </div>
    );
  }

  const images = [product.imageUrl, ...(product.galleryUrls || [])].filter(Boolean) as string[];
  const heroImg = images[activeImg] || images[0];

  const handleAdd = () => {
    addItem.mutate(
      { data: { productId: product.id, quantity: qty } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({ title: "أُضيف إلى السلة", description: product.nameAr });
        },
        onError: () => toast({ title: "تعذّر الإضافة", variant: "destructive" }),
      },
    );
  };

  return (
    <div className="container mx-auto px-4 py-12">
      <nav className="mb-6 text-sm text-foreground/60 flex items-center gap-2">
        <Link href="/" className="hover:text-primary">الرئيسية</Link>
        <ArrowRight className="h-3 w-3 rotate-180" />
        <Link href="/shop" className="hover:text-primary">المتجر</Link>
        <ArrowRight className="h-3 w-3 rotate-180" />
        <span className="text-foreground/80">{product.nameAr}</span>
      </nav>
      <div className="grid md:grid-cols-2 gap-10">
        <div>
          <div className="aspect-square overflow-hidden rounded-2xl bg-muted">
            {heroImg ? (
              <img src={imgSrc(heroImg)} alt={product.nameAr} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">لا توجد صورة</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden rounded-lg border-2 ${i === activeImg ? "border-primary" : "border-transparent"}`}
                >
                  <img src={imgSrc(img)} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-6">
          {product.categoryNameAr && (
            <Badge variant="secondary">{product.categoryNameAr}</Badge>
          )}
          <h1 className="font-serif text-3xl md:text-4xl text-primary">{product.nameAr}</h1>
          <div className="text-3xl font-medium" data-testid="text-product-price">
            {formatSyp(product.priceMinor)}
            <span className="text-sm text-foreground/50 mr-2">/ {product.unit === "kg" ? "كغ" : product.unit === "piece" ? "قطعة" : product.unit}</span>
          </div>
          {product.descriptionAr && (
            <p className="text-foreground/80 leading-loose whitespace-pre-line">{product.descriptionAr}</p>
          )}
          <div className="flex items-center gap-4 pt-4">
            <div className="inline-flex items-center border rounded-md">
              <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))} data-testid="button-qty-dec">
                <Minus className="h-4 w-4" />
              </Button>
              <div className="w-12 text-center font-medium" data-testid="text-qty">{qty}</div>
              <Button variant="ghost" size="icon" onClick={() => setQty(qty + 1)} data-testid="button-qty-inc">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={handleAdd} disabled={addItem.isPending} size="lg" data-testid="button-add-to-cart">
              <ShoppingBag className="ml-2 h-4 w-4" />
              أضف إلى السلة
            </Button>
          </div>
          {product.inStock === false && (
            <p className="text-destructive text-sm">المنتج غير متوفر حاليًا</p>
          )}
        </div>
      </div>
    </div>
  );
}
