-- Step 1 of the Final upgrade: real (simulated) logins.
-- Safe to run more than once. Keeps every existing review and audit record.
-- Demo accounts all use the synthetic password: resolve-demo
BEGIN;

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_unique ON users (lower(email));

UPDATE tenants SET name = 'Brew & Kin' WHERE id = 'resolve-demo';

UPDATE users SET name = 'Alicia Wong', email = 'owner@brewkin.demo',
  password_hash = 'scrypt$BljmdIbUjF0J0aC3y13b3g$CGT7_O6hU8xkA1sZvZJEzkgQ9caS85-Y3Dqc1LtuLk8'
  WHERE id = 'demo-owner';
UPDATE users SET name = 'Hafiz Rahman', email = 'manager@brewkin.demo',
  password_hash = 'scrypt$DflLkx1jriR-ZcbvLR0tgQ$vsxx8G39s8XqvvP1U3C4fH1Lxzzi2F-wBLi04OESZQg'
  WHERE id = 'demo-manager';
UPDATE users SET name = 'Siti Nur', email = 'staff@brewkin.demo',
  password_hash = 'scrypt$y3WLse1kVNYppQYSWipxwA$gxdvSzY6V701t-nuTpMXTRbL4kSiuDc_dbfO3NHGbqs'
  WHERE id = 'demo-staff';

COMMIT;
