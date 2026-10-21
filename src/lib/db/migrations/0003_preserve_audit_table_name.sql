-- Development only. Publish applies the resulting schema diff to production.
-- Restore the existing production name without copying, dropping or deleting audit rows.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.resolve_activity') IS NULL THEN
    IF to_regclass('public.activity_log') IS NULL THEN
      RAISE EXCEPTION 'No existing audit table found; refusing to create an empty replacement';
    END IF;
    ALTER TABLE public.activity_log RENAME TO resolve_activity;
  ELSIF to_regclass('public.activity_log') IS NOT NULL THEN
    RAISE EXCEPTION 'Both audit tables exist; refusing to merge or discard audit history';
  END IF;
  IF to_regclass('public.activity_log_sequence_seq') IS NOT NULL
     AND to_regclass('public.resolve_activity_sequence_seq') IS NULL THEN
    ALTER SEQUENCE public.activity_log_sequence_seq RENAME TO resolve_activity_sequence_seq;
  END IF;
  -- Preserve its counter and column default, but expose it as an explicit
  -- sequence rather than an implicit serial so Publish includes the default.
  ALTER SEQUENCE public.resolve_activity_sequence_seq OWNED BY NONE;
END $$;
COMMIT;
