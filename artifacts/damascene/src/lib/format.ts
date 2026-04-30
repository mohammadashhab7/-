import { useGetSettings } from "@workspace/api-client-react";

export const DEFAULT_CURRENCY_SYMBOL = "ل.س";

export function formatSyp(
  minor: number | undefined | null,
  symbol: string = DEFAULT_CURRENCY_SYMBOL,
): string {
  const n = Number(minor || 0) / 100;
  const formatted = new Intl.NumberFormat("ar-SY", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
  return `${formatted} ${symbol}`;
}

/**
 * React hook that returns the configured currency symbol from store settings.
 * Returns an empty string while settings are still loading so the public UI
 * doesn't briefly flash a hardcoded symbol before the saved value arrives.
 */
export function useCurrencySymbol(): string {
  const { data, isPending } = useGetSettings();
  if (isPending) return "";
  const sym = (data as { currencySymbol?: string } | undefined)?.currencySymbol;
  return sym && sym.length > 0 ? sym : DEFAULT_CURRENCY_SYMBOL;
}

/**
 * React hook returning a price formatter bound to the current settings symbol.
 * Use everywhere prices are displayed so admin changes propagate automatically.
 */
export function useFormatPrice(): (minor: number | undefined | null) => string {
  const symbol = useCurrencySymbol();
  return (minor) => formatSyp(minor, symbol);
}

/**
 * React hook returning just the integer part formatted for ar-SY locale,
 * for use when the component lays out the symbol separately in markup.
 */
export function useFormatPriceParts(): {
  format: (minor: number | undefined | null) => string;
  symbol: string;
} {
  const symbol = useCurrencySymbol();
  return {
    symbol,
    format: (minor) =>
      new Intl.NumberFormat("ar-SY", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(Number(minor || 0) / 100),
  };
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
