
CREATE TABLE IF NOT EXISTS staff_users (
  id TEXT PRIMARY KEY,
  staff_id TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (
    role IN ('admin', 'registration', 'checkin', 'viewer')
  ),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (
    is_active IN (0, 1)
  ),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_users_active
ON staff_users (staff_id, is_active);


CREATE TABLE IF NOT EXISTS staff_sessions (
  id_hash TEXT PRIMARY KEY,
  staff_user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (staff_user_id) REFERENCES staff_users(id)
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_staff_sessions_expiry
ON staff_sessions (expires_at);
  
  CREATE TABLE IF NOT EXISTS attendees (
    eid TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    department TEXT NOT NULL,
    status TEXT NOT NULL
        CHECK (status IN ('Registered', 'Pending', 'Cancelled')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);