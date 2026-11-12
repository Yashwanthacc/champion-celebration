CREATE TABLE IF NOT EXISTS transportation_confirmations (
  id TEXT PRIMARY KEY,
  attendee_eid TEXT NOT NULL UNIQUE,
  wristband_id TEXT,
  band_serial TEXT,
  confirmed_answer TEXT NOT NULL CHECK (confirmed_answer IN ('YES', 'NO')),
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transportation_confirmations_answer
ON transportation_confirmations (confirmed_answer);

CREATE INDEX IF NOT EXISTS idx_transportation_confirmations_confirmed_at
ON transportation_confirmations (confirmed_at);
