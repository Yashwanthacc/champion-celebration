# Champion Celebration attendee form update

## Included changes
- Add Attendee now uses Project instead of Department and no longer exposes a registration-status selector.
- New attendee records default internally to `Registered` so existing wristband assignment/check-in eligibility logic remains compatible.
- MyPMO lookup fills name, email, project, editable employee contact number, and People Lead when available.
- Added required emergency and colleague contact inputs.
- Backend persists the added fields on create and preserves them when the legacy edit form does not submit them.
- Common garbled arrow/icon text in the UI was replaced with readable Unicode symbols.

## Important migration safety
The migration at `worker/migration_attendee_fields.sql` uses `ALTER TABLE ... ADD COLUMN` and must be run only if those columns are not already present. Do not blindly rerun it: SQLite/D1 will report an error if a column already exists. It is additive and does not intentionally delete records.

## Local verification
From this folder in PowerShell:

```powershell
npm ci
npm run build
npm run lint
```

Before using the updated backend, check the local D1 schema with:

```powershell
npx wrangler d1 execute champion-celebration-local --local --command "PRAGMA table_info(attendees)"
```

Only if the six migration columns (`full_name`, `contact_number`, `family_emergency_contact_number`, `colleague_emergency_contact_number`, `project`, `project_lead`) are all absent, apply:

```powershell
npx wrangler d1 execute champion-celebration-local --local --file=worker/migration_attendee_fields.sql
```

If some but not all columns already exist, do not run the whole migration; add only the missing columns after reviewing the PRAGMA output. Keep the original project and database backup until local tests pass. Do not deploy as part of this update.

## Validation status
The source and backend were updated in this package. A full build/lint could not be completed in the authoring environment because dependency installation timed out; run the commands above locally before switching the app over.
