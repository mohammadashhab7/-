import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { ShoppingBag, User as UserIcon, LogOut, Menu } from "lucide-react";
import { useGetCart, useGetSettings } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import CartDrawer from "@/components/cart/CartDrawer";

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const { data: cart } = useGetCart();
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const cartItemCount = cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;

  const NavLinks = () => (
    <>
      <Link href="/" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/" ? "text-primary" : "text-foreground/80"}`} data-testid="link-home">
        الرئيسية
      </Link>
      <Link href="/shop" className={`text-sm font-medium transition-colors hover:text-primary ${location.startsWith("/shop") ? "text-primary" : "text-foreground/80"}`} data-testid="link-shop">
        المتجر
      </Link>
      <Link href="/story" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/story" ? "text-primary" : "text-foreground/80"}`} data-testid="link-story">
        قصتنا
      </Link>
      <Link href="/contact" className={`text-sm font-medium transition-colors hover:text-primary ${location === "/contact" ? "text-primary" : "text-foreground/80"}`} data-testid="link-contact">
        اتصل بنا
      </Link>
    </>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-8">
          <div className="flex items-center gap-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden" data-testid="button-mobile-menu">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">القائمة</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                <nav className="flex flex-col gap-4 mt-8">
                  <NavLinks />
                </nav>
              </SheetContent>
            </Sheet>
            <Link href="/" className="flex items-center gap-2" data-testid="link-logo">
              <span className="font-serif text-2xl font-bold tracking-tight text-primary">
                {settings?.storeNameAr || "الدمشقي"}
              </span>
            </Link>
            <nav className="hidden md:flex items-center gap-8 mr-8">
              <NavLinks />
            </nav>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2" data-testid="button-user-menu">
                    <UserIcon className="h-4 w-4" />
                    <span className="hidden sm:inline-block text-sm">{user?.firstName || "حسابي"}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account" className="cursor-pointer w-full" data-testid="link-account">
                      الطلبات السابقة
                    </Link>
                  </DropdownMenuItem>
                  {user?.publicMetadata?.role && user.publicMetadata.role !== "customer" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="cursor-pointer w-full text-primary" data-testid="link-admin">
                        لوحة التحكم
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer" data-testid="button-sign-out">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex" data-testid="link-sign-in">
                <Link href="/sign-in">تسجيل الدخول</Link>
              </Button>
            )}

            <CartDrawer>
              <Button variant="outline" size="icon" className="relative border-primary/20 hover:bg-primary/5" data-testid="button-cart">
                <ShoppingBag className="h-5 w-5 text-primary" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {cartItemCount}
                  </span>
                )}
                <span className="sr-only">السلة</span>
              </Button>
            </CartDrawer>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full">
        {children}
      </main>

      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 sm:px-8 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="inline-block mb-4">
                <span className="font-serif text-2xl font-bold tracking-tight text-primary">
                  {settings?.storeNameAr || "الدمشقي"}
                </span>
              </Link>
              <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                {settings?.taglineAr || "صناع الحلويات الدمشقية العريقة. إرث يمتد لأجيال في تقديم أرقى أنواع البقلاوة والمعمول والحلويات الشرقية الفاخرة."}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">روابط سريعة</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link href="/shop" className="hover:text-primary transition-colors">المتجر</Link></li>
                <li><Link href="/story" className="hover:text-primary transition-colors">قصتنا</Link></li>
                <li><Link href="/contact" className="hover:text-primary transition-colors">اتصل بنا</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">تواصل معنا</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {settings?.addressAr && <li>{settings.addressAr}</li>}
                {settings?.phone && <li dir="ltr" className="text-right">{settings.phone}</li>}
                {settings?.email && <li>{settings.email}</li>}
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
            <p>© {new Date().getFullYear()} {settings?.storeNameAr || "الدمشقي"}. جميع الحقوق محفوظة.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
