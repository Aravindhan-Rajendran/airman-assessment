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

export const createCourseSchema = z.object({
  title: z.string().min(1, 'Course title is required'),
  description: z.string().optional(),
});
export type CreateCourseFormData = z.infer<typeof createCourseSchema>;

export const createModuleSchema = z.object({
  title: z.string().min(1, 'Module title is required'),
  order: z.coerce.number().int().min(0).optional(),
});
export type CreateModuleFormData = z.infer<typeof createModuleSchema>;

export const createLessonSchema = z.object({
  title: z.string().min(1, 'Lesson title is required'),
  type: z.enum(['TEXT', 'QUIZ'], { required_error: 'Select lesson type' }),
  content: z.string().optional(),
  order: z.coerce.number().int().min(0).optional(),
});
export type CreateLessonFormData = z.infer<typeof createLessonSchema>;

const quizOptionSchema = z.object({ id: z.string(), text: z.string().min(1) });
const quizQuestionSchema = z.object({
  id: z.string(),
  text: z.string().min(1, 'Question text is required'),
  options: z.array(quizOptionSchema).min(4, 'Each question must have at least 4 options'),
  correctOptionId: z.string().min(1, 'Select exactly one correct option'),
});
export const createQuizContentSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1, 'Add at least one question'),
});
export type CreateQuizContentFormData = z.infer<typeof createQuizContentSchema>;
