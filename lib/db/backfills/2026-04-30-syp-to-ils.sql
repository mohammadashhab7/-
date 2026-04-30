-- Backfill: migrate technical localization from Syria/SYP to Palestine/ILS.
-- Task #20 (الدمشقي / Damascene). Run once per environment after pulling the
-- region-config changes. Idempotent: only updates rows that still hold the
-- old SYP/ل.س values.
--
-- The brand name "الدمشقي" (Damascene) is intentionally NOT touched here —
-- it is a culinary brand identity, not a country indicator. CMS narrative
-- copy (story page, etc.) is also out of scope and may continue to mention
-- Damascus heritage; admins can edit it from the CMS UI if they wish.
--
-- Expected row counts (production snapshot at backfill time):
--   products            ~14
--   raw_materials       ~20
--   payments            depends on history
--   financial_entries   ~174
--   settings            1 (currency_symbol → ₪, country_code → PS)
--
-- This file is a committed audit artifact; the actual UPDATE was executed
-- via psql against $DATABASE_URL during the migration session.

BEGIN;

UPDATE products        SET currency = 'ILS' WHERE currency = 'SYP';
UPDATE raw_materials   SET currency = 'ILS' WHERE currency = 'SYP';
UPDATE payments        SET currency = 'ILS' WHERE currency = 'SYP';
UPDATE financial_entries SET currency = 'ILS' WHERE currency = 'SYP';

-- Settings: flip currency symbol and country only if still on legacy values.
UPDATE settings
   SET currency_symbol = '₪'
 WHERE currency_symbol = 'ل.س';

UPDATE settings
   SET country_code = 'PS'
 WHERE country_code IS NULL OR country_code = 'SY';

-- Drop any lingering Syrian whatsapp default from the seeded sample data.
UPDATE settings
   SET social_whatsapp = '+970592202232'
 WHERE social_whatsapp LIKE '+963%';

COMMIT;

-- Verification queries (run manually):
--   SELECT currency, COUNT(*) FROM products         GROUP BY currency;
--   SELECT currency, COUNT(*) FROM raw_materials    GROUP BY currency;
--   SELECT currency, COUNT(*) FROM financial_entries GROUP BY currency;
--   SELECT country_code, currency_symbol, social_whatsapp FROM settings;
