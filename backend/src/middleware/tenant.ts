import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function requireTenant(req: Request, _res: Response, next: NextFunction): void {
  if (!req.context) {
    next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    return;
  }
  if (!req.context.tenantId) {
    next(new AppError(403, 'Tenant context required', 'TENANT_REQUIRED'));
    return;
  }
  next();
}

export function ensureTenantAccess(tenantId: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
      return;
    }
    if (req.context.tenantId !== tenantId) {
      next(new AppError(403, 'Access denied to this tenant', 'FORBIDDEN_TENANT'));
      return;
    }
    next();
  };
}
