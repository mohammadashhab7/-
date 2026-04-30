import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { useGetSettings } from "@workspace/api-client-react";
import { LogOut, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  const { data: settings, isPending: settingsPending } = useGetSettings();
  const storeName =
    (settings as { storeNameAr?: string } | undefined)?.storeNameAr ?? "";
  const settingsLoaded = !settingsPending;
  return (
    <div className="min-h-screen bg-[hsl(40_33%_97%)]">
      <header className="border-b border-border/40 bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="~/" className="text-xl font-serif text-primary">
            {settingsLoaded ? (
              storeName
            ) : (
              <span className="inline-block h-5 w-20 rounded bg-primary/10 align-middle animate-pulse" aria-hidden />
            )}
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void signOut().then(() => {
                window.location.assign(import.meta.env.BASE_URL || "/");
              })
            }
          >
            <LogOut className="ml-2 h-4 w-4" />
            تسجيل الخروج
          </Button>
        </div>
      </header>
      <div className="container mx-auto grid grid-cols-1 gap-6 px-4 py-8 md:grid-cols-[220px_1fr]">
        <nav className="space-y-1">
          <Link
            href="/"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              location === "/" ? "bg-primary/10 text-primary" : "hover:bg-accent"
            }`}
          >
            <User className="h-4 w-4" /> حسابي
          </Link>
          <Link
            href="/orders"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              location.startsWith("/orders") ? "bg-primary/10 text-primary" : "hover:bg-accent"
            }`}
          >
            <Package className="h-4 w-4" /> طلباتي
          </Link>
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
