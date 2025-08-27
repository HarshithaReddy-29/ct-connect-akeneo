import { ErrorRequestHandler, NextFunction, Request, Response } from 'express';
import CustomError from '../errors/custom.error';

export const errorMiddleware: ErrorRequestHandler = (
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Always log full details to the server console
  console.error('[FullSync] Unhandled error:', {
    name: error?.name,
    message: error?.message,
    statusCode: (error as any)?.statusCode,
    errors: (error as any)?.errors,
    stack: error?.stack,
  });

  if (error instanceof CustomError) {
    res.status(error.statusCode as number).json({
      message: error.message,
      errors: error.errors,
      stack: isDevelopment ? error.stack : undefined,
    });
    return;
  }

  res.status(500).json(
    isDevelopment
      ? { message: error?.message, stack: error?.stack }
      : { message: 'Internal server error' }
  );
};
