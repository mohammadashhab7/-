import React from "react";
import { 
  useGetDashboardKpis, 
  useGetSalesTrend, 
  useGetTopProducts,
  useGetRecentActivity,
  useListLowStock
} from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useBusinessUnit } from "@/contexts/BusinessUnitContext";
import { 
  TrendingUp, 
  TrendingDown,
  ShoppingCart, 
  AlertTriangle, 
  Wallet,
  Activity,
  Clock,
  Package,
  ArrowRightLeft,
  Factory,
  MonitorSmartphone,
  Globe
} from "lucide-react";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from "recharts";
import { useCurrencySymbol, formatDate as fmtDate, formatDateTime as fmtDateTime } from "@/lib/format";

export default function DashboardPage() {
  const { activeBu } = useBusinessUnit();
  const { data: kpis, isLoading: isLoadingKpis } = useGetDashboardKpis();
  const { data: salesTrend, isLoading: isLoadingTrend } = useGetSalesTrend({ days: 7 });
  const { data: topProducts, isLoading: isLoadingTop } = useGetTopProducts({ limit: 5 });
  const { data: recentActivity, isLoading: isLoadingActivity } = useGetRecentActivity();
  const { data: lowStock } = useListLowStock();
  const currencySymbol = useCurrencySymbol();

  // Derive which KPI groups to show from the currently active business unit.
  // No active BU = "all divisions" view (privileged users) → show both.
  // Showroom BU → storefront/POS KPIs only. Factory BU → workshop KPIs only.
  const showStore = !activeBu || activeBu.kind === "showroom";
  const showWorkshop = !activeBu || activeBu.kind === "factory";

  const formatCurrency = (minor: number | undefined) => {
    if (minor === undefined) return "0";
    return new Intl.NumberFormat("en-US").format(minor);
  };

  const getActivityIcon = (kind: string) => {
    switch(kind) {
      case "order": return <ShoppingCart className="h-4 w-4 text-blue-500" />;
      case "production": return <Factory className="h-4 w-4 text-orange-500" />;
      case "transfer": return <ArrowRightLeft className="h-4 w-4 text-purple-500" />;
      case "financial": return <Wallet className="h-4 w-4 text-green-500" />;
      default: return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-serif font-bold text-foreground tracking-tight">نظرة عامة</h1>
          <p className="text-muted-foreground mt-1">
            ملخص أداء العمليات والمبيعات
            {activeBu ? ` — ${activeBu.nameAr}` : " — كل الأقسام"}.
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {showStore && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-today-sales">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات اليوم</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/2" />
            ) : (
              <div className="text-2xl font-bold text-primary" dir="ltr">
                {formatCurrency(kpis?.todaySalesMinor)} <span className="text-sm text-muted-foreground ml-1">{currencySymbol}</span>
              </div>
            )}
            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
              <div>{kpis?.todayOrders ?? 0} طلب اليوم</div>
              <div className="flex items-center gap-3 pt-1">
                <span className="flex items-center gap-1" data-testid="kpi-today-pos">
                  <MonitorSmartphone className="h-3 w-3" />
                  POS: <span dir="ltr">{formatCurrency(kpis?.todayPosSalesMinor)}</span>
                </span>
                <span className="flex items-center gap-1" data-testid="kpi-today-online">
                  <Globe className="h-3 w-3" />
                  أونلاين: <span dir="ltr">{formatCurrency(kpis?.todayOnlineSalesMinor)}</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {showStore && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-wow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات هذا الأسبوع</CardTitle>
            {(kpis?.wowDeltaPct ?? 0) >= 0
              ? <TrendingUp className="h-4 w-4 text-green-600" />
              : <TrendingDown className="h-4 w-4 text-destructive" />}
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/2" />
            ) : (
              <div className="text-2xl font-bold" dir="ltr">
                {formatCurrency(kpis?.thisWeekSalesMinor)} <span className="text-sm text-muted-foreground ml-1">{currencySymbol}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {kpis?.wowDeltaPct === null || kpis?.wowDeltaPct === undefined ? (
                <span>لا توجد بيانات للأسبوع الماضي</span>
              ) : (
                <span className={kpis.wowDeltaPct >= 0 ? "text-green-600" : "text-destructive"} dir="ltr" data-testid="kpi-wow-delta">
                  {kpis.wowDeltaPct >= 0 ? "+" : ""}{kpis.wowDeltaPct}% مقارنة بالأسبوع الماضي
                </span>
              )}
            </p>
          </CardContent>
        </Card>
        )}

        {showStore && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-month-sales">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مبيعات الشهر</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/2" />
            ) : (
              <div className="text-2xl font-bold" dir="ltr">
                {formatCurrency(kpis?.monthSalesMinor)} <span className="text-sm text-muted-foreground ml-1">{currencySymbol}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              {kpis?.monthOrders} طلب هذا الشهر
            </p>
          </CardContent>
        </Card>
        )}

        {showStore && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-low-stock">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نواقص المخزون</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/4" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {kpis?.lowStockCount || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              مواد بحاجة للشراء
            </p>
          </CardContent>
        </Card>
        )}

        {showStore && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-pending-online">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">طلبات أونلاين معلقة</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
             {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/4" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {kpis?.pendingOnlineOrders || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              بانتظار التأكيد
            </p>
          </CardContent>
        </Card>
        )}

        {showWorkshop && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-workshop-open-prod">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إنتاج جارٍ اليوم</CardTitle>
            <Factory className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/4" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">
                {kpis?.openProductionToday ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              أوامر إنتاج مفتوحة
            </p>
          </CardContent>
        </Card>
        )}

        {showWorkshop && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-workshop-month-prod">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إنتاج هذا الشهر</CardTitle>
            <Factory className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/4" />
            ) : (
              <div className="text-2xl font-bold">
                {kpis?.workshopMonthProductionOrders ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              أوامر مكتملة هذا الشهر
            </p>
          </CardContent>
        </Card>
        )}

        {showWorkshop && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-workshop-month-expense">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">مصاريف المشغل (الشهر)</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/2" />
            ) : (
              <div className="text-2xl font-bold" dir="ltr">
                {formatCurrency(kpis?.workshopMonthExpenseMinor)} <span className="text-sm text-muted-foreground ml-1">{currencySymbol}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              إجمالي المصاريف الشهرية
            </p>
          </CardContent>
        </Card>
        )}

        {showWorkshop && (
        <Card className="border-border/50 shadow-sm bg-card" data-testid="kpi-workshop-low-raw">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">نواقص مواد خام</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            {isLoadingKpis ? (
              <div className="h-8 bg-muted animate-pulse rounded mt-1 w-1/4" />
            ) : (
              <div className="text-2xl font-bold text-destructive">
                {kpis?.workshopRawMaterialLowStockCount ?? 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">
              مواد بحاجة للشراء
            </p>
          </CardContent>
        </Card>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        
        {/* Sales Chart */}
        {showStore && (
        <Card className="lg:col-span-4 border-border/50 shadow-sm bg-card">
          <CardHeader>
            <CardTitle>المبيعات (آخر 7 أيام)</CardTitle>
          </CardHeader>
          <CardContent className="pl-0">
            {isLoadingTrend ? (
              <div className="h-[300px] w-full flex items-center justify-center bg-muted/20 rounded">
                <span className="text-muted-foreground">جاري تحميل البيانات...</span>
              </div>
            ) : salesTrend && salesTrend.length > 0 ? (
              <div className="h-[300px] w-full" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={salesTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(val) => fmtDate(val).split(" ").slice(0, 2).join(" ")}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                      tickFormatter={(val) => `${val / 1000}k`}
                      dx={-10}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: "hsl(var(--card))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                      itemStyle={{ color: "hsl(var(--foreground))" }}
                      formatter={(value: number) => [`${formatCurrency(value)} ${currencySymbol}`, "المبيعات"]}
                      labelFormatter={(label) => fmtDate(label as string)}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="salesMinor" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorSales)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] w-full flex items-center justify-center border border-dashed rounded text-muted-foreground">
                لا توجد بيانات متاحة
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Top Products & Low Stock */}
        <div className={`${showStore ? "lg:col-span-3" : "lg:col-span-7"} space-y-6 flex flex-col`}>
          {showStore && (
          <Card className="border-border/50 shadow-sm flex-1 bg-card">
            <CardHeader>
              <CardTitle>الأكثر مبيعاً</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingTop ? (
                <div className="space-y-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
                </div>
              ) : topProducts && topProducts.length > 0 ? (
                <div className="space-y-6">
                  {topProducts.map((product) => (
                    <div key={product.productId} className="flex items-center">
                      <div className="bg-primary/10 p-2 rounded mr-4 ml-3 text-primary">
                        <Package className="h-4 w-4" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-medium leading-none truncate pr-2">{product.productNameAr}</p>
                        <p className="text-xs text-muted-foreground truncate pr-2">
                          {product.unitsSold} وحدة مباعة
                        </p>
                      </div>
                      <div className="font-medium text-sm text-primary" dir="ltr">
                        {formatCurrency(product.revenueMinor)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-4 text-sm">لا توجد مبيعات مؤخراً</div>
              )}
            </CardContent>
          </Card>
          )}

          <Card className="border-border/50 shadow-sm bg-card border-destructive/20">
            <CardHeader className="py-4">
              <CardTitle className="text-sm text-destructive flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                تنبيهات المخزون
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-4">
              {!lowStock ? (
                <div className="h-8 bg-muted animate-pulse rounded" />
              ) : lowStock.length > 0 ? (
                <div className="space-y-3">
                  {lowStock.slice(0, 3).map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-sm">
                      <span className="truncate flex-1">{item.itemNameAr}</span>
                      <Badge variant="destructive" className="ml-2 bg-destructive/10 text-destructive hover:bg-destructive/20 font-normal">
                        {item.totalQuantity} {item.unit}
                      </Badge>
                    </div>
                  ))}
                  {lowStock.length > 3 && (
                    <div className="text-xs text-center text-muted-foreground pt-2">
                      +{lowStock.length - 3} مواد أخرى
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">المخزون بوضع جيد.</div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recent Activity */}
      <Card className="border-border/50 shadow-sm bg-card">
        <CardHeader>
          <CardTitle>النشاط الأخير</CardTitle>
          <CardDescription>آخر الحركات في النظام</CardDescription>
        </CardHeader>
        <CardContent>
           {isLoadingActivity ? (
              <div className="space-y-4">
                {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
              </div>
            ) : recentActivity && recentActivity.length > 0 ? (
              <ScrollArea className="h-[300px] pr-4">
                <div className="space-y-6">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex mb-4 last:mb-0 relative">
                      <div className="mt-0.5 ml-4 bg-muted border border-border p-2 rounded-full z-10">
                        {getActivityIcon(activity.kind)}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-medium text-foreground">{activity.titleAr}</p>
                            {activity.subtitleAr && (
                              <p className="text-xs text-muted-foreground mt-1">{activity.subtitleAr}</p>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground whitespace-nowrap mr-4 text-left" dir="ltr">
                            {fmtDateTime(activity.occurredAt)}
                          </div>
                        </div>
                        {activity.amountMinor !== undefined && (
                          <div className={`text-sm font-medium mt-1 ${activity.kind === 'financial' && (activity.amountMinor ?? 0) < 0 ? 'text-destructive' : 'text-primary'}`} dir="ltr">
                            {activity.kind === 'financial' && (activity.amountMinor ?? 0) < 0 ? '-' : '+'}{formatCurrency(Math.abs(activity.amountMinor ?? 0))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا يوجد نشاط مسجل مؤخراً
              </div>
            )}
        </CardContent>
      </Card>

    </div>
  );
}
