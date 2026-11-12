ALTER TABLE attendee_checkins
ADD COLUMN residence_drop_availing TEXT
CHECK (residence_drop_availing IN ('YES', 'NO') OR residence_drop_availing IS NULL);
