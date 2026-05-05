import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../lib/errors';

interface JWTPayload {
  userId: string;
  username: string;
}

export function authMiddleware(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.token as string | undefined;

  if (!token) {
    return next(new AppError(401, 'No autorizado'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    req.user = { userId: payload.userId, username: payload.username };
    next();
  } catch {
    next(new AppError(401, 'Token inválido o expirado'));
  }
}
