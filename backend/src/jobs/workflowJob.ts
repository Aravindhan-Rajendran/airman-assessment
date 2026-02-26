import { prisma } from '../db';
import { config } from '../config';

const ESCALATION_HOURS = config.workflow.escalationHours;

export async function runWorkflowEscalation(): Promise<void> {
  const cutoff = new Date();
  cutoff.setHours(cutoff.getHours() - ESCALATION_HOURS);

  const pending = await prisma.booking.findMany({
    where: {
      status: 'REQUESTED',
      requestedAt: { lt: cutoff },
      instructorId: null,
    },
    include: { tenant: true, student: { select: { email: true } } },
  });

  for (const booking of pending) {
    try {
      console.log(
        `[WORKFLOW] Escalating booking ${booking.id} to Admin (no instructor assigned within ${ESCALATION_HOURS}h). Tenant: ${booking.tenant.name}, Student: ${booking.student.email}`
      );
      await prisma.auditLog.create({
        data: {
          tenantId: booking.tenantId,
          userId: null,
          action: 'ESCALATE',
          resource: 'SCHEDULE',
          resourceId: booking.id,
          afterState: JSON.stringify({
            reason: 'No instructor assigned within threshold',
            requestedAt: booking.requestedAt,
            escalationHours: ESCALATION_HOURS,
          }),
        },
      });
    } catch (err) {
      console.error(`[WORKFLOW] Failed to escalate booking ${booking.id}:`, err);
    }
  }
}

export async function runWithRetry(
  fn: () => Promise<void>,
  maxAttempts = 3
): Promise<void> {
  let lastError: Error | null = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await fn();
      return;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  if (lastError) throw lastError;
}
