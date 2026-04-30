/**
 * The الدمشقي business is structured as two cooperating divisions:
 *
 *   - Workshop (المشغل): the production side. Owns raw materials, the
 *     manufacturing process, and finished-goods inventory at the factory.
 *   - Store (المعرض): the customer-facing side. Owns the showroom
 *     finished-goods inventory, the POS, and online orders.
 *
 * Stock moves between divisions through the Transfers module. Most data
 * (inventory_locations, financial_entries) already carries enough metadata
 * to compute its division — this file is just the canonical mapping +
 * Arabic labels so every page reads the same.
 */

export type Division = "workshop" | "store";
export type DivisionFilter = Division | "all";

export const DIVISION_LABEL_AR: Record<DivisionFilter, string> = {
  all: "الكل",
  workshop: "المشغل",
  store: "المعرض",
};

export const DIVISION_LABEL_EN: Record<DivisionFilter, string> = {
  all: "All",
  workshop: "Workshop",
  store: "Store",
};

/**
 * Map an inventory_location.kind enum to the division that owns it.
 * `warehouse` is intentionally null because that kind is for generic
 * storage that could belong to either division depending on usage.
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
 * Map a financial_entry.module enum to its division.
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
