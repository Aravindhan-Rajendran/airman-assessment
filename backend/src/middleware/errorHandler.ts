import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = (req.headers['x-request-id'] as string) || undefined;
  if (requestId && !res.headersSent) {
    res.setHeader('x-request-id', requestId);
  }
  const body: { error: string; code?: string; requestId?: string } = {
    error: err instanceof AppError ? err.message : (process.env.NODE_ENV === 'production' ? 'Internal server error' : (err as Error).message),
    code: err instanceof AppError ? err.code : 'INTERNAL_ERROR',
  };
  if (requestId) body.requestId = requestId;
  if (!(err instanceof AppError)) {
    console.error(err);
  }
  const status = err instanceof AppError ? err.statusCode : 500;
  if (!res.headersSent) {
    res.status(status).json(body);
  }
}
