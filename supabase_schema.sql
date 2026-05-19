-- ═══════════════════════════════════════════════════════════════
-- OpCertMS — Supabase Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- ── EMPLOYEES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS employees (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  dept        TEXT DEFAULT '',
  pos         TEXT DEFAULT '',
  dob         TEXT DEFAULT '',
  join_date   TEXT DEFAULT '',
  phone       TEXT DEFAULT '',
  status      TEXT DEFAULT 'Active',
  email       TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── EMPLOYEE PHOTOS (separate — large base64) ──────────────────
CREATE TABLE IF NOT EXISTS employee_photos (
  emp_id      TEXT PRIMARY KEY REFERENCES employees(id) ON DELETE CASCADE,
  photo       TEXT,  -- base64 data URL
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── DEPARTMENTS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS departments (
  id          SERIAL PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  code        TEXT DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── PROCESSES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS processes (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  cat         TEXT DEFAULT '',
  vl          INTEGER DEFAULT 12,  -- validity months
  description TEXT DEFAULT '',
  status      TEXT DEFAULT 'Active',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── CERTIFICATES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS certificates (
  id          TEXT PRIMARY KEY,
  emp_id      TEXT NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  emp_name    TEXT NOT NULL,
  proc_id     TEXT NOT NULL REFERENCES processes(id) ON DELETE CASCADE,
  proc_name   TEXT NOT NULL,
  level       TEXT NOT NULL,
  issue_date  TEXT NOT NULL,
  expiry_date TEXT NOT NULL,
  issued_by   TEXT DEFAULT 'Admin',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── APP CONFIG ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS app_config (
  key         TEXT PRIMARY KEY,
  value       TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default config
INSERT INTO app_config (key, value) VALUES
  ('company',    'TTI Group | AES'),
  ('warn_days',  '30'),
  ('sys_title',  'Operation Certificate Management System'),
  ('cert_ctr',   '0'),
  ('sp_url',     ''),
  ('sp_nm',      'id_dept_name'),
  ('sp_ext',     'jpg'),
  ('sp_cp',      '')
ON CONFLICT (key) DO NOTHING;

-- Insert default departments
INSERT INTO departments (name, code) VALUES
  ('Production',       'PRD'),
  ('Quality Control',  'QC'),
  ('Maintenance',      'MNT'),
  ('Engineering',      'ENG'),
  ('Warehouse',        'WHS'),
  ('HSE',              'HSE'),
  ('Training',         'TRN'),
  ('Administration',   'ADM')
ON CONFLICT (name) DO NOTHING;

-- ── ROW LEVEL SECURITY ─────────────────────────────────────────
-- Enable RLS on all tables
ALTER TABLE employees          ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_photos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments        ENABLE ROW LEVEL SECURITY;
ALTER TABLE processes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_config         ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (app handles auth itself)
CREATE POLICY "allow_all_employees"       ON employees       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_photos"          ON employee_photos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_departments"     ON departments     FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_processes"       ON processes       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_certificates"    ON certificates    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_config"          ON app_config      FOR ALL USING (true) WITH CHECK (true);

-- ── INDEXES ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_certs_emp_id   ON certificates(emp_id);
CREATE INDEX IF NOT EXISTS idx_certs_proc_id  ON certificates(proc_id);
CREATE INDEX IF NOT EXISTS idx_certs_expiry   ON certificates(expiry_date);
CREATE INDEX IF NOT EXISTS idx_emps_dept      ON employees(dept);
CREATE INDEX IF NOT EXISTS idx_emps_status    ON employees(status);

-- ── UPDATED_AT TRIGGER ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_employees_updated   BEFORE UPDATE ON employees   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_processes_updated   BEFORE UPDATE ON processes   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_certificates_updated BEFORE UPDATE ON certificates FOR EACH ROW EXECUTE FUNCTION update_updated_at();
