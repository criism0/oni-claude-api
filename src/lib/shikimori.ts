export const BASE = 'https://shikimori.one/api';
export const HEADERS = { 'User-Agent': 'OniClaude/1.0' };

export interface ShikimoriAnime {
  id: number;
  name: string;
  aired_on: string | null;
  image: { preview: string };
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function fetchPage(genreId: number | null, page: number): Promise<ShikimoriAnime[]> {
  const params = new URLSearchParams({
    limit: '50',
    order: 'popularity',
    status: 'released',
    kind: 'tv',
    page: String(page),
  });
  if (genreId) params.set('genre', String(genreId));

  const res = await fetch(`${BASE}/animes?${params}`, { headers: HEADERS });
  if (!res.ok) return [];
  return (await res.json()) as ShikimoriAnime[];
}

function filterByDecade(animes: ShikimoriAnime[], decade: number): ShikimoriAnime[] {
  return animes.filter((a) => {
    if (!a.aired_on) return false;
    const year = new Date(a.aired_on).getFullYear();
    return year >= decade && year < decade + 10;
  });
}

function dedup(animes: ShikimoriAnime[]): ShikimoriAnime[] {
  const seen = new Set<number>();
  return animes.filter((a) => {
    if (seen.has(a.id)) return false;
    seen.add(a.id);
    return true;
  });
}

/**
 * Obtiene un pool aleatorio de animes suficiente para `needed` rondas.
 * Relaja filtros progresivamente si no hay suficientes:
 *   1. género + década  →  2. solo género  →  3. sin filtros
 */
export async function fetchAnimePool(
  genreId: number | null,
  decade: number | null,
  needed: number,
): Promise<ShikimoriAnime[]> {
  const pages = shuffle([1, 2, 3, 4, 5]);

  // Intento 1: género + página aleatoria, filtrar por década localmente
  const rawPages = await Promise.all(pages.slice(0, 3).map((p) => fetchPage(genreId, p)));
  let pool = dedup(rawPages.flat());

  if (decade !== null) {
    const withDecade = filterByDecade(pool, decade);
    if (withDecade.length >= needed) return shuffle(withDecade);
    // Intento 2: relajar década, mantener género
    if (pool.length >= needed) return shuffle(pool);
  } else {
    if (pool.length >= needed) return shuffle(pool);
  }

  // Intento 3: sin filtros
  if (genreId !== null) {
    const extraPages = await Promise.all(pages.slice(3).map((p) => fetchPage(null, p)));
    pool = dedup([...pool, ...extraPages.flat()]);
  }

  return shuffle(pool);
}

export async function countAnimePool(
  genreId: number | null,
  decade: number | null,
): Promise<number> {
  const pages = [1, 2, 3, 4, 5];
  const results = await Promise.all(pages.map((p) => fetchPage(genreId, p)));
  let pool = dedup(results.flat());
  if (decade !== null) pool = filterByDecade(pool, decade);
  return pool.length;
}

export async function fetchScreenshots(animeId: number, fallback: string): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/animes/${animeId}/screenshots`, { headers: HEADERS });
    if (!res.ok) return [fallback];
    const data = (await res.json()) as Array<{ original: string; preview: string }>;
    // TODO: evaluar calidad al implementar rondas — preview puede ser baja resolución, considerar s.original
    const urls = shuffle(data).slice(0, 4).map((s) => `https://shikimori.one${s.preview}`);
    return urls.length ? urls : [fallback];
  } catch {
    return [fallback];
  }
}
