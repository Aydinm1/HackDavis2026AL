-- AlterTable
ALTER TABLE "CalendarConnection" ADD COLUMN "accessRole" TEXT;
ALTER TABLE "CalendarConnection" ADD COLUMN "calendarBackgroundColor" TEXT;
ALTER TABLE "CalendarConnection" ADD COLUMN "calendarDescription" TEXT;
ALTER TABLE "CalendarConnection" ADD COLUMN "calendarSummary" TEXT;
ALTER TABLE "CalendarConnection" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CalendarConnection" ADD COLUMN "isSelected" BOOLEAN NOT NULL DEFAULT true;

-- Backfill existing primary Google connection metadata.
UPDATE "CalendarConnection"
SET "isPrimary" = true,
    "isSelected" = true,
    "calendarSummary" = COALESCE("calendarSummary", 'Primary calendar')
WHERE "provider" = 'google'
  AND "calendarId" = 'primary';
