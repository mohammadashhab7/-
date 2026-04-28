import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { 
  LayoutDashboard, 
  Package, 
  Tags, 
  FlaskConical, 
  ChefHat, 
  Warehouse, 
  Factory, 
  ArrowRightLeft, 
  MonitorSmartphone, 
  ShoppingCart, 
  Wallet, 
  BarChart3, 
  Users, 
  ShieldCheck, 
  FileText, 
  Image as ImageIcon, 
  Settings,
  LogOut,
  Menu
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AdminLayoutProps {
  children: ReactNode;
}

const SIDEBAR_NAV = [
  { title: "الرئيسية", href: "/admin", icon: LayoutDashboard },
  { title: "نقطة البيع (POS)", href: "/admin/pos", icon: MonitorSmartphone },
  { title: "الطلبات", href: "/admin/orders", icon: ShoppingCart },
  { title: "المنتجات", href: "/admin/products", icon: Package },
  { title: "التصنيفات", href: "/admin/categories", icon: Tags },
  { title: "المواد الأولية", href: "/admin/raw-materials", icon: FlaskConical },
  { title: "الوصفات", href: "/admin/recipes", icon: ChefHat },
  { title: "المخزون", href: "/admin/inventory", icon: Warehouse },
  { title: "التصنيع", href: "/admin/production", icon: Factory },
  { title: "التحويلات", href: "/admin/transfers", icon: ArrowRightLeft },
  { title: "المالية", href: "/admin/financials", icon: Wallet },
  { title: "التقارير", href: "/admin/reports", icon: BarChart3 },
  { title: "الموظفين", href: "/admin/employees", icon: Users },
  { title: "المستخدمين", href: "/admin/users", icon: ShieldCheck },
  { title: "المحتوى (CMS)", href: "/admin/cms", icon: FileText },
  { title: "الوسائط", href: "/admin/media", icon: ImageIcon },
  { title: "الإعدادات", href: "/admin/settings", icon: Settings },
];

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();

  const isPos = location.startsWith("/admin/pos");

  const NavItems = () => (
    <nav className="flex flex-col gap-1 p-4">
      {SIDEBAR_NAV.map((item) => {
        const isActive = location === item.href || (location.startsWith(item.href) && item.href !== "/admin");
        return (
          <Link 
            key={item.href} 
            href={item.href}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive 
                ? "bg-primary text-primary-foreground" 
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
            data-testid={`admin-nav-${item.href.replace('/admin', '') || 'home'}`}
          >
            <item.icon className="h-4 w-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );

  if (isPos) {
    return (
      <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-serif text-xl font-bold text-primary">نقطة البيع - الدمشقي</span>
          </div>
          <div className="flex items-center gap-4">
             <Button variant="outline" size="sm" asChild data-testid="button-exit-pos">
               <Link href="/admin">العودة للوحة التحكم</Link>
             </Button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-muted/40 font-sans text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-l border-border bg-card shrink-0 h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/admin" className="font-serif text-2xl font-bold text-primary" data-testid="link-admin-logo">
            الدمشقي
          </Link>
        </div>
        <ScrollArea className="flex-1">
          <NavItems />
        </ScrollArea>
        <div className="p-4 border-t border-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="w-full justify-start gap-3 h-12" data-testid="button-admin-user-menu">
                <Avatar className="h-8 w-8 rounded-md border border-border">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="rounded-md bg-primary/10 text-primary">{user?.firstName?.[0] || "م"}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start text-right overflow-hidden flex-1">
                  <span className="text-sm font-medium truncate w-full">{user?.fullName || "مستخدم"}</span>
                  <span className="text-xs text-muted-foreground truncate w-full" dir="ltr">{user?.primaryEmailAddress?.emailAddress}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>حسابي</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/" className="cursor-pointer w-full" data-testid="link-public-site">
                  الذهاب للمتجر العام
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive cursor-pointer" data-testid="button-admin-sign-out">
                <LogOut className="mr-2 h-4 w-4" />
                <span>تسجيل الخروج</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Mobile Header */}
        <header className="md:hidden h-16 border-b border-border bg-card flex items-center justify-between px-4 shrink-0 sticky top-0 z-10">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" data-testid="button-admin-mobile-menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[280px] p-0 flex flex-col">
              <div className="h-16 flex items-center px-6 border-b border-border shrink-0">
                <span className="font-serif text-2xl font-bold text-primary">الدمشقي</span>
              </div>
              <ScrollArea className="flex-1">
                <NavItems />
              </ScrollArea>
            </SheetContent>
          </Sheet>
          <span className="font-serif text-lg font-bold text-primary">لوحة التحكم</span>
          <Avatar className="h-8 w-8 rounded-md border border-border">
            <AvatarImage src={user?.imageUrl} />
            <AvatarFallback className="rounded-md bg-primary/10 text-primary">{user?.firstName?.[0] || "م"}</AvatarFallback>
          </Avatar>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto bg-background p-4 md:p-8">
          <div className="max-w-6xl mx-auto h-full flex flex-col">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
