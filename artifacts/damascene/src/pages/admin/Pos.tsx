import { useState, useMemo } from "react";
import { useListProducts, useCreateSalesOrder } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, Trash2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatSyp } from "@/lib/format";

interface CartLine { productId: string; nameAr: string; priceMinor: number; quantity: number }

export default function AdminPosPage() {
  const { data: products } = useListProducts({ isActive: true });
  const createOrder = useCreateSalesOrder();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bank_transfer">("cash");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [lastInvoice, setLastInvoice] = useState<{
    orderNumber: string;
    items: CartLine[];
    subtotal: number;
    discount: number;
    total: number;
    paymentMethod: string;
    customerName?: string;
    customerPhone?: string;
    issuedAt: string;
  } | null>(null);

  const printInvoice = () => {
    if (!lastInvoice) return;
    const w = window.open("", "_blank", "width=400,height=600");
    if (!w) return;
    const fmt = (n: number) =>
      `${(n / 100).toLocaleString("ar-SY")} ل.س`;
    const pmLabel: Record<string, string> = {
      cash: "نقداً",
      card: "بطاقة",
      bank_transfer: "حوالة",
    };
    w.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>فاتورة ${lastInvoice.orderNumber}</title>
<style>
  body{font-family:Tajawal,Arial;padding:12px;font-size:13px;color:#000}
  h1{text-align:center;font-size:18px;margin:0 0 4px}
  .meta{text-align:center;color:#555;font-size:11px;margin-bottom:10px}
  .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px dashed #ccc}
  .total{font-weight:bold;font-size:15px;border-top:2px solid #000;border-bottom:none;padding-top:8px;margin-top:6px}
  .center{text-align:center;margin-top:14px;font-size:11px}
  @media print{button{display:none}}
</style></head><body>
  <h1>الدمشقي</h1>
  <div class="meta">فاتورة رقم: ${lastInvoice.orderNumber}<br>${new Date(lastInvoice.issuedAt).toLocaleString("ar-SY")}</div>
  ${lastInvoice.customerName ? `<div class="row"><span>العميل</span><span>${lastInvoice.customerName}</span></div>` : ""}
  ${lastInvoice.customerPhone ? `<div class="row"><span>الهاتف</span><span dir="ltr">${lastInvoice.customerPhone}</span></div>` : ""}
  <div style="margin-top:8px;border-top:1px solid #000;padding-top:6px">
    ${lastInvoice.items
      .map(
        (l) =>
          `<div class="row"><span>${l.nameAr} ×${l.quantity}</span><span>${fmt(l.priceMinor * l.quantity)}</span></div>`,
      )
      .join("")}
  </div>
  <div class="row"><span>المجموع الفرعي</span><span>${fmt(lastInvoice.subtotal)}</span></div>
  ${lastInvoice.discount > 0 ? `<div class="row"><span>الخصم</span><span>-${fmt(lastInvoice.discount)}</span></div>` : ""}
  <div class="row"><span>طريقة الدفع</span><span>${pmLabel[lastInvoice.paymentMethod] ?? lastInvoice.paymentMethod}</span></div>
  <div class="row total"><span>الإجمالي</span><span>${fmt(lastInvoice.total)}</span></div>
  <div class="center">شكراً لزيارتكم</div>
  <div class="center"><button onclick="window.print()">طباعة</button></div>
  <script>setTimeout(()=>window.print(),300)</script>
</body></html>`);
    w.document.close();
  };

  const filtered = useMemo(() => {
    if (!products) return [];
    if (!search) return products;
    const s = search.toLowerCase();
    return products.filter((p) => p.nameAr.toLowerCase().includes(s) || (p.sku || "").toLowerCase().includes(s));
  }, [products, search]);

  const subtotal = cart.reduce((sum, l) => sum + l.priceMinor * l.quantity, 0);
  const total = Math.max(0, subtotal - Number(discount || 0));

  const addToCart = (p: { id: string; nameAr: string; priceMinor: number }) => {
    setCart((prev) => {
      const exists = prev.find((l) => l.productId === p.id);
      if (exists) return prev.map((l) => l.productId === p.id ? { ...l, quantity: l.quantity + 1 } : l);
      return [...prev, { productId: p.id, nameAr: p.nameAr, priceMinor: p.priceMinor, quantity: 1 }];
    });
  };
  const updateQty = (id: string, q: number) => {
    if (q <= 0) setCart(cart.filter((l) => l.productId !== id));
    else setCart(cart.map((l) => l.productId === id ? { ...l, quantity: q } : l));
  };
  const clearCart = () => { setCart([]); setDiscount(0); setCustomerName(""); setCustomerPhone(""); };

  const checkout = () => {
    if (cart.length === 0) return;
    createOrder.mutate({ data: {
      paymentMethod,
      discountMinor: Number(discount) || 0,
      customerName: customerName || undefined,
      customerPhone: customerPhone || undefined,
      items: cart.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    }}, {
      onSuccess: (order) => {
        toast({ title: "تم البيع", description: `رقم الطلب: ${order.orderNumber}` });
        setLastInvoice({
          orderNumber: order.orderNumber,
          items: cart,
          subtotal,
          discount: Number(discount) || 0,
          total,
          paymentMethod,
          customerName: customerName || undefined,
          customerPhone: customerPhone || undefined,
          issuedAt: new Date().toISOString(),
        });
        clearCart();
      },
      onError: (e: unknown) => toast({ title: "خطأ", description: e instanceof Error ? e.message : "تعذّر البيع", variant: "destructive" }),
    });
  };

  return (
    <div className="grid lg:grid-cols-[1fr_400px] gap-4 h-[calc(100vh-160px)]">
      <Card className="flex flex-col overflow-hidden">
        <CardHeader>
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground/40" />
            <Input className="pr-10" placeholder="بحث عن منتج..." value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-pos-search" />
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((p) => (
              <button key={p.id} onClick={() => addToCart(p)} className="group rounded-lg border bg-card p-3 text-right hover-elevate active-elevate-2" data-testid={`button-pos-product-${p.slug}`}>
                <div className="font-medium text-sm line-clamp-2">{p.nameAr}</div>
                <div className="text-primary font-medium mt-2">{formatSyp(p.priceMinor)}</div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>السلة</CardTitle>
          {cart.length > 0 && <Button variant="ghost" size="sm" onClick={clearCart}><Trash2 className="h-4 w-4" /></Button>}
        </CardHeader>
        <CardContent className="flex-1 overflow-auto space-y-2">
          {cart.length === 0 ? (
            <p className="text-foreground/50 text-center py-12">السلة فارغة</p>
          ) : cart.map((l) => (
            <div key={l.productId} className="flex items-center gap-2 border rounded-md p-2">
              <div className="flex-1">
                <div className="text-sm font-medium">{l.nameAr}</div>
                <div className="text-xs text-foreground/60">{formatSyp(l.priceMinor)}</div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(l.productId, l.quantity - 1)}><Minus className="h-3 w-3" /></Button>
              <span className="w-6 text-center text-sm">{l.quantity}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => updateQty(l.productId, l.quantity + 1)}><Plus className="h-3 w-3" /></Button>
            </div>
          ))}
        </CardContent>
        <div className="border-t p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="اسم العميل" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            <Input placeholder="رقم الهاتف" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span>المجموع الفرعي</span>
            <span>{formatSyp(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <Label>خصم (×100)</Label>
            <Input type="number" className="w-32" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant={paymentMethod === "cash" ? "default" : "outline"} onClick={() => setPaymentMethod("cash")} data-testid="button-pos-pay-cash">نقداً</Button>
            <Button variant={paymentMethod === "card" ? "default" : "outline"} onClick={() => setPaymentMethod("card")} data-testid="button-pos-pay-card">بطاقة</Button>
            <Button variant={paymentMethod === "bank_transfer" ? "default" : "outline"} onClick={() => setPaymentMethod("bank_transfer")} data-testid="button-pos-pay-transfer">حوالة</Button>
          </div>
          <Separator />
          <div className="flex items-center justify-between text-lg font-bold">
            <span>الإجمالي</span>
            <span data-testid="text-pos-total">{formatSyp(total)}</span>
          </div>
          <Button className="w-full" size="lg" disabled={cart.length === 0 || createOrder.isPending} onClick={checkout} data-testid="button-pos-checkout">
            {createOrder.isPending ? "جاري الإصدار..." : "إصدار الفاتورة"}
          </Button>
          {lastInvoice && (
            <Button className="w-full" size="sm" variant="outline" onClick={printInvoice} data-testid="button-pos-print-invoice">
              طباعة فاتورة #{lastInvoice.orderNumber}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
