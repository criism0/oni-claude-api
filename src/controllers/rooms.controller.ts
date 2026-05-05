import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export async function createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, maxPlayers } = req.body as { name?: string; maxPlayers?: number };

    if (!name) {
      throw new AppError(400, 'name es requerido');
    }

    let code = generateCode();
    let attempts = 0;
    while (await prisma.room.findUnique({ where: { code } })) {
      code = generateCode();
      if (++attempts > 10) throw new AppError(500, 'No se pudo generar un código único');
    }

    const room = await prisma.room.create({
      data: { code, name, maxPlayers: maxPlayers ?? 8, ownerId: req.user!.userId },
    });

    res.status(201).json({ room });
  } catch (err) {
    next(err);
  }
}

export async function getRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, username: true } },
        games: { select: { id: true, status: true, createdAt: true } },
      },
    });

    if (!room) {
      throw new AppError(404, 'Sala no encontrada');
    }

    res.json({ room });
  } catch (err) {
    next(err);
  }
}

export async function deleteRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const room = await prisma.room.findUnique({ where: { id } });

    if (!room) {
      throw new AppError(404, 'Sala no encontrada');
    }

    if (room.ownerId !== req.user!.userId) {
      throw new AppError(403, 'Solo el dueño puede eliminar la sala');
    }

    await prisma.room.delete({ where: { id } });

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
