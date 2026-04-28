import React from "react";
import { Link } from "wouter";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import {
  useGetCart,
  useUpdateCartItem,
  useRemoveCartItem,
  useGetSettings,
} from "@workspace/api-client-react";
import { getGetCartQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { imgSrc } from "@/lib/imgSrc";

export default function CartDrawer({ children }: { children: React.ReactNode }) {
  const { data: cart, isLoading } = useGetCart();
  const { data: settings } = useGetSettings();
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const queryClient = useQueryClient();

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      handleRemoveItem(productId);
      return;
    }
    updateItem.mutate(
      { itemId: productId, data: { quantity } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        },
      }
    );
  };

  const handleRemoveItem = (productId: string) => {
    removeItem.mutate(
      { itemId: productId },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        },
      }
    );
  };

  const formatCurrency = (minor: number) => {
    return `${new Intl.NumberFormat("ar-SY").format(minor)} ${settings?.currencySymbol || "ل.س"}`;
  };

  return (
    <Sheet>
      <SheetTrigger asChild>{children}</SheetTrigger>
    <SheetContent side="left" className="w-full sm:max-w-md flex flex-col border-border/40 p-0">
      <SheetHeader className="px-6 py-4 border-b border-border/40 bg-card">
        <SheetTitle className="text-xl font-serif text-foreground">سلة المشتريات</SheetTitle>
      </SheetHeader>
      
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="p-6 flex justify-center items-center h-full">
            <span className="text-muted-foreground text-sm">جاري التحميل...</span>
          </div>
        ) : !cart?.items || cart.items.length === 0 ? (
          <div className="p-6 flex flex-col justify-center items-center h-full text-center gap-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <ShoppingBag className="h-8 w-8 text-muted-foreground opacity-50" />
            </div>
            <p className="text-muted-foreground">السلة فارغة حالياً</p>
            <SheetClose asChild>
              <Button variant="outline" className="mt-4" data-testid="button-continue-shopping">
                متابعة التسوق
              </Button>
            </SheetClose>
          </div>
        ) : (
          <ScrollArea className="h-full px-6">
            <div className="flex flex-col gap-6 py-6">
              {cart.items.map((item) => (
                <div key={item.id} className="flex gap-4" data-testid={`cart-item-${item.productId}`}>
                  {item.productImageUrl ? (
                    <div className="w-20 h-20 rounded-md overflow-hidden bg-muted shrink-0 border border-border/50">
                      <img 
                        src={imgSrc(item.productImageUrl)} 
                        alt={item.productNameAr} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center shrink-0 border border-border/50">
                      <ImageIcon className="h-6 w-6 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  <div className="flex flex-col justify-between flex-1">
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-medium text-sm line-clamp-2 leading-tight">{item.productNameAr}</h4>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-destructive -mr-2 -mt-1 shrink-0"
                        onClick={() => handleRemoveItem(item.productId)}
                        data-testid={`button-remove-${item.productId}`}
                      >
                        <X className="h-4 w-4" />
                        <span className="sr-only">إزالة</span>
                      </Button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      <div className="flex items-center border border-border rounded-md">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-none rounded-r-md text-foreground"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity + 1)}
                          disabled={updateItem.isPending}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-xs font-medium">{item.quantity}</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7 rounded-none rounded-l-md text-foreground"
                          onClick={() => handleUpdateQuantity(item.productId, item.quantity - 1)}
                          disabled={updateItem.isPending}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                      </div>
                      <span className="font-medium text-sm text-primary" dir="ltr">
                        {formatCurrency(item.lineTotalMinor)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      {cart && cart.items && cart.items.length > 0 && (
        <div className="px-6 py-6 border-t border-border/40 bg-card/50 backdrop-blur-sm mt-auto">
          <div className="flex justify-between items-center mb-6">
            <span className="text-foreground font-medium">المجموع</span>
            <span className="font-serif text-lg font-bold text-primary" dir="ltr">
              {formatCurrency(cart.subtotalMinor)}
            </span>
          </div>
          <SheetClose asChild>
            <Button asChild className="w-full text-base h-12" data-testid="button-checkout">
              <Link href="/checkout">إتمام الطلب</Link>
            </Button>
          </SheetClose>
        </div>
      )}
    </SheetContent>
    </Sheet>
  );
}

// Ensure icons used above are imported. Since they weren't in the initial import block:
import { ShoppingBag, Image as ImageIcon } from "lucide-react";
