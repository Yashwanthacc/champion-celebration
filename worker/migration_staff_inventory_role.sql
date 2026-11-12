CREATE TABLE staff_users_new (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('admin', 'registration', 'inventory', 'checkin', 'viewer')
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO staff_users_new
SELECT id, staff_id, password_hash, role, is_active, created_at, updated_at
FROM staff_users;

DROP TABLE staff_users;
ALTER TABLE staff_users_new RENAME TO staff_users;

CREATE INDEX idx_staff_users_active ON staff_users (staff_id, is_active);
