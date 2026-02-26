-- Add foreign key from InstructorAvailability.instructorId to User.id for referential integrity.
-- Ensures every availability slot references a valid user (instructor).
ALTER TABLE "InstructorAvailability" ADD CONSTRAINT "InstructorAvailability_instructorId_fkey" FOREIGN KEY ("instructorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
