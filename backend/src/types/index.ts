import { Role } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  role: Role;
  tenantId: string | null;
  approved?: boolean;
  iat?: number;
  exp?: number;
};

export type RequestContext = {
  userId: string;
  email: string;
  role: Role;
  tenantId: string | null;
  approved: boolean;
  correlationId?: string;
};

declare global {
  namespace Express {
    interface Request {
      context?: RequestContext;
    }
  }
}
