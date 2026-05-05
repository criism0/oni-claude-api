import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

interface RoundInput {
  animeId: number;
  animeTitle: string;
  imageUrls: string[];
}

export async function createGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId, rounds } = req.body as { roomId?: string; rounds?: RoundInput[] };

    if (!roomId) {
      throw new AppError(400, 'roomId es requerido');
    }

    if (!Array.isArray(rounds) || rounds.length === 0) {
      throw new AppError(400, 'rounds debe ser un array no vacío');
    }

    const room = await prisma.room.findUnique({ where: { id: roomId } });

    if (!room) {
      throw new AppError(404, 'Sala no encontrada');
    }

    if (room.ownerId !== req.user!.userId) {
      throw new AppError(403, 'Solo el dueño de la sala puede crear partidas');
    }

    const game = await prisma.game.create({
      data: {
        roomId,
        rounds: {
          create: rounds.map((r, index) => ({
            animeId: r.animeId,
            animeTitle: r.animeTitle,
            imageUrls: r.imageUrls,
            order: index + 1,
          })),
        },
      },
      include: {
        rounds: { orderBy: { order: 'asc' } },
      },
    });

    res.status(201).json({ game });
  } catch (err) {
    next(err);
  }
}

export async function getGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        rounds: { orderBy: { order: 'asc' } },
        scores: {
          include: { user: { select: { id: true, username: true } } },
          orderBy: { points: 'desc' },
        },
      },
    });

    if (!game) {
      throw new AppError(404, 'Partida no encontrada');
    }

    res.json({ game });
  } catch (err) {
    next(err);
  }
}

export async function startGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: { room: true },
    });

    if (!game) {
      throw new AppError(404, 'Partida no encontrada');
    }

    if (game.room.ownerId !== req.user!.userId) {
      throw new AppError(403, 'Solo el dueño de la sala puede iniciar la partida');
    }

    if (game.status !== 'WAITING') {
      throw new AppError(400, `No se puede iniciar una partida en estado ${game.status}`);
    }

    const updated = await prisma.game.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });

    res.json({ game: updated });
  } catch (err) {
    next(err);
  }
}
