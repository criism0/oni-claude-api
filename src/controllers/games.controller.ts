import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { fetchAnimePool, fetchScreenshots } from '../lib/shikimori';

export async function createGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { roomId } = req.body as { roomId?: string };

    if (!roomId) throw new AppError(400, 'roomId es requerido');

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError(404, 'Sala no encontrada');
    if (room.ownerId !== req.user!.userId)
      throw new AppError(403, 'Solo el dueño de la sala puede crear partidas');

    const existingGame = await prisma.game.findFirst({
      where: { roomId, status: { in: ['WAITING', 'IN_PROGRESS'] } },
    });
    if (existingGame) throw new AppError(409, 'Ya existe una partida activa para esta sala');

    const pool = await fetchAnimePool(room.genreId, room.decade, room.nRondas);
    if (pool.length < room.nRondas) {
      throw new AppError(
        422,
        `No hay suficientes animes con esos filtros (${pool.length} encontrados, ${room.nRondas} necesarios).`,
      );
    }

    const selected = pool.slice(0, room.nRondas);

    const rounds = await Promise.all(
      selected.map(async (anime, index) => {
        const fallback = `https://shikimori.one${anime.image.preview}`;
        const imageUrls = await fetchScreenshots(anime.id, fallback);
        return { animeId: anime.id, animeTitle: anime.name, imageUrls, order: index + 1 };
      }),
    );

    const game = await prisma.game.create({
      data: { roomId, rounds: { create: rounds } },
      include: { rounds: { orderBy: { order: 'asc' } } },
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
    if (!game) throw new AppError(404, 'Partida no encontrada');
    res.json({ game });
  } catch (err) {
    next(err);
  }
}

export async function startGame(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const game = await prisma.game.findUnique({ where: { id }, include: { room: true } });
    if (!game) throw new AppError(404, 'Partida no encontrada');
    if (game.room.ownerId !== req.user!.userId)
      throw new AppError(403, 'Solo el dueño de la sala puede iniciar la partida');
    if (game.status !== 'WAITING')
      throw new AppError(400, `No se puede iniciar una partida en estado ${game.status}`);

    const updated = await prisma.game.update({
      where: { id },
      data: { status: 'IN_PROGRESS', startedAt: new Date() },
    });
    res.json({ game: updated });
  } catch (err) {
    next(err);
  }
}
