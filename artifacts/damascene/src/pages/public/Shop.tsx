import React, { useState } from "react";
import { Link, useSearch } from "wouter";
import { useListPublicProducts, useListPublicCategories, useAddCartItem, getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ShoppingBag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { imgSrc } from "@/lib/imgSrc";
import { useCurrencySymbol } from "@/lib/format";

export default function ShopPage() {
  const currencySymbol = useCurrencySymbol();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(searchString);
  const activeCategoryId = searchParams.get("category") || undefined;

  const { data: categories, isLoading: isLoadingCategories } = useListPublicCategories();
  const { data: products, isLoading: isLoadingProducts } = useListPublicProducts({ categoryId: activeCategoryId });
  
  const addToCart = useAddCartItem();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleAddToCart = (e: React.MouseEvent, productId: string, productName: string) => {
    e.preventDefault(); // Prevent link navigation
    e.stopPropagation();
    
    addToCart.mutate(
      { data: { productId, quantity: 1 } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          toast({
            title: "تمت الإضافة للسلة",
            description: `تم إضافة ${productName} بنجاح.`,
          });
        },
      }
    );
  };

  return (
    <div className="w-full bg-background pt-8 pb-24">
      <div className="container mx-auto px-4 sm:px-8">
        
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-serif font-bold text-foreground mb-4">المتجر</h1>
          <p className="text-muted-foreground max-w-2xl">
            تصفح تشكيلتنا الكاملة من الحلويات الدمشقية الفاخرة. جميع منتجاتنا تحضر طازجة يومياً باستخدام أجود المكونات.
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Sidebar / Filters */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="sticky top-28 border border-border/50 rounded-lg bg-card p-6">
              <h3 className="font-bold text-lg mb-6 text-foreground">التصنيفات</h3>
              
              {isLoadingCategories ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-6 bg-muted rounded w-full animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link 
                    href="/shop"
                    className={`px-3 py-2 rounded-md text-sm transition-colors ${
                      !activeCategoryId 
                        ? "bg-primary text-primary-foreground font-medium" 
                        : "hover:bg-muted text-foreground/80 hover:text-foreground"
                    }`}
                  >
                    الكل
                  </Link>
                  {categories?.map(category => (
                    <Link 
                      key={category.id}
                      href={`/shop?category=${category.slug}`}
                      className={`px-3 py-2 rounded-md text-sm transition-colors ${
                        activeCategoryId === category.slug 
                          ? "bg-primary text-primary-foreground font-medium" 
                          : "hover:bg-muted text-foreground/80 hover:text-foreground"
                      }`}
                    >
                      {category.nameAr}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1">
            {isLoadingProducts ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="bg-card border border-border/40 rounded-lg h-80 animate-pulse" />
                ))}
              </div>
            ) : !products || products.length === 0 ? (
              <div className="text-center py-24 border border-dashed border-border rounded-lg bg-card/50">
                <p className="text-lg text-muted-foreground">لا توجد منتجات في هذا التصنيف حالياً.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {products.map(product => (
                  <Link key={product.id} href={`/product/${product.slug}`}>
                    <Card className="h-full overflow-hidden border-border/40 hover:border-primary/30 transition-all duration-300 hover:shadow-lg bg-card group flex flex-col cursor-pointer">
                      <div className="aspect-[4/3] relative overflow-hidden bg-muted">
                        {product.imageUrl && (
                          <img 
                            src={imgSrc(product.imageUrl)} 
                            alt={product.nameAr} 
                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                          />
                        )}
                        {!product.inStock && (
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                            <span className="bg-destructive text-destructive-foreground px-3 py-1 rounded font-bold text-sm">نفدت الكمية</span>
                          </div>
                        )}
                      </div>
                      <CardContent className="p-5 flex-1 flex flex-col">
                        <span className="text-xs font-medium text-muted-foreground mb-1 block">{product.categoryNameAr}</span>
                        <h3 className="text-lg font-bold font-serif mb-2 text-foreground group-hover:text-primary transition-colors line-clamp-2">{product.nameAr}</h3>
                        
                        <div className="mt-auto pt-4 flex items-center justify-between">
                          <div className="text-primary font-medium" dir="ltr">
                            <span>{new Intl.NumberFormat("en-US").format(product.priceMinor)}</span>
                            <span className="ml-1 text-sm">{currencySymbol}</span>
                            <span className="text-muted-foreground font-normal text-xs ml-1">/ {product.unit}</span>
                          </div>
                          
                          <Button 
                            size="icon" 
                            variant="secondary" 
                            className="rounded-full h-10 w-10 shrink-0 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-50"
                            onClick={(e) => handleAddToCart(e, product.id, product.nameAr)}
                            disabled={!product.inStock || addToCart.isPending}
                            data-testid={`button-add-to-cart-${product.id}`}
                          >
                            <ShoppingBag className="h-5 w-5" />
                            <span className="sr-only">إضافة للسلة</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
