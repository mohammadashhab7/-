export function formatSyp(minor: number | undefined | null, currency: string = "SYP"): string {
  const n = Number(minor || 0) / 100;
  const formatted = new Intl.NumberFormat("ar-SY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return `${formatted} ل.س`;
}

export function formatNumber(value: number | undefined | null, fractionDigits: number = 0): string {
  return new Intl.NumberFormat("ar-SY", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(Number(value || 0));
}

export function formatQty(thousandths: number | undefined | null): string {
  return formatNumber(Number(thousandths || 0) / 1000, 3);
}

export function formatDate(input: string | Date | undefined | null): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ar-SY", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}

export function formatDateTime(input: string | Date | undefined | null): string {
  if (!input) return "";
  const d = typeof input === "string" ? new Date(input) : input;
  return new Intl.DateTimeFormat("ar-SY", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export const ORDER_STATUS_AR: Record<string, string> = {
  pending_payment: "بانتظار الدفع",
  paid: "مدفوع",
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  preparing: "قيد التحضير",
  ready: "جاهز",
  out_for_delivery: "قيد التوصيل",
  delivered: "تم التوصيل",
  completed: "مكتمل",
  cancelled: "ملغي",
  refunded: "مسترجع",
};

export const PAYMENT_METHOD_AR: Record<string, string> = {
  cash: "نقداً",
  card: "بطاقة",
  online: "عبر الإنترنت",
  cod: "الدفع عند الاستلام",
};

export const CHANNEL_AR: Record<string, string> = {
  pos: "نقطة البيع",
  online: "عبر الإنترنت",
};
