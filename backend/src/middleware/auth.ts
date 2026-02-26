import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { prisma } from '../db';
import type { JwtPayload, RequestContext } from '../types';
import { AppError } from './errorHandler';
import { v4 as uuidv4 } from 'uuid';

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  const correlationId = (req.headers['x-request-id'] as string) || (req.headers['x-correlation-id'] as string) || uuidv4();
  req.headers['x-correlation-id'] = correlationId;
  req.headers['x-request-id'] = correlationId;

  if (!authHeader?.startsWith('Bearer ')) {
    next(new AppError(401, 'Missing or invalid authorization header', 'UNAUTHORIZED'));
    return;
  }

  const token = authHeader.slice(7);
  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
  } catch {
    next(new AppError(401, 'Invalid or expired token', 'UNAUTHORIZED'));
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, role: true, tenantId: true, approved: true },
  });

  if (!user) {
    next(new AppError(401, 'User not found', 'UNAUTHORIZED'));
    return;
  }

  const context: RequestContext = {
    userId: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    approved: user.approved ?? false,
    correlationId,
  };
  req.context = context;
  next();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  if (!req.context) {
    next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    return;
  }
  next();
}
