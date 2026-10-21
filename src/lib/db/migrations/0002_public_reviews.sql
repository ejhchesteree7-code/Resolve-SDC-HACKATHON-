-- Additive only: existing review and audit values are left untouched.
BEGIN;
ALTER TABLE resolve_reviews ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'simulated';
ALTER TABLE resolve_reviews ADD COLUMN IF NOT EXISTS final_reply text;
COMMIT;
