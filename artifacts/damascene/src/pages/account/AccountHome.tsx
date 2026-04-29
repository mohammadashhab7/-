import { useUser } from "@clerk/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "wouter";
import { useListMyOrders } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { useFormatPrice, formatDateTime, ORDER_STATUS_AR } from "@/lib/format";

export default function AccountHomePage() {
  const { user } = useUser();
  const { data: orders } = useListMyOrders();
  const formatSyp = useFormatPrice();
  const recent = orders?.slice(0, 5) || [];
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>مرحبًا، {user?.firstName || user?.fullName || ""}</CardTitle></CardHeader>
        <CardContent className="text-foreground/70">
          {user?.primaryEmailAddress?.emailAddress}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>أحدث الطلبات</CardTitle>
          <Link href="/orders"><Button variant="ghost" size="sm">عرض الكل</Button></Link>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-foreground/60 text-sm">لا توجد طلبات بعد.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((o) => (
                <div key={o.id} className="flex items-center justify-between border rounded-md p-3">
                  <div>
                    <div className="font-medium font-mono text-sm">{o.orderNumber}</div>
                    <div className="text-xs text-foreground/60">{formatDateTime(o.createdAt)}</div>
                  </div>
                  <div className="text-left">
                    <div className="font-medium">{formatSyp(o.totalMinor)}</div>
                    <div className="text-xs text-foreground/60">{ORDER_STATUS_AR[o.status] || o.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
