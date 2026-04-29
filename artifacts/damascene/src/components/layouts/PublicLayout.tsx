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
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import CartDrawer from "@/components/cart/CartDrawer";

interface PublicLayoutProps {
  children: ReactNode;
}

interface NavItem {
  href: string;
  label: string;
  testId: string;
  matchPrefix?: boolean;
}

const RIGHT_NAV: NavItem[] = [
  { href: "/", label: "الرئيسية", testId: "link-home" },
  { href: "/shop", label: "المتجر", testId: "link-shop", matchPrefix: true },
];

const LEFT_NAV: NavItem[] = [
  { href: "/about", label: "قصتنا", testId: "link-story" },
  { href: "/contact", label: "اتصل بنا", testId: "link-contact" },
];

const ALL_NAV = [...RIGHT_NAV, ...LEFT_NAV];

export default function PublicLayout({ children }: PublicLayoutProps) {
  const [location] = useLocation();
  const { data: settings } = useGetSettings();
  const { data: cart } = useGetCart();
  const { user, isSignedIn } = useUser();
  const { signOut } = useClerk();

  const cartItemCount = cart?.items.reduce((acc, item) => acc + item.quantity, 0) || 0;
  const storeName = settings?.storeNameAr || "الدمشقي";

  const isActive = (item: NavItem) =>
    item.matchPrefix ? location.startsWith(item.href) : location === item.href;

  const renderNavLink = (item: NavItem) => (
    <Link
      key={item.href}
      href={item.href}
      className={`text-sm font-medium tracking-wide transition-colors hover:text-primary whitespace-nowrap ${
        isActive(item) ? "text-primary" : "text-foreground/80"
      }`}
      data-testid={item.testId}
    >
      {item.label}
    </Link>
  );

  return (
    <div className="min-h-screen flex flex-col bg-background font-sans text-foreground selection:bg-primary/20">
      <header
        className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/75"
        data-testid="header-public"
      >
        <div className="relative container mx-auto grid h-20 grid-cols-[auto_1fr_auto] items-center px-4 sm:px-6 lg:px-8">
          {/* Visual right edge in RTL = first child = Account/Login */}
          <div className="flex items-center gap-1 sm:gap-2 order-1">
            {isSignedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 px-2 sm:px-3"
                    data-testid="button-user-menu"
                  >
                    <UserIcon className="h-4 w-4" />
                    <span className="hidden sm:inline-block text-sm">
                      {user?.firstName || "حسابي"}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>حسابي</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link
                      href="/account"
                      className="cursor-pointer w-full"
                      data-testid="link-account"
                    >
                      الطلبات السابقة
                    </Link>
                  </DropdownMenuItem>
                  {(() => {
                    const role = user?.publicMetadata?.role;
                    return typeof role === "string" && role !== "customer" ? (
                      <DropdownMenuItem asChild>
                        <Link
                          href="/admin"
                          className="cursor-pointer w-full text-primary"
                          data-testid="link-admin"
                        >
                          لوحة التحكم
                        </Link>
                      </DropdownMenuItem>
                    ) : null;
                  })()}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => signOut()}
                    className="text-destructive focus:text-destructive cursor-pointer"
                    data-testid="button-sign-out"
                  >
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden sm:inline-flex"
                data-testid="link-sign-in"
              >
                <Link href="/sign-in">تسجيل الدخول</Link>
              </Button>
            )}
          </div>

          <div className="hidden lg:flex items-center justify-between gap-8 xl:gap-12 order-2 mx-auto w-full max-w-[720px]" aria-hidden>
            <nav
              className="flex items-center justify-center gap-7 xl:gap-9"
              data-testid="nav-left"
            >
              {LEFT_NAV.map(renderNavLink)}
            </nav>
            <nav
              className="flex items-center justify-center gap-7 xl:gap-9"
              data-testid="nav-right"
            >
              {RIGHT_NAV.map(renderNavLink)}
            </nav>
          </div>

          {/* Mobile menu trigger sits inline before cart on small screens */}
          <div className="flex items-center gap-1 sm:gap-2 justify-self-end lg:hidden order-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  data-testid="button-mobile-menu"
                >
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">القائمة</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[300px] sm:w-[380px]">
                <SheetTitle className="sr-only">القائمة</SheetTitle>
                <nav className="flex flex-col gap-5 mt-10">
                  {ALL_NAV.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`text-base font-medium transition-colors hover:text-primary ${
                        isActive(item) ? "text-primary" : "text-foreground/85"
                      }`}
                      data-testid={`${item.testId}-mobile`}
                    >
                      {item.label}
                    </Link>
                  ))}
                  {!isSignedIn && (
                    <Link
                      href="/sign-in"
                      className="text-base font-medium text-primary mt-2"
                      data-testid="link-sign-in-mobile"
                    >
                      تسجيل الدخول
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>
          </div>

          {/* Visual left edge in RTL = last child = Cart */}
          <div className="hidden lg:flex items-center justify-self-end order-4">
            <CartDrawer>
              <Button
                variant="outline"
                size="icon"
                className="relative border-primary/20 hover:bg-primary/5"
                data-testid="button-cart"
              >
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

          {/* Centered, slightly protruding logo */}
          <Link
            href="/"
            className="absolute left-1/2 top-1/2 -translate-x-1/2 translate-y-1 sm:translate-y-2 z-10 group"
            data-testid="link-logo"
          >
            <div className="flex flex-col items-center">
              <div className="relative px-5 sm:px-8 py-2 sm:py-3 rounded-full bg-background shadow-[0_8px_24px_-8px_rgba(0,0,0,0.18)] border border-primary/15 group-hover:border-primary/40 group-hover:shadow-[0_12px_28px_-8px_rgba(0,0,0,0.22)] transition-all duration-300">
                <span className="font-serif text-2xl sm:text-3xl lg:text-[2rem] font-bold tracking-tight text-primary leading-none">
                  {storeName}
                </span>
              </div>
              <span className="hidden sm:block text-[10px] tracking-[0.35em] uppercase text-muted-foreground/70 mt-1">
                Damascene
              </span>
            </div>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col w-full">{children}</main>

      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 sm:px-8 py-12 md:py-16">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-2">
              <Link href="/" className="inline-block mb-4">
                <span className="font-serif text-2xl font-bold tracking-tight text-primary">
                  {storeName}
                </span>
              </Link>
              <p className="text-muted-foreground text-sm max-w-md leading-relaxed">
                {settings?.taglineAr ||
                  "صناع الحلويات الدمشقية العريقة. إرث يمتد لأجيال في تقديم أرقى أنواع البقلاوة والمعمول والحلويات الشرقية الفاخرة."}
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">روابط سريعة</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li>
                  <Link href="/shop" className="hover:text-primary transition-colors">
                    المتجر
                  </Link>
                </li>
                <li>
                  <Link href="/about" className="hover:text-primary transition-colors">
                    قصتنا
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="hover:text-primary transition-colors">
                    اتصل بنا
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-4 text-foreground">تواصل معنا</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {settings?.addressAr && <li>{settings.addressAr}</li>}
                {settings?.phone && (
                  <li dir="ltr" className="text-right">
                    {settings.phone}
                  </li>
                )}
                {settings?.email && <li>{settings.email}</li>}
              </ul>
            </div>
          </div>
          <div className="border-t border-border mt-12 pt-8 text-center text-sm text-muted-foreground flex flex-col md:flex-row justify-between items-center gap-4">
            <p>
              © {new Date().getFullYear()} {storeName}. جميع الحقوق محفوظة.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
