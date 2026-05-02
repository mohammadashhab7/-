-- Backfill: tag legacy cross-BU transfers as historical so the multi-division
-- audit (`pnpm audit:multi-division`) skips them.
--
-- Background: before Task #25 introduced the wholesale-invoice requirement,
-- factory→showroom stock movements were logged as plain `transfers` rows.
-- Those rows are still in the DB and the inventory_ledger entries they wrote
-- reflect real stock movements that we don't want to reverse. The new code
-- (artifacts/api-server/src/routes/transfers.ts) blocks any further cross-BU
-- transfer completion with USE_WHOLESALE_INVOICE, so this is a one-shot
-- historical cleanup — no recurring concern.
--
-- Strategy: leave the row data intact (preserves audit trail and stock
-- ledger), prepend a marker to notes_ar so the audit script can identify
-- and skip these rows. Idempotent — re-running this file is a no-op.
update transfers t
set notes_ar = '[LEGACY_CROSS_BU_PRE_WHOLESALE] ' || coalesce(notes_ar, '')
from inventory_locations from_l, inventory_locations to_l
where from_l.id = t.from_location_id
  and to_l.id = t.to_location_id
  and t.business_unit_id is not null
  and t.status <> 'cancelled'
  and (t.notes_ar is null or t.notes_ar not like '%[LEGACY_CROSS_BU_PRE_WHOLESALE]%')
  and (from_l.business_unit_id <> t.business_unit_id
       or to_l.business_unit_id <> t.business_unit_id);
