import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { isCloseEnough } from '../lib/levenshtein';

export async function getRound(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    const round = await prisma.round.findUnique({
      where: { id },
      include: { game: { select: { id: true, status: true } } },
    });

    if (!round) {
      throw new AppError(404, 'Ronda no encontrada');
    }

    // Hide the answer while the game is ongoing
    if (round.game.status === 'IN_PROGRESS') {
      const { animeTitle: _, ...roundPublic } = round;
      res.json({ round: roundPublic });
      return;
    }

    res.json({ round });
  } catch (err) {
    next(err);
  }
}

export async function submitGuess(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id: roundId } = req.params;
    const { guess } = req.body as { guess?: string };
    const userId = req.user!.userId;

    if (!guess || typeof guess !== 'string' || !guess.trim()) {
      throw new AppError(400, 'guess es requerido');
    }

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      include: { game: true },
    });

    if (!round) {
      throw new AppError(404, 'Ronda no encontrada');
    }

    if (round.game.status !== 'IN_PROGRESS') {
      throw new AppError(400, 'La partida no está en progreso');
    }

    const existing = await prisma.score.findUnique({
      where: { userId_roundId: { userId, roundId } },
    });

    if (existing?.correct) {
      throw new AppError(400, 'Ya respondiste correctamente esta ronda');
    }

    const correct = isCloseEnough(guess, round.animeTitle);
    const points = correct ? 100 : 0;

    const score = await prisma.score.upsert({
      where: { userId_roundId: { userId, roundId } },
      update: { guess, correct, points },
      create: { userId, gameId: round.gameId, roundId, guess, correct, points },
    });

    res.json({ correct: score.correct, points: score.points });
  } catch (err) {
    next(err);
  }
}
