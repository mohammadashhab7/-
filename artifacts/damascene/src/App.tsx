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
import { PermissionRoute } from "@/components/PermissionRoute";
import { BusinessUnitProvider } from "@/contexts/BusinessUnitContext";

import HomePage from "@/pages/public/Home";
import ShopPage from "@/pages/public/Shop";
import ProductDetailPage from "@/pages/public/ProductDetail";
import CartPage from "@/pages/public/Cart";
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
import AdminWholesalePage from "@/pages/admin/Wholesale";
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
    return <Redirect to="~/unauthorized" />;
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
          <BusinessUnitProvider>
          <AdminLayout>
            <Switch>
              <Route path="/" component={DashboardPage} />
              <Route path="/dashboard" component={DashboardPage} />

              <Route path="/products"><PermissionRoute module="products"><AdminProductsPage /></PermissionRoute></Route>
              <Route path="/categories"><PermissionRoute module="categories"><AdminCategoriesPage /></PermissionRoute></Route>

              <Route path="/raw-materials"><PermissionRoute module="raw_materials"><AdminRawMaterialsPage /></PermissionRoute></Route>
              <Route path="/recipes"><PermissionRoute module="recipes"><AdminRecipesPage /></PermissionRoute></Route>
              <Route path="/inventory"><PermissionRoute module="inventory"><AdminInventoryPage /></PermissionRoute></Route>
              <Route path="/production"><PermissionRoute module="production"><AdminProductionPage /></PermissionRoute></Route>
              <Route path="/transfers"><PermissionRoute module="transfers"><AdminTransfersPage /></PermissionRoute></Route>
              <Route path="/wholesale-orders"><PermissionRoute module="transfers"><AdminWholesalePage /></PermissionRoute></Route>

              {/* Production sub-section aliases */}
              <Route path="/production/materials"><PermissionRoute module="raw_materials"><AdminRawMaterialsPage /></PermissionRoute></Route>
              <Route path="/production/recipes"><PermissionRoute module="recipes"><AdminRecipesPage /></PermissionRoute></Route>
              <Route path="/production/orders"><PermissionRoute module="production"><AdminProductionPage /></PermissionRoute></Route>

              {/* Store sub-section aliases */}
              <Route path="/store"><Redirect to="/inventory" /></Route>
              <Route path="/store/inventory"><PermissionRoute module="inventory"><AdminInventoryPage /></PermissionRoute></Route>
              <Route path="/store/transfers"><PermissionRoute module="transfers"><AdminTransfersPage /></PermissionRoute></Route>

              <Route path="/pos"><PermissionRoute module="pos"><AdminPosPage /></PermissionRoute></Route>
              <Route path="/daily-closing"><PermissionRoute module="pos"><AdminClosingPage /></PermissionRoute></Route>
              <Route path="/pos/closing"><PermissionRoute module="pos"><AdminClosingPage /></PermissionRoute></Route>

              <Route path="/orders"><PermissionRoute module="orders"><AdminOrdersPage /></PermissionRoute></Route>
              <Route path="/sales/orders"><PermissionRoute module="orders"><AdminOrdersPage /></PermissionRoute></Route>

              <Route path="/financials"><PermissionRoute module="financial"><AdminFinancialsPage /></PermissionRoute></Route>
              <Route path="/finance"><PermissionRoute module="financial"><AdminFinancialsPage /></PermissionRoute></Route>

              <Route path="/reports"><PermissionRoute module="reports"><AdminReportsPage /></PermissionRoute></Route>
              <Route path="/employees"><PermissionRoute module="employees"><AdminEmployeesPage /></PermissionRoute></Route>
              <Route path="/users"><PermissionRoute module="users"><AdminUsersPage /></PermissionRoute></Route>
              <Route path="/cms"><PermissionRoute module="cms"><AdminCmsPage /></PermissionRoute></Route>
              <Route path="/media"><PermissionRoute module="media"><AdminMediaPage /></PermissionRoute></Route>
              <Route path="/settings"><PermissionRoute module="settings"><AdminSettingsPage /></PermissionRoute></Route>
              <Route component={NotFound} />
            </Switch>
          </AdminLayout>
          </BusinessUnitProvider>
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

            {/* Shop / Products (both URL conventions supported) */}
            <Route path="/shop" component={ShopPage} />
            <Route path="/products" component={ShopPage} />
            <Route path="/product/:slug">
              {(params) => <ProductDetailPage slug={params.slug} />}
            </Route>
            <Route path="/products/:slug">
              {(params) => <ProductDetailPage slug={params.slug} />}
            </Route>

            <Route path="/cart" component={CartPage} />
            <Route path="/checkout" component={CheckoutPage} />
            <Route path="/order/:orderNumber">
              {(params) => <OrderConfirmationPage orderNumber={params.orderNumber} />}
            </Route>
            {/* Generic confirmation landing → users find their order in account */}
            <Route path="/order-confirmation"><Redirect to="/account/orders" /></Route>

            <Route path="/story" component={StoryPage} />
            <Route path="/about" component={StoryPage} />
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
