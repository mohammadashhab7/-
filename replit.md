# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## الدمشقي (Damascene) v1

Single integrated ERP+POS+e-commerce app for an Arabic/RTL Damascene sweets brand.

- **Public site** at `/` — Apple-style luxury aesthetic, browse + checkout (COD functional, Stripe/PayPal scaffolded).
- **Admin/POS** at `/admin` — 16 pages: dashboard, products, categories, raw materials, recipes, inventory, production, transfers, POS, daily closing, orders, dual-book financials (production + store), reports, employees, users, CMS, settings.

### Two-division model (المشغل / المعرض)

The business is organized into two explicit divisions, derived from existing `inventory_locations.kind`:

- **المشغل (Workshop)** — `production_raw` + `production_finished` locations. Holds raw materials, runs production orders, books raw-material expenses to the `production` financial book.
- **المعرض (Store)** — `store` locations. Sells via POS + online, books revenue/expenses to the `store` financial book.
- A shared helper `lib/division.ts` (frontend) maps `kind → "workshop" | "store"` and provides `DIVISION_LABEL_AR`. No new DB column — purely derived.

UI surfaces:
- **Dashboard** (`/admin`) shows three tabs: الكل / المشغل / المعرض. The All tab shows everything; Workshop tab shows only production KPIs (open production orders, monthly production count, monthly raw-material expense, low-stock raw materials); Store tab shows only sales KPIs and chart. Low-stock alerts always render.
- **Financials** (`/admin/financials`) labels the existing `module` filter as "القسم" with options "المعرض" / "المشغل".
- **Reports** (`/admin/reports`) uses the same المشغل/المعرض terminology in headings.

### Multi-division (Factory + multiple Showrooms)

On top of the two-division model above, every transactional table now carries a `business_unit_id` that points at one row in the `business_units` table (kinds: `factory` or `showroom`). One factory + N showrooms; the catalog (products, raw materials, recipes) stays shared.

- **Frontend**: `BusinessUnitProvider` + `<DivisionSwitcher>` let owner/admin pick the active BU (or "all divisions"); non-privileged users are pinned to their `users.assignedBusinessUnitId`. The active BU is persisted in localStorage and sent on every API call as the `X-Business-Unit-Id` header. Route-level guards (`<DivisionRoute kind="factory|showroom">` in `App.tsx`) wrap factory-only pages (`/admin/raw-materials`, `/admin/recipes`, `/admin/production`, `/admin/wholesale-orders`) and showroom-only pages (`/admin/pos`, `/admin/daily-closing`); non-privileged users with the wrong-kind BU are redirected to `/admin/unauthorized`. Owner/admin **always pass** the guard regardless of which BU they currently have selected.
- **Backend**: `lib/businessUnit.ts → getActiveBusinessUnit(req)` resolves the active BU from the header (or assigned BU). All BU-scoped admin handlers — reports, dashboard KPIs/recent-activity, sales-orders, production, transfers, inventory, employees, financial, wholesale-orders, pos, daily-closings — call it and add a `where business_unit_id = $bu` filter. Recent-activity is **strictly per-BU** for scoped users (no NULL/global leakage); cross-BU events like wholesale invoices are tagged with the seller's BU so they appear in the seller's feed. A dev-mode middleware in `routes/index.ts` warns when a known BU-scoped GET returns success without consulting `getActiveBusinessUnit` (catches future regressions).
- **POS routing**: `lib/inventory.ts → getActiveStoreLocation(buId)` returns the `kind=store` location for the given BU (each showroom has its own store-kind location). `createSalesOrderInternal` reads the cashier's active BU from the request and routes the stock-out (and on cancel/refund, the restore) to the right showroom. Online checkout still falls back to the legacy "STORE" location for back-compat.
- **Factory → Showroom** is **direct sales**, not a stock transfer. Use `wholesale_orders` (`/admin/wholesale-orders`): when a confirmed wholesale order is delivered, one DB transaction writes four legs — factory income (`module=production`, BU=seller), showroom expense (`module=store`, BU=buyer), factory stock-out at the source location, showroom stock-in at the destination. Plain `transfers` are blocked from completing across BU boundaries with `USE_WHOLESALE_INVOICE` (defense in depth). **Known gap (follow-up Task #30):** cancelling a *delivered* wholesale order is not yet implemented — `POST /wholesale-orders/:id/cancel` returns 409 `CANNOT_CANCEL_DELIVERED`. Until #30 lands, operators reverse a delivered wholesale manually via financial adjustments. Cancelling `draft` or `confirmed` orders works (no side-effects to undo).
- **Activity log**: `activity_log.business_unit_id` is populated by `logActivity()` from the source row's BU. Wholesale events (create/confirm/deliver/cancel) are tagged with the **seller's** BU. Recent-activity shows only rows tagged with the active BU for scoped users; privileged users on the global view see everything.
- **Audit**: `pnpm audit:multi-division` (script in `scripts/src/audit-multi-division.ts`) runs 10 read-only data-integrity checks (BU not-null on transactional tables, ledger location matches order BU, production BU is `factory`, transfers are intra-BU, every delivered wholesale has the four expected legs, every active staff user has an assigned BU). Run after any schema or routing change. Legacy cross-BU transfer rows (pre-Task #25) are exempted via the `[LEGACY_CROSS_BU_PRE_WHOLESALE]` marker prepended to `notes_ar` — see `lib/db/backfills/2026-05-02-legacy-cross-bu-transfers.sql`.

### Transfers lifecycle

The `transfers` table now carries a `status` enum: `pending | approved | completed | cancelled` (defaults to `completed` for back-compat with the immediate-execute path). Stock movement only happens on transition to `completed` — pending/approved transfers do **not** touch `stock_levels` or write to `inventory_ledger`. Snapshotted `unit_cost_minor` is recorded on create.

API:
- `POST /api/transfers` — accepts `executeImmediately` (legacy default true) or explicit `status: "pending"` to create a request.
- `POST /api/transfers/:id/approve` — pending → approved.
- `POST /api/transfers/:id/complete` — approved/pending → completed (writes ledger + stock here).
- `POST /api/transfers/:id/cancel` — pending/approved → cancelled.

Activity feed kinds added: `transfer_requested`, `transfer_approved`, `transfer_cancelled`.

### Number formatting (Latin digits + Arabic text)

`artifacts/damascene/src/lib/format.ts` was switched to use `en-US` for `Intl.NumberFormat` (digits, currency) and `ar-PS-u-nu-latn` for dates. All numeric display in the app — KPIs, prices, charts, invoices, table cells — renders Latin `0–9` (e.g. `180,000 ₪`), while body text and headings remain Arabic. Hand-written CMS narrative copy (e.g. the `/story` page year `١٩٧٢`) is intentionally preserved as authored.
- **Customer account** at `/account` — orders history.
- **Auth**: Clerk (StaffRoute / CustomerRoute guards via `useUser` claims).
- **API**: Express at `/api`, single Postgres DB, Drizzle ORM. All hooks generated by Orval (`@workspace/api-client-react`).
- **Currency**: ILS (₪) minor units. Inventory qty stored in thousandths (×1000). No emojis anywhere.
- **Region defaults**: country `PS`, currency `ILS`, currency symbol `₪`, locale `ar-PS`. Centralised in `artifacts/api-server/src/lib/region.ts` (overridable via env vars `COUNTRY`, `CURRENCY`, `CURRENCY_SYMBOL`, `LOCALE`) and `artifacts/damascene/src/lib/format.ts`. Admin can change the country and currency symbol at runtime from `/admin/settings`.
- Heavy seed data in `artifacts/api-server/src/seed.ts`: 3 locations, 8 categories, 14 products, 20 raw materials, 14 recipes, 11 employees, ~192 sample orders, 3 months of expenses.

### Bootstrap (Super Admin)

Auth is delegated to **Clerk**, so credentials are not stored in this database and cannot be seeded as a static username/password. The acceptance criterion "ship a Super Admin" is satisfied by the following deterministic, self-serve bootstrap flow (explicitly approved as the v1 contract because Clerk-managed credentials cannot be database-seeded):

1. Operator opens the app and clicks "إنشاء حساب" (Sign up) → uses any email they own.
2. `lib/auth.ts → loadAppUser()` checks `users WHERE role='owner'` — if zero rows, the new user is inserted with `role='owner'` and full permissions; otherwise they are inserted as `customer`.
3. The owner can then promote/demote any user from `/admin/users`.

To make this explicit and testable:
- `GET /api/bootstrap-status` (public) returns `{ hasOwner: boolean, bootstrapMessageAr, bootstrapMessageEn }`.
- The `/sign-in` page renders a prominent banner (`data-testid="banner-bootstrap"`) when `hasOwner` is `false`, telling the operator that the next sign-up will become the Super Admin.
- The seed script prints the same instructions at the end of its run.

This means there is exactly one well-defined, surfaced path to obtain the Super Admin, and any operator (or QA) can determine programmatically whether the bootstrap is still pending.

### Inventory model

`inventory_ledger` is the **append-only event log** (source of truth). `stock_levels` is a **transactional projection** of `SUM(quantity_delta_thousandths)` per `(location, item)`, maintained inside the same transaction as the ledger insert by `lib/inventory.ts → applyLedgerEntry` (using `SELECT ... FOR UPDATE` for race-safe decrements). Stock is therefore always equal to the ledger sum; the projection only exists for read performance and concurrency-safe stock checks. The endpoint `GET /api/inventory/stock-from-ledger` does a `FULL OUTER JOIN` between the ledger sum and the projection and reports any drift in either direction (drift should always be zero).

### Payments activation

Out of the box, COD / Cash / Bank transfer / Card terminal payment methods work end-to-end. **Stripe** and **PayPal** are scaffolded as adapters in `artifacts/api-server/src/routes/payments.ts` and remain inert until their credentials are configured:

| Provider | Required env vars                          | Activation check                     |
|----------|--------------------------------------------|--------------------------------------|
| Stripe   | `STRIPE_SECRET_KEY` (+ `STRIPE_PUBLIC_KEY` for client) | `adapters.stripe.isActive()` returns true when `STRIPE_SECRET_KEY` is set |
| PayPal   | `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`        | `adapters.paypal.isActive()` returns true when both are set |

When credentials are missing, the adapter returns a `not_required` payment record with `providerActive: false` and the order remains in `pending_payment` so staff can mark it succeeded manually from `/admin/orders` after off-platform settlement. Once credentials are added (Replit Secrets), the same code path issues real intent IDs — no feature flag needed; activation is automatic on the next request. To switch a deployment fully online, also wire each provider's webhook to the `PATCH /api/payments/:id/mark-succeeded` endpoint (or implement a dedicated webhook route) so paid online orders post revenue automatically.
