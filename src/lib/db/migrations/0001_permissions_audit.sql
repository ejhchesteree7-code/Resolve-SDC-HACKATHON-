-- Development schema migration. Preserve existing reviews and audit records.
BEGIN;
CREATE TABLE IF NOT EXISTS tenants (
  id text PRIMARY KEY,
  manager_voucher_limit_rm real NOT NULL DEFAULT 20 CHECK (manager_voucher_limit_rm >= 0)
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  role text NOT NULL CHECK (role IN ('Staff', 'Manager', 'Owner')),
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_id text NOT NULL
);
ALTER TABLE resolve_reviews ADD COLUMN IF NOT EXISTS tenant_id text NOT NULL DEFAULT 'resolve-demo';
ALTER TABLE resolve_reviews ADD COLUMN IF NOT EXISTS outlet_id text;
UPDATE resolve_reviews SET outlet_id = outlet WHERE outlet_id IS NULL;
ALTER TABLE resolve_reviews ALTER COLUMN outlet_id SET NOT NULL;
ALTER TABLE resolve_reviews ALTER COLUMN outlet_id SET DEFAULT 'Brew & Kin — Bangsar';
DO $$
BEGIN
  IF to_regclass('public.activity_log') IS NULL THEN
    ALTER TABLE resolve_activity RENAME TO activity_log;
  END IF;
END $$;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS sequence bigserial;
ALTER TABLE activity_log ALTER COLUMN sequence SET NOT NULL;
CREATE OR REPLACE FUNCTION reject_activity_log_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'activity_log is append-only: UPDATE and DELETE are forbidden';
END;
$$;
DROP TRIGGER IF EXISTS activity_log_immutable ON activity_log;
CREATE TRIGGER activity_log_immutable
BEFORE UPDATE OR DELETE ON activity_log
FOR EACH ROW EXECUTE FUNCTION reject_activity_log_mutation();
COMMIT;
