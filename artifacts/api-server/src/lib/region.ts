/**
 * Central regional configuration for the API server.
 *
 * Single source of truth for the country, currency code, currency symbol, and
 * locale used as system-wide defaults. Driven by environment variables so a
 * future deployment can flip regions by setting env vars + updating the seeded
 * settings row, without searching the codebase.
 *
 * Defaults are Palestine / ILS / ar-PS.
 */
export const COUNTRY_CODE: string = process.env.COUNTRY ?? "PS";
export const CURRENCY_CODE: string = process.env.CURRENCY ?? "ILS";
export const CURRENCY_SYMBOL: string = process.env.CURRENCY_SYMBOL ?? "₪";
export const LOCALE: string = process.env.LOCALE ?? "ar-PS";
