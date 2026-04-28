import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider, RedirectToSignIn } from "@clerk/react";

import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/queryClient";
import NotFound from "@/pages/not-found";

import PublicLayout from "@/components/layouts/PublicLayout";
import AdminLayout from "@/components/layouts/AdminLayout";
import AccountLayout from "@/components/layouts/AccountLayout";
import { useGetMe } from "@workspace/api-client-react";

import HomePage from "@/pages/public/Home";
import ShopPage from "@/pages/public/Shop";
import ProductDetailPage from "@/pages/public/ProductDetail";
import CheckoutPage from "@/pages/public/Checkout";
import OrderConfirmationPage from "@/pages/public/OrderConfirmation";
import StoryPage from "@/pages/public/Story";
import ContactPage from "@/pages/public/Contact";
import SignInPage from "@/pages/public/SignIn";
import SignUpPage from "@/pages/public/SignUp";
import UnauthorizedPage from "@/pages/Unauthorized";

import AccountHomePage from "@/pages/account/AccountHome";
import MyOrdersPage from "@/pages/account/MyOrders";

import DashboardPage from "@/pages/admin/Dashboard";
import AdminProductsPage from "@/pages/admin/Products";
import AdminCategoriesPage from "@/pages/admin/Categories";
import AdminRawMaterialsPage from "@/pages/admin/RawMaterials";
import AdminRecipesPage from "@/pages/admin/Recipes";
import AdminInventoryPage from "@/pages/admin/Inventory";
import AdminProductionPage from "@/pages/admin/Production";
import AdminTransfersPage from "@/pages/admin/Transfers";
import AdminPosPage from "@/pages/admin/Pos";
import AdminClosingPage from "@/pages/admin/DailyClosing";
import AdminOrdersPage from "@/pages/admin/Orders";
import AdminFinancialsPage from "@/pages/admin/Financials";
import AdminReportsPage from "@/pages/admin/Reports";
import AdminEmployeesPage from "@/pages/admin/Employees";
import AdminUsersPage from "@/pages/admin/Users";
import AdminCmsPage from "@/pages/admin/Cms";
import AdminMediaPage from "@/pages/admin/Media";
import AdminSettingsPage from "@/pages/admin/Settings";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function StaffRoute({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-primary">
        جاري التحميل...
      </div>
    );
  }
  if (!me?.isAuthenticated) {
    return <RedirectToSignIn />;
  }
  if (me.role === "customer") {
    return <Redirect to="/unauthorized" />;
  }
  return <>{children}</>;
}

function CustomerRoute({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useGetMe();
  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center text-primary">
        جاري التحميل...
      </div>
    );
  }
  if (!me?.isAuthenticated) {
    return <RedirectToSignIn />;
  }
  return <>{children}</>;
}

function Router() {
  return (
    <Switch>
      <Route path="/admin" nest>
        <StaffRoute>
          <AdminLayout>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/products" component={AdminProductsPage} />
              <Route path="/categories" component={AdminCategoriesPage} />
              <Route path="/raw-materials" component={AdminRawMaterialsPage} />
              <Route path="/recipes" component={AdminRecipesPage} />
              <Route path="/inventory" component={AdminInventoryPage} />
              <Route path="/production" component={AdminProductionPage} />
              <Route path="/transfers" component={AdminTransfersPage} />
              <Route path="/pos" component={AdminPosPage} />
              <Route path="/daily-closing" component={AdminClosingPage} />
              <Route path="/orders" component={AdminOrdersPage} />
              <Route path="/financials" component={AdminFinancialsPage} />
              <Route path="/reports" component={AdminReportsPage} />
              <Route path="/employees" component={AdminEmployeesPage} />
              <Route path="/users" component={AdminUsersPage} />
              <Route path="/cms" component={AdminCmsPage} />
              <Route path="/media" component={AdminMediaPage} />
              <Route path="/settings" component={AdminSettingsPage} />
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
        </StaffRoute>
      </Route>

      <Route path="/account" nest>
        <CustomerRoute>
          <AccountLayout>
            <Switch>
              <Route path="/" component={AccountHomePage} />
              <Route path="/orders" component={MyOrdersPage} />
              <Route component={NotFound} />
            </Switch>
          </AccountLayout>
        </CustomerRoute>
      </Route>

      <Route>
        <PublicLayout>
          <Switch>
            <Route path="/" component={HomePage} />
            <Route path="/shop" component={ShopPage} />
            <Route path="/product/:slug">
              {(params) => <ProductDetailPage slug={params.slug} />}
            </Route>
            <Route path="/checkout" component={CheckoutPage} />
            <Route path="/order/:orderNumber">
              {(params) => <OrderConfirmationPage orderNumber={params.orderNumber} />}
            </Route>
            <Route path="/story" component={StoryPage} />
            <Route path="/contact" component={ContactPage} />
            <Route path="/sign-in" component={SignInPage} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up" component={SignUpPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/unauthorized" component={UnauthorizedPage} />
            <Route component={NotFound} />
          </Switch>
        </PublicLayout>
      </Route>
    </Switch>
  );
}

function App() {
  useEffect(() => {
    document.documentElement.dir = "rtl";
    document.documentElement.lang = "ar";
  }, []);

  if (!PUBLISHABLE_KEY) {
    return (
      <div className="p-8 text-center text-red-600">
        VITE_CLERK_PUBLISHABLE_KEY is not configured.
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        appearance={{
          variables: {
            colorPrimary: "hsl(43 65% 35%)",
            colorText: "hsl(20 20% 12%)",
            colorBackground: "hsl(40 33% 98%)",
          },
        }}
      >
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </ClerkProvider>
    </QueryClientProvider>
  );
}

export default App;
