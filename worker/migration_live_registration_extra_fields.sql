-- Add the four additional live-registration fields.
-- Apply this migration once to the local D1 database before testing submissions.
ALTER TABLE attendees ADD COLUMN residential_address TEXT;
ALTER TABLE attendees ADD COLUMN colleague_enterprise_id TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_name TEXT;
ALTER TABLE attendees ADD COLUMN family_emergency_contact_relation TEXT;
