import { Request, Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { AppError } from '../lib/errors';

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Ya existe un registro con esos datos' });
      return;
    }
    if (err.code === 'P2025') {
      res.status(404).json({ error: 'Registro no encontrado' });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
