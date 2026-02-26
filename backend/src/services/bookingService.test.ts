import { hasBookingConflict, assertNoInstructorConflict } from './bookingService';

jest.mock('../db', () => ({
  prisma: {
    booking: {
      findFirst: jest.fn(),
    },
  },
}));

const { prisma } = require('../db');

describe('bookingService', () => {
  const tenantId = 'test-tenant-id';
  const instructorId = 'instructor-1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('hasBookingConflict', () => {
    it('returns false when no bookings exist', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
      const result = await hasBookingConflict(
        tenantId,
        instructorId,
        new Date('2025-03-01T10:00:00Z'),
        new Date('2025-03-01T11:00:00Z')
      );
      expect(result).toBe(false);
      expect(prisma.booking.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tenantId, instructorId }),
        })
      );
    });

    it('returns true when instructor has overlapping booking', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({ id: 'b1' });
      const conflict = await hasBookingConflict(
        tenantId,
        instructorId,
        new Date('2025-03-01T10:30:00Z'),
        new Date('2025-03-01T11:30:00Z')
      );
      expect(conflict).toBe(true);
    });

    it('returns false when excludeBookingId is passed and only match is that booking', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
      const conflict = await hasBookingConflict(
        tenantId,
        instructorId,
        new Date('2025-03-02T10:30:00Z'),
        new Date('2025-03-02T11:30:00Z'),
        'booking-123'
      );
      expect(conflict).toBe(false);
    });
  });

  describe('assertNoInstructorConflict', () => {
    it('throws when conflict exists', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue({ id: 'b1' });
      await expect(
        assertNoInstructorConflict(
          tenantId,
          instructorId,
          new Date('2025-03-01T10:00:00Z'),
          new Date('2025-03-01T11:00:00Z')
        )
      ).rejects.toMatchObject({ statusCode: 409, code: 'BOOKING_CONFLICT' });
    });

    it('does not throw when no conflict', async () => {
      (prisma.booking.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        assertNoInstructorConflict(
          tenantId,
          instructorId,
          new Date('2025-03-01T10:00:00Z'),
          new Date('2025-03-01T11:00:00Z')
        )
      ).resolves.toBeUndefined();
    });
  });
});
