import { Request, Response, NextFunction } from 'express';
import { ModoRevelacion } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

const VALID_MODOS = Object.values(ModoRevelacion);

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

export async function createRoom(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { name, maxPlayers, nRondas, duracionRonda, modoRevelacion, genreId, decade } =
      req.body as {
        name?: string;
        maxPlayers?: number;
        nRondas?: number;
        duracionRonda?: number;
        modoRevelacion?: string;
        genreId?: number;
        decade?: number;
      };

    if (!name) {
      throw new AppError(400, 'name es requerido');
    }

    if (maxPlayers !== undefined && (maxPlayers < 2 || maxPlayers > 8)) {
      throw new AppError(400, 'maxPlayers debe estar entre 2 y 8');
    }

    if (nRondas !== undefined && (nRondas < 1 || nRondas > 20)) {
      throw new AppError(400, 'nRondas debe estar entre 1 y 20');
    }

    if (duracionRonda !== undefined && (duracionRonda < 10 || duracionRonda > 120)) {
      throw new AppError(400, 'duracionRonda debe estar entre 10 y 120 segundos');
    }

    if (modoRevelacion !== undefined && !VALID_MODOS.includes(modoRevelacion as ModoRevelacion)) {
      throw new AppError(400, `modoRevelacion debe ser uno de: ${VALID_MODOS.join(', ')}`);
    }

    let code = generateCode();
    let attempts = 0;
    while (await prisma.room.findUnique({ where: { code } })) {
      code = generateCode();
      if (++attempts > 10) throw new AppError(500, 'No se pudo generar un código único');
    }

    const room = await prisma.room.create({
      data: {
        code,
        name,
        maxPlayers: maxPlayers ?? 8,
        nRondas: nRondas ?? 5,
        duracionRonda: duracionRonda ?? 30,
        modoRevelacion: (modoRevelacion as ModoRevelacion) ?? ModoRevelacion.PROGRESIVO,
        genreId: genreId ?? null,
        decade: decade ?? null,
        ownerId: req.user!.userId,
      },
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

export async function getRoomByCode(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { code } = req.params

    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        owner: { select: { id: true, username: true } },
        games: {
          select: { id: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })

    if (!room) {
      throw new AppError(404, 'Sala no encontrada')
    }

    res.json({ room })
  } catch (err) {
    next(err)
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
