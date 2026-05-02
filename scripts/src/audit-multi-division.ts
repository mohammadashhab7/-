/**
 * Audit script for the multi-division (Factory + Showroom) data model.
 *
 * Runs a series of read-only SQL checks against the live DB and prints a
 * coloured pass/fail summary. Re-run any time with:
 *
 *     pnpm audit:multi-division
 *
 * Exit code 0 = all checks passed; 1 = at least one failure (use in CI).
 */
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface Check {
  name: string;
  description: string;
  query: () => Promise<{ count: number; sample?: unknown[] }>;
}

const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
};

// Transfers/sales rows pre-dating the wholesale-required check (2026-04-30)
// can be intentionally excluded from the cross-BU audit by tagging notes_ar
// with this marker. See lib/db/backfills/2026-05-02-legacy-cross-bu-transfers.sql.
const LEGACY_MARKER = "[LEGACY_CROSS_BU_PRE_WHOLESALE]";

async function countAndSample(
  query: ReturnType<typeof sql>,
  sampleQuery?: ReturnType<typeof sql>,
): Promise<{ count: number; sample?: unknown[] }> {
  const r = await db.execute<{ count: string }>(query);
  const count = Number(r.rows[0]?.count ?? 0);
  if (count === 0 || !sampleQuery) return { count };
  const s = await db.execute(sampleQuery);
  return { count, sample: s.rows };
}

const CHECKS: Check[] = [
  {
    name: "fin-entries-bu-not-null",
    description:
      "financial_entries with module in (production,store) must have business_unit_id (otherwise reports under-count divisions).",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count from financial_entries
            where business_unit_id is null
              and module in ('production', 'store')`,
        sql`select id, module, type, category, amount_minor, occurred_at
            from financial_entries
            where business_unit_id is null
              and module in ('production', 'store')
            order by occurred_at desc limit 5`,
      ),
  },
  {
    name: "sales-orders-bu-not-null",
    description:
      "sales_orders must have business_unit_id (every sale belongs to a division).",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count from sales_orders
            where business_unit_id is null`,
        sql`select id, order_number, channel, status, placed_at
            from sales_orders
            where business_unit_id is null
            order by placed_at desc limit 5`,
      ),
  },
  {
    name: "sales-orders-ledger-bu-matches",
    description:
      "Every sales_order's inventory_ledger stock-out entries must be at a location whose business_unit_id matches the order's BU. Mismatch = wrong division attribution.",
    query: () =>
      countAndSample(
        sql`select count(distinct so.id)::text as count
            from sales_orders so
            join inventory_ledger il on il.reference_type = 'sales_order'
                                    and il.reference_id = so.id::text
            join inventory_locations loc on loc.id = il.location_id
            where so.business_unit_id is not null
              and loc.business_unit_id is not null
              and so.business_unit_id <> loc.business_unit_id`,
        sql`select so.id, so.order_number,
                   so.business_unit_id as order_bu,
                   loc.business_unit_id as ledger_loc_bu,
                   loc.code as loc_code
            from sales_orders so
            join inventory_ledger il on il.reference_type = 'sales_order'
                                    and il.reference_id = so.id::text
            join inventory_locations loc on loc.id = il.location_id
            where so.business_unit_id is not null
              and loc.business_unit_id is not null
              and so.business_unit_id <> loc.business_unit_id
            limit 5`,
      ),
  },
  {
    name: "production-orders-bu-is-factory",
    description:
      "production_orders.business_unit_id must reference a 'factory' kind business unit.",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count
            from production_orders po
            left join business_units bu on bu.id = po.business_unit_id
            where po.business_unit_id is null
               or bu.kind <> 'factory'`,
        sql`select po.id, po.order_number, po.business_unit_id, bu.kind
            from production_orders po
            left join business_units bu on bu.id = po.business_unit_id
            where po.business_unit_id is null
               or bu.kind <> 'factory'
            order by po.created_at desc limit 5`,
      ),
  },
  {
    name: "transfers-locations-same-bu",
    description: `transfers source/destination locations must belong to the same BU as the transfer (cross-BU should be wholesale orders, not transfers). Cancelled transfers and rows tagged ${LEGACY_MARKER} are exempt.`,
    query: () =>
      countAndSample(
        sql`select count(*)::text as count
            from transfers t
            join inventory_locations from_l on from_l.id = t.from_location_id
            join inventory_locations to_l on to_l.id = t.to_location_id
            where t.business_unit_id is not null
              and t.status <> 'cancelled'
              and (t.notes_ar is null or t.notes_ar not like ${"%" + LEGACY_MARKER + "%"})
              and (from_l.business_unit_id <> t.business_unit_id
                   or to_l.business_unit_id <> t.business_unit_id)`,
        sql`select t.id, t.transfer_number, t.status,
                   t.business_unit_id as transfer_bu,
                   from_l.business_unit_id as from_bu,
                   to_l.business_unit_id as to_bu
            from transfers t
            join inventory_locations from_l on from_l.id = t.from_location_id
            join inventory_locations to_l on to_l.id = t.to_location_id
            where t.business_unit_id is not null
              and t.status <> 'cancelled'
              and (t.notes_ar is null or t.notes_ar not like ${"%" + LEGACY_MARKER + "%"})
              and (from_l.business_unit_id <> t.business_unit_id
                   or to_l.business_unit_id <> t.business_unit_id)
            limit 5`,
      ),
  },
  {
    name: "delivered-wholesale-has-income",
    description:
      "every delivered wholesale_order must have a matching factory income financial_entry.",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count
            from wholesale_orders wo
            where wo.status = 'delivered'
              and wo.total_minor > 0
              and not exists (
                select 1 from financial_entries fe
                where fe.reference_type = 'wholesale_order'
                  and fe.reference_id = wo.id::text
                  and fe.type = 'income'
                  and fe.business_unit_id = wo.seller_business_unit_id
              )`,
        sql`select wo.id, wo.order_number, wo.total_minor, wo.delivered_at
            from wholesale_orders wo
            where wo.status = 'delivered'
              and wo.total_minor > 0
              and not exists (
                select 1 from financial_entries fe
                where fe.reference_type = 'wholesale_order'
                  and fe.reference_id = wo.id::text
                  and fe.type = 'income'
                  and fe.business_unit_id = wo.seller_business_unit_id
              )
            limit 5`,
      ),
  },
  {
    name: "delivered-wholesale-has-expense",
    description:
      "every delivered wholesale_order must have a matching showroom expense financial_entry.",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count
            from wholesale_orders wo
            where wo.status = 'delivered'
              and wo.total_minor > 0
              and not exists (
                select 1 from financial_entries fe
                where fe.reference_type = 'wholesale_order'
                  and fe.reference_id = wo.id::text
                  and fe.type = 'expense'
                  and fe.business_unit_id = wo.buyer_business_unit_id
              )`,
        sql`select wo.id, wo.order_number, wo.total_minor, wo.delivered_at
            from wholesale_orders wo
            where wo.status = 'delivered'
              and wo.total_minor > 0
              and not exists (
                select 1 from financial_entries fe
                where fe.reference_type = 'wholesale_order'
                  and fe.reference_id = wo.id::text
                  and fe.type = 'expense'
                  and fe.business_unit_id = wo.buyer_business_unit_id
              )
            limit 5`,
      ),
  },
  {
    name: "delivered-wholesale-has-stock-out",
    description:
      "every delivered wholesale_order must have transfer_out ledger entries at the factory location.",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count
            from wholesale_orders wo
            where wo.status = 'delivered'
              and not exists (
                select 1 from inventory_ledger il
                where il.reference_type = 'wholesale_order'
                  and il.reference_id = wo.id::text
                  and il.reason = 'transfer_out'
                  and il.location_id = wo.from_location_id
              )`,
        sql`select wo.id, wo.order_number, wo.delivered_at
            from wholesale_orders wo
            where wo.status = 'delivered'
              and not exists (
                select 1 from inventory_ledger il
                where il.reference_type = 'wholesale_order'
                  and il.reference_id = wo.id::text
                  and il.reason = 'transfer_out'
                  and il.location_id = wo.from_location_id
              )
            limit 5`,
      ),
  },
  {
    name: "delivered-wholesale-has-stock-in",
    description:
      "every delivered wholesale_order must have transfer_in ledger entries at the showroom location.",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count
            from wholesale_orders wo
            where wo.status = 'delivered'
              and not exists (
                select 1 from inventory_ledger il
                where il.reference_type = 'wholesale_order'
                  and il.reference_id = wo.id::text
                  and il.reason = 'transfer_in'
                  and il.location_id = wo.to_location_id
              )`,
        sql`select wo.id, wo.order_number, wo.delivered_at
            from wholesale_orders wo
            where wo.status = 'delivered'
              and not exists (
                select 1 from inventory_ledger il
                where il.reference_type = 'wholesale_order'
                  and il.reference_id = wo.id::text
                  and il.reason = 'transfer_in'
                  and il.location_id = wo.to_location_id
              )
            limit 5`,
      ),
  },
  {
    name: "active-non-priv-users-have-bu",
    description:
      "every active non-privileged staff user must have an assigned_business_unit_id (otherwise they hit BU_REQUIRED on most pages).",
    query: () =>
      countAndSample(
        sql`select count(*)::text as count from users
            where is_active = true
              and role not in ('owner', 'admin', 'customer')
              and assigned_business_unit_id is null`,
        sql`select id, email, role, name_ar
            from users
            where is_active = true
              and role not in ('owner', 'admin', 'customer')
              and assigned_business_unit_id is null
            limit 10`,
      ),
  },
];

async function main(): Promise<void> {
  console.log(
    `${C.bold}${C.cyan}Multi-division audit${C.reset} ${C.dim}(${CHECKS.length} checks)${C.reset}\n`,
  );
  let failed = 0;
  let passed = 0;
  for (const check of CHECKS) {
    process.stdout.write(`${C.dim}…${C.reset} ${check.name} `);
    try {
      const { count, sample } = await check.query();
      if (count === 0) {
        passed++;
        console.log(`${C.green}PASS${C.reset}`);
      } else {
        failed++;
        console.log(
          `${C.red}FAIL${C.reset} ${C.bold}${count}${C.reset} ${C.dim}offending row(s)${C.reset}`,
        );
        console.log(`     ${C.dim}${check.description}${C.reset}`);
        if (sample && sample.length > 0) {
          console.log(`     ${C.yellow}sample:${C.reset}`);
          for (const row of sample) {
            console.log(`       ${JSON.stringify(row)}`);
          }
        }
      }
    } catch (err) {
      failed++;
      console.log(`${C.red}ERROR${C.reset}`);
      console.log(`     ${C.red}${(err as Error).message}${C.reset}`);
    }
  }
  console.log();
  console.log(
    `${C.bold}Summary:${C.reset} ${C.green}${passed} pass${C.reset} • ${
      failed === 0 ? C.green : C.red
    }${failed} fail${C.reset}`,
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
