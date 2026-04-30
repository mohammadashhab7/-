/**
 * Division taxonomy for الدمشقي. See artifacts/damascene/src/lib/division.ts
 * for the frontend mirror — keep these two files in lock-step.
 *
 *   workshop = المشغل  (production raw + production finished + manufacturing)
 *   store    = المعرض  (showroom finished + POS + online sales)
 */

export type Division = "workshop" | "store";
export type DivisionFilter = Division | "all";

export function isDivisionFilter(v: unknown): v is DivisionFilter {
  return v === "all" || v === "workshop" || v === "store";
}

/**
 * Map a financial_entry.module enum to its division.
 * `production` belongs to the workshop, `store` belongs to the store.
 */
export function divisionFromFinancialModule(
  module: string | null | undefined,
): Division | null {
  switch (module) {
    case "production":
      return "workshop";
    case "store":
      return "store";
    default:
      return null;
  }
}

/**
 * Map an inventory_location.kind to its division.
 */
export function divisionFromLocationKind(
  kind: string | null | undefined,
): Division | null {
  switch (kind) {
    case "production_raw":
    case "production_finished":
      return "workshop";
    case "store":
      return "store";
    default:
      return null;
  }
}

/**
 * The financial-module values that belong to a given division.
 * Useful for SQL filters: `inArray(financialEntries.module, divisionToFinancialModules('workshop'))`.
 */
export function divisionToFinancialModules(
  d: DivisionFilter,
): Array<"production" | "store"> {
  if (d === "workshop") return ["production"];
  if (d === "store") return ["store"];
  return ["production", "store"];
}
