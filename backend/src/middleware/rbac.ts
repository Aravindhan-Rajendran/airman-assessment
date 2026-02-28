import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AppError } from './errorHandler';

type Permission = 
  | 'admin:create_instructor'
  | 'admin:approve_student'
  | 'instructor:create_content'
  | 'instructor:assign_quizzes'
  | 'instructor:accept_booking'
  | 'student:view_content'
  | 'student:attempt_quizzes'
  | 'student:request_booking'
  | 'instructor:manage_availability'
  | 'admin:approve_booking'
  | 'admin:assign_instructor'
  | 'admin:manage_tenants'
  | 'view_own_tenant';

const rolePermissions: Record<Role, Permission[]> = {
  ADMIN: [
    'admin:create_instructor',
    'admin:approve_student',
    'admin:approve_booking',
    'admin:assign_instructor',
    'admin:manage_tenants',
    'instructor:create_content',
    'instructor:assign_quizzes',
    'instructor:manage_availability',
    'student:view_content',
    'student:attempt_quizzes',
    'student:request_booking',
    'view_own_tenant',
  ],
  INSTRUCTOR: [
    'instructor:create_content',
    'instructor:assign_quizzes',
    'instructor:manage_availability',
    'instructor:accept_booking',
    'student:view_content',
    'student:attempt_quizzes',
    'view_own_tenant',
  ],
  STUDENT: [
    'student:view_content',
    'student:attempt_quizzes',
    'student:request_booking',
    'view_own_tenant',
  ],
};

export function requirePermission(...permissions: Permission[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
      return;
    }
    const allowed = rolePermissions[req.context.role] || [];
    const hasAny = permissions.some((p) => allowed.includes(p));
    if (!hasAny) {
      next(new AppError(403, 'Insufficient permissions', 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.context) {
      next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
      return;
    }
    if (!roles.includes(req.context.role)) {
      next(new AppError(403, 'Insufficient role', 'FORBIDDEN'));
      return;
    }
    next();
  };
}

export function requireApprovedStudent(req: Request, _res: Response, next: NextFunction): void {
  if (!req.context) {
    next(new AppError(401, 'Authentication required', 'UNAUTHORIZED'));
    return;
  }
  if (req.context.role === 'STUDENT' && !req.context.approved) {
    next(new AppError(403, 'Account pending approval by admin', 'NOT_APPROVED'));
    return;
  }
  next();
}
