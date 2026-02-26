import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../db';
import { config } from '../config';
import type { JwtPayload } from '../types';
import { AppError } from '../middleware/errorHandler';
import { Role } from '@prisma/client';
import { auditService } from './auditService';

export type LoginInput = { email: string; password: string; tenantId?: string };
export type RegisterInput = {
  email: string;
  password: string;
  role: Role;
  tenantId: string;
  createdBy?: string;
};

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  return argon2.verify(hash, password);
}

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(
    payload,
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn } as jwt.SignOptions
  );
}

export function signRefreshToken(payload: { sub: string }): string {
  return jwt.sign(
    payload,
    config.jwt.refreshSecret,
    { expiresIn: config.jwt.refreshExpiresIn } as jwt.SignOptions
  );
}

export async function createRefreshTokenRecord(userId: string): Promise<string> {
  const token = uuidv4();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  await prisma.refreshToken.create({
    data: { userId, token, expiresAt },
  });
  return token;
}

export async function login(input: LoginInput): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: Role; tenantId: string | null; approved: boolean };
}> {
  const where: { email: string; tenantId?: string | null } = { email: input.email.toLowerCase() };
  if (input.tenantId) where.tenantId = input.tenantId;

  const user = await prisma.user.findFirst({ where });
  if (!user) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }
  const valid = await verifyPassword(user.passwordHash, input.password);
  if (!valid) {
    throw new AppError(401, 'Invalid email or password', 'INVALID_CREDENTIALS');
  }

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    approved: user.approved ?? false,
  });

  const refreshTokenValue = await createRefreshTokenRecord(user.id);

  await auditService.log({
    userId: user.id,
    tenantId: user.tenantId ?? undefined,
    action: 'LOGIN',
    resource: 'USER',
    resourceId: user.id,
    afterState: JSON.stringify({ email: user.email, role: user.role }),
  });

  return {
    accessToken,
    refreshToken: refreshTokenValue,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      approved: user.approved ?? false,
    },
  };
}

export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  user: { id: string; email: string; role: Role; tenantId: string | null; approved: boolean };
}> {
  const record = await prisma.refreshToken.findUnique({
    where: { token: refreshToken },
    include: { user: true },
  });
  if (!record || record.expiresAt < new Date()) {
    throw new AppError(401, 'Invalid or expired refresh token', 'INVALID_REFRESH');
  }

  const user = record.user;
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId,
    approved: user.approved ?? false,
  });

  await prisma.refreshToken.delete({ where: { id: record.id } });
  const newRefreshToken = await createRefreshTokenRecord(user.id);

  return {
    accessToken,
    refreshToken: newRefreshToken,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      approved: user.approved ?? false,
    },
  };
}

export async function register(input: RegisterInput): Promise<{
  id: string;
  email: string;
  role: Role;
  tenantId: string;
  approved: boolean;
}> {
  const existing = await prisma.user.findFirst({
    where: { email: input.email.toLowerCase(), tenantId: input.tenantId },
  });
  if (existing) {
    throw new AppError(409, 'User with this email already exists in this tenant', 'CONFLICT');
  }

  const passwordHash = await hashPassword(input.password);
  const approved = input.role !== 'STUDENT';

  const user = await prisma.user.create({
    data: {
      email: input.email.toLowerCase(),
      passwordHash,
      role: input.role,
      tenantId: input.tenantId,
      approved,
    },
  });

  await auditService.log({
    userId: input.createdBy,
    tenantId: input.tenantId,
    action: 'CREATE',
    resource: 'USER',
    resourceId: user.id,
    afterState: JSON.stringify({ email: user.email, role: user.role }),
  });

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    tenantId: user.tenantId!,
    approved: user.approved ?? false,
  };
}

export const authService = {
  login,
  register,
  refreshAccessToken,
};
