import { z } from 'zod';

const requiredMsg = 'This field is required';

export const loginSchema = z.object({
  tenantId: z.string().min(1, 'Please select your school'),
  email: z
    .string()
    .min(1, requiredMsg)
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

function parseDateTimeLocal(value: string): Date | null {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const bookingRequestSchema = z
  .object({
    requestedAt: z.string().min(1, 'Request date & time is required'),
    startAt: z.string().min(1, 'Preferred start is required'),
    endAt: z.string().min(1, 'Preferred end is required'),
  })
  .refine(
    (data) => {
      const d = parseDateTimeLocal(data.requestedAt);
      return d !== null;
    },
    { message: 'Invalid request date or time', path: ['requestedAt'] }
  )
  .refine(
    (data) => {
      const d = parseDateTimeLocal(data.startAt);
      return d !== null;
    },
    { message: 'Invalid start date or time', path: ['startAt'] }
  )
  .refine(
    (data) => {
      const d = parseDateTimeLocal(data.endAt);
      return d !== null;
    },
    { message: 'Invalid end date or time', path: ['endAt'] }
  )
  .refine(
    (data) => {
      const start = parseDateTimeLocal(data.startAt);
      const end = parseDateTimeLocal(data.endAt);
      return start !== null && end !== null && end.getTime() > start.getTime();
    },
    { message: 'Preferred end must be after preferred start', path: ['endAt'] }
  )
  .refine(
    (data) => {
      const req = parseDateTimeLocal(data.requestedAt);
      const start = parseDateTimeLocal(data.startAt);
      return req !== null && start !== null && start.getTime() >= req.getTime();
    },
    { message: 'Preferred start cannot be before the request time', path: ['startAt'] }
  );

export type BookingRequestFormData = z.infer<typeof bookingRequestSchema>;

export const availabilitySchema = z
  .object({
    startAt: z.string().min(1, 'Start date & time is required'),
    endAt: z.string().min(1, 'End date & time is required'),
  })
  .refine(
    (data) => {
      const start = parseDateTimeLocal(data.startAt);
      const end = parseDateTimeLocal(data.endAt);
      return start !== null && end !== null && end.getTime() > start.getTime();
    },
    { message: 'End time must be after start time', path: ['endAt'] }
  );

export type AvailabilityFormData = z.infer<typeof availabilitySchema>;
