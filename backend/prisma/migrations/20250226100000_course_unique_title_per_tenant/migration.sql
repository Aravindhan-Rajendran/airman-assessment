-- Drop non-unique index and add unique constraint on course title per tenant
-- Remove duplicates first (keep row with smallest id per tenantId+title)
DELETE FROM "Course" a
USING "Course" b
WHERE a.id > b.id AND a."tenantId" = b."tenantId" AND a.title = b.title;
DROP INDEX IF EXISTS "Course_tenantId_title_idx";
CREATE UNIQUE INDEX "Course_tenantId_title_key" ON "Course"("tenantId", "title");
