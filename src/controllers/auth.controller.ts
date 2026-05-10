import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const COOKIE_NAME = 'token';

function cookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: (isProd ? 'none' : 'lax') as 'none' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function signToken(userId: string, username: string): string {
  return jwt.sign({ userId, username }, process.env.JWT_SECRET!, { expiresIn: '7d' });
}

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, email, password } = req.body as {
      username?: string;
      email?: string;
      password?: string;
    };

    if (!username || !email || !password) {
      throw new AppError(400, 'username, email y password son requeridos');
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });

    if (existing) {
      throw new AppError(409, 'El usuario o email ya existe');
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { username, email, password: hashed },
    });

    const token = signToken(user.id, user.username);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    res.status(201).json({
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      throw new AppError(400, 'email y password son requeridos');
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new AppError(401, 'Credenciales incorrectas');
    }

    const token = signToken(user.id, user.username);
    res.cookie(COOKIE_NAME, token, cookieOptions());

    res.json({
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    next(err);
  }
}

export function logout(_req: Request, res: Response): void {
  const { maxAge: _, ...clearOptions } = cookieOptions();
  res.clearCookie(COOKIE_NAME, clearOptions);
  res.json({ message: 'Sesión cerrada' });
}

export async function me(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { id: true, username: true, email: true, createdAt: true },
    });

    if (!user) {
      throw new AppError(404, 'Usuario no encontrado');
    }

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

export async function checkUsername(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username } = req.query as { username?: string };
    if (!username?.trim()) {
      throw new AppError(400, 'username requerido');
    }

    const existing = await prisma.user.findFirst({
      where: { username: username.trim(), NOT: { id: req.user!.userId } },
    });

    res.json({ available: !existing });
  } catch (err) {
    next(err);
  }
}

export async function updateMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { username, currentPassword, newPassword } = req.body as {
      username?: string;
      currentPassword?: string;
      newPassword?: string;
    };

    const wantsUsername = Boolean(username?.trim());
    const wantsPassword = Boolean(newPassword);

    if (!wantsUsername && !wantsPassword) {
      throw new AppError(400, 'Se requiere al menos un campo para actualizar');
    }

    if (wantsUsername) {
      const len = username!.trim().length;
      if (len < 3 || len > 20) {
        throw new AppError(400, 'El nombre de usuario debe tener entre 3 y 20 caracteres');
      }
    }

    const currentUser = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!currentUser) throw new AppError(404, 'Usuario no encontrado');

    // Contraseña actual siempre requerida para cualquier cambio
    if (!currentPassword) {
      throw new AppError(400, 'Se requiere la contraseña actual para realizar cambios');
    }
    const valid = await bcrypt.compare(currentPassword, currentUser.password);
    if (!valid) throw new AppError(401, 'Contraseña actual incorrecta');

    const updates: { username?: string; password?: string } = {};

    if (wantsUsername && username!.trim() !== currentUser.username) {
      const newUsername = username!.trim();
      const taken = await prisma.user.findFirst({
        where: { username: newUsername, NOT: { id: req.user!.userId } },
      });
      if (taken) throw new AppError(409, 'El nombre de usuario ya está en uso');
      updates.username = newUsername;
    }

    if (wantsPassword) {
      if (newPassword!.length < 8) {
        throw new AppError(400, 'La nueva contraseña debe tener al menos 8 caracteres');
      }
      updates.password = await bcrypt.hash(newPassword!, 12);
    }

    if (Object.keys(updates).length === 0) {
      res.json({ user: { id: currentUser.id, username: currentUser.username, email: currentUser.email, createdAt: currentUser.createdAt } });
      return;
    }

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: updates,
      select: { id: true, username: true, email: true, createdAt: true },
    });

    // Re-emitir cookie si el username cambió (el JWT contiene username)
    if (updates.username) {
      const token = signToken(updated.id, updated.username);
      res.cookie(COOKIE_NAME, token, cookieOptions());
    }

    res.json({ user: updated });
  } catch (err) {
    next(err);
  }
}
