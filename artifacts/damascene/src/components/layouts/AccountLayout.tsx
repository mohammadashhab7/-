import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { useClerk } from "@clerk/react";
import { LogOut, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccountLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { signOut } = useClerk();
  return (
    <div className="min-h-screen bg-[hsl(40_33%_97%)]">
      <header className="border-b border-border/40 bg-background">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="text-xl font-serif text-primary">
            الدمشقي
          </Link>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              void signOut().then(() => {
                window.location.href = "/";
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
            href="/account"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              location === "/account" ? "bg-primary/10 text-primary" : "hover:bg-accent"
            }`}
          >
            <User className="h-4 w-4" /> حسابي
          </Link>
          <Link
            href="/account/orders"
            className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              location.startsWith("/account/orders") ? "bg-primary/10 text-primary" : "hover:bg-accent"
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
