-- Keep FSRS training/config data only in fsrs-ai service schema/database.
-- Remove duplicated FSRS persistence from learn service.

DROP TABLE IF EXISTS "ReviewLog" CASCADE;
DROP TABLE IF EXISTS "UserFSRSSetting" CASCADE;
