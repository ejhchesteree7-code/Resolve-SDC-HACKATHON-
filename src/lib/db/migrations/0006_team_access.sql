-- Team page: owners can remove access for people who leave.
-- Safe to run more than once; every existing account stays active.
ALTER TABLE users ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
