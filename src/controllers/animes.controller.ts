import { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors';
import { countAnimePool } from '../lib/shikimori';

export async function checkAnimes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { genreId, decade, needed } = req.query as Record<string, string>;
    const count = await countAnimePool(
      genreId ? parseInt(genreId) : null,
      decade ? parseInt(decade) : null,
    );
    res.json({ count, enough: count >= (parseInt(needed) || 1) });
  } catch (err) {
    next(err);
  }
}

const SHIKIMORI_BASE = 'https://shikimori.one/api';
const SHIKIMORI_ORIGIN = 'https://shikimori.one';
const HEADERS = { 'User-Agent': 'OniClaude/1.0' };

async function shikiGet(path: string): Promise<unknown> {
  const res = await fetch(`${SHIKIMORI_BASE}${path}`, { headers: HEADERS });
  if (!res.ok) throw new AppError(502, 'Error al consultar Shikimori');
  return res.json();
}

export async function getAnimes(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { genre, score, season, page = '1', limit = '20' } = req.query as Record<string, string>;

    const params = new URLSearchParams({
      limit: String(Math.min(parseInt(limit) || 20, 50)),
      page: String(parseInt(page) || 1),
      order: 'popularity',
      status: 'released',
      kind: 'tv',
    });

    if (genre) params.set('genre', genre);
    if (score) params.set('score', score);
    if (season) params.set('season', season);

    const data = (await shikiGet(`/animes?${params}`)) as Array<{
      id: number;
      name: string;
      russian: string;
      image: { preview: string };
      score: string;
      aired_on: string | null;
    }>;

    const animes = data.map((a) => ({
      id: a.id,
      name: a.name,
      russian: a.russian,
      image: `${SHIKIMORI_ORIGIN}${a.image.preview}`,
      score: parseFloat(a.score) || 0,
      year: a.aired_on ? new Date(a.aired_on).getFullYear() : null,
    }));

    res.json({ animes });
  } catch (err) {
    next(err);
  }
}

export async function getGenres(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = (await shikiGet('/genres')) as Array<{
      id: number;
      name: string;
      russian: string;
      kind: string;
      entry_type: string;
    }>;

    const genres = data.filter((g) => g.entry_type === 'Anime' && g.kind === 'genre');
    res.json({ genres });
  } catch (err) {
    next(err);
  }
}

export async function getScreenshots(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!id || isNaN(Number(id))) {
      throw new AppError(400, 'id de anime inválido');
    }

    const data = (await shikiGet(`/animes/${id}/screenshots`)) as Array<{
      original: string;
      preview: string;
    }>;

    const screenshots = data.map((s) => ({
      original: `${SHIKIMORI_ORIGIN}${s.original}`,
      preview: `${SHIKIMORI_ORIGIN}${s.preview}`,
    }));

    res.json({ screenshots });
  } catch (err) {
    next(err);
  }
}
