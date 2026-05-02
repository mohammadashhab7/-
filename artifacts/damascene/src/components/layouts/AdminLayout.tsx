import React, { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk, useUser } from "@clerk/react";
import { useGetMe, useGetSettings } from "@workspace/api-client-react";
import { hasModulePerm, type ModuleName } from "@/components/PermissionRoute";
import { useBusinessUnit } from "@/contexts/BusinessUnitContext";
import DivisionSwitcher from "@/components/admin/DivisionSwitcher";
import {
  LayoutDashboard,
  Package,
  Tags,
  FlaskConical,
  ChefHat,
  Warehouse,
  Factory,
  ArrowRightLeft,
  Receipt,
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
  Menu,
  CalendarCheck,
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

type Scope = "factory" | "showroom" | "common";
type NavItem = {
  title: string;
  href: string;
  icon: typeof LayoutDashboard;
  module: ModuleName | null;
  scope: Scope;
};

// Cross-cutting (admin-wide) items always shown to anyone with permission.
const COMMON_NAV: NavItem[] = [
  { title: "الرئيسية", href: "/", icon: LayoutDashboard, module: null, scope: "common" },
  { title: "المنتجات", href: "/products", icon: Package, module: "products", scope: "common" },
  { title: "التصنيفات", href: "/categories", icon: Tags, module: "categories", scope: "common" },
  { title: "المستخدمين", href: "/users", icon: ShieldCheck, module: "users", scope: "common" },
  { title: "المحتوى (CMS)", href: "/cms", icon: FileText, module: "cms", scope: "common" },
  { title: "الوسائط", href: "/media", icon: ImageIcon, module: "media", scope: "common" },
  { title: "الإعدادات", href: "/settings", icon: Settings, module: "settings", scope: "common" },
];

// Factory ("المصنع") section: production / wholesale-out side.
const FACTORY_NAV: NavItem[] = [
  { title: "المواد الأولية", href: "/raw-materials", icon: FlaskConical, module: "raw_materials", scope: "factory" },
  { title: "الوصفات", href: "/recipes", icon: ChefHat, module: "recipes", scope: "factory" },
  { title: "أوامر التصنيع", href: "/production", icon: Factory, module: "production", scope: "factory" },
  { title: "المخزون", href: "/inventory", icon: Warehouse, module: "inventory", scope: "factory" },
  { title: "التحويلات", href: "/transfers", icon: ArrowRightLeft, module: "transfers", scope: "factory" },
  { title: "البيع للمعارض", href: "/wholesale-orders", icon: Receipt, module: "transfers", scope: "factory" },
  { title: "المالية", href: "/financials", icon: Wallet, module: "financial", scope: "factory" },
  { title: "الموظفون", href: "/employees", icon: Users, module: "employees", scope: "factory" },
  { title: "التقارير", href: "/reports", icon: BarChart3, module: "reports", scope: "factory" },
];

// Showroom ("المعرض") section: storefront / POS / wholesale-in side.
const SHOWROOM_NAV: NavItem[] = [
  { title: "نقطة البيع (POS)", href: "/pos", icon: MonitorSmartphone, module: "pos", scope: "showroom" },
  { title: "الطلبات", href: "/orders", icon: ShoppingCart, module: "orders", scope: "showroom" },
  { title: "إغلاق اليوم", href: "/daily-closing", icon: CalendarCheck, module: "pos", scope: "showroom" },
  { title: "المخزون", href: "/inventory", icon: Warehouse, module: "inventory", scope: "showroom" },
  { title: "المشتريات من المصنع", href: "/wholesale-orders", icon: Receipt, module: "transfers", scope: "showroom" },
  { title: "التحويلات", href: "/transfers", icon: ArrowRightLeft, module: "transfers", scope: "showroom" },
  { title: "المالية", href: "/financials", icon: Wallet, module: "financial", scope: "showroom" },
  { title: "الموظفون", href: "/employees", icon: Users, module: "employees", scope: "showroom" },
  { title: "التقارير", href: "/reports", icon: BarChart3, module: "reports", scope: "showroom" },
];

// All routes — used to look up the current page's title for the breadcrumb.
const ALL_ROUTES: NavItem[] = [...COMMON_NAV, ...FACTORY_NAV, ...SHOWROOM_NAV];

function findPageTitle(pathname: string): string | null {
  // Strip trailing slash and admin prefix is already stripped by wouter base.
  const path = pathname.replace(/\/+$/, "") || "/";
  // Exact match first.
  const exact = ALL_ROUTES.find((r) => r.href === path);
  if (exact) return exact.title;
  // Then prefix match for nested routes.
  const candidates = ALL_ROUTES.filter(
    (r) => r.href !== "/" && path.startsWith(r.href),
  );
  if (candidates.length === 0) return null;
  // Pick the longest matching href.
  return candidates.reduce((a, b) =>
    a.href.length >= b.href.length ? a : b,
  ).title;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const [location] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useGetMe();
  const { data: settings, isPending: settingsPending } = useGetSettings();
  const storeName =
    (settings as { storeNameAr?: string } | undefined)?.storeNameAr ?? "";
  const settingsLoaded = !settingsPending;

  const { activeBu, isPrivileged } = useBusinessUnit();

  const isPos = location.startsWith("/pos");

  const canSee = (item: NavItem) =>
    item.module === null
      ? true
      : hasModulePerm(
          me?.permissions as string[] | undefined,
          me?.role,
          item.module,
          "read",
        );

  // Decide which scoped sections to render. When admin/owner is on
  // "all divisions" view (activeBu = null) we show both sections so they can
  // navigate freely. Non-privileged users always see exactly the section that
  // matches their assigned BU's kind.
  const showFactory =
    activeBu?.kind === "factory" || (isPrivileged && !activeBu);
  const showShowroom =
    activeBu?.kind === "showroom" || (isPrivileged && !activeBu);

  const visibleCommon = COMMON_NAV.filter(canSee);
  const visibleFactory = showFactory ? FACTORY_NAV.filter(canSee) : [];
  const visibleShowroom = showShowroom ? SHOWROOM_NAV.filter(canSee) : [];

  const renderItem = (item: NavItem, sectionKey: string) => {
    const isActive =
      location === item.href ||
      (item.href !== "/" && location.startsWith(item.href));
    return (
      <Link
        key={`${sectionKey}-${item.href}`}
        href={item.href}
        className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
          isActive
            ? "bg-primary text-primary-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        }`}
        data-testid={`admin-nav-${sectionKey}-${item.href === "/" ? "home" : item.href.slice(1)}`}
      >
        <item.icon className="h-4 w-4" />
        {item.title}
      </Link>
    );
  };

  const NavItems = () => (
    <nav className="flex flex-col gap-4 p-4">
      {visibleCommon.length > 0 && (
        <div className="flex flex-col gap-1">
          {visibleCommon.map((it) => renderItem(it, "common"))}
        </div>
      )}

      {visibleFactory.length > 0 && (
        <div className="flex flex-col gap-1">
          <div
            className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            data-testid="admin-nav-section-factory"
          >
            المصنع
          </div>
          {visibleFactory.map((it) => renderItem(it, "factory"))}
        </div>
      )}

      {visibleShowroom.length > 0 && (
        <div className="flex flex-col gap-1">
          <div
            className="px-3 pt-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70"
            data-testid="admin-nav-section-showroom"
          >
            {activeBu?.kind === "showroom" ? activeBu.nameAr : "المعارض"}
          </div>
          {visibleShowroom.map((it) => renderItem(it, "showroom"))}
        </div>
      )}
    </nav>
  );

  if (isPos) {
    return (
      <div className="min-h-screen flex flex-col bg-background font-sans text-foreground">
        <header className="h-14 border-b bg-card flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-4">
            <span className="font-serif text-xl font-bold text-primary">
              نقطة البيع
              {settingsLoaded && storeName ? ` - ${storeName}` : ""}
              {activeBu ? ` — ${activeBu.nameAr}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-4">
             <Button variant="outline" size="sm" asChild data-testid="button-exit-pos">
               <Link href="/">العودة للوحة التحكم</Link>
             </Button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    );
  }

  const pageTitle = findPageTitle(location);
  const headerLabel = activeBu
    ? pageTitle
      ? `${activeBu.nameAr} — ${pageTitle}`
      : activeBu.nameAr
    : pageTitle ?? "كل الأقسام";

  return (
    <div className="min-h-screen flex bg-muted/40 font-sans text-foreground">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 flex-col border-l border-border bg-card shrink-0 h-screen sticky top-0">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Link href="/" className="font-serif text-2xl font-bold text-primary" data-testid="link-admin-logo">
            {settingsLoaded ? (
              storeName
            ) : (
              <span className="inline-block h-6 w-20 rounded bg-primary/10 align-middle animate-pulse" aria-hidden />
            )}
          </Link>
        </div>
        {isPrivileged && (
          <div className="px-4 py-3 border-b border-border">
            <DivisionSwitcher />
          </div>
        )}
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
                <Link href="~/" className="cursor-pointer w-full" data-testid="link-public-site">
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
                <span className="font-serif text-2xl font-bold text-primary">
                  {settingsLoaded ? (
                    storeName
                  ) : (
                    <span className="inline-block h-6 w-20 rounded bg-primary/10 align-middle animate-pulse" aria-hidden />
                  )}
                </span>
              </div>
              {isPrivileged && (
                <div className="px-4 py-3 border-b border-border">
                  <DivisionSwitcher />
                </div>
              )}
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

        {/* Active-BU breadcrumb (desktop only) */}
        <div
          className="hidden md:flex items-center justify-between px-8 py-3 border-b border-border/60 bg-card/40 text-sm text-muted-foreground"
          data-testid="admin-page-breadcrumb"
        >
          <div className="flex items-center gap-2">
            <Building2Like />
            <span data-testid="admin-page-breadcrumb-text">{headerLabel}</span>
          </div>
        </div>

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

// Tiny inline icon — keep imports terse.
function Building2Like() {
  return <Factory className="h-4 w-4 text-muted-foreground/70" aria-hidden />;
}
