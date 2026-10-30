-- WOW feature: the Improvement Checklist. Safe to run more than once.
CREATE TABLE IF NOT EXISTS improvements (
  id text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  category text NOT NULL,
  outlet text,
  title text NOT NULL,
  evidence text NOT NULL,
  source text NOT NULL,
  status text NOT NULL DEFAULT 'suggested',
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_by text,
  done_at timestamptz,
  note text
);
CREATE INDEX IF NOT EXISTS improvements_tenant_idx ON improvements (tenant_id);
-- Same rule as every other table: no public access, only the server connects.
ALTER TABLE improvements ENABLE ROW LEVEL SECURITY;
