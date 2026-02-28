import { prisma } from '../db';
import { AppError } from '../middleware/errorHandler';

export async function hasBookingConflict(
  tenantId: string,
  instructorId: string | null,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: string
): Promise<boolean> {
  if (!instructorId) return false;
  const overlapping = await prisma.booking.findFirst({
    where: {
      tenantId,
      instructorId,
      status: { notIn: ['CANCELLED'] },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  return !!overlapping;
}

export async function assertNoInstructorConflict(
  tenantId: string,
  instructorId: string,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: string
): Promise<void> {
  const conflict = await hasBookingConflict(tenantId, instructorId, startAt, endAt, excludeBookingId);
  if (conflict) {
    throw new AppError(409, 'Instructor is already booked for this time slot', 'BOOKING_CONFLICT');
  }
}

/** True if the instructor has at least one availability slot overlapping [startAt, endAt]. */
export async function instructorHasAvailability(
  tenantId: string,
  instructorId: string,
  startAt: Date,
  endAt: Date
): Promise<boolean> {
  const slot = await prisma.instructorAvailability.findFirst({
    where: {
      tenantId,
      instructorId,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
  });
  return !!slot;
}
