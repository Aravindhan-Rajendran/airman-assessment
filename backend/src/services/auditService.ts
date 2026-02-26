import { prisma } from '../db';

export type AuditLogInput = {
  userId?: string;
  tenantId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  beforeState?: string;
  afterState?: string;
  correlationId?: string;
};

export const auditService = {
  async log(input: AuditLogInput): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        tenantId: input.tenantId ?? null,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId ?? null,
        beforeState: input.beforeState ?? null,
        afterState: input.afterState ?? null,
        correlationId: input.correlationId ?? null,
      },
    });
  },
};
