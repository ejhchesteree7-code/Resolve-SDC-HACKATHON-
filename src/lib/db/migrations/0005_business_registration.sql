-- Step 2 of the Final upgrade: businesses register themselves.
-- Each outlet gets its own public review link (/p/<slug>) from this table
-- instead of from code. Safe to run more than once; keeps all existing data.
BEGIN;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'cafe';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS google_place_id text;

CREATE TABLE IF NOT EXISTS outlets (
  slug text PRIMARY KEY,
  tenant_id text NOT NULL REFERENCES tenants(id),
  outlet_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outlets_tenant_idx ON outlets (tenant_id);

INSERT INTO outlets (slug, tenant_id, outlet_name, created_at) VALUES
  ('bangsar', 'resolve-demo', 'Brew & Kin — Bangsar', '2026-10-01T00:00:00Z'),
  ('mont-kiara', 'resolve-demo', 'Brew & Kin — Mont Kiara', '2026-10-01T00:00:01Z')
ON CONFLICT (slug) DO NOTHING;

-- Same protection as the other tables (Supabase): only the server reaches this table.
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;

COMMIT;
