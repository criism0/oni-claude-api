/**
 * Seed: historial de partidas (top 3 y fuera del top 3)
 *
 * Uso:
 *   npx tsx prisma/seed-history.ts <email-del-usuario>
 *
 * Ejemplo:
 *   npx tsx prisma/seed-history.ts crismo1712@uc.cl
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANIMES = [
  { id: 20,    title: 'Naruto',                            imageUrl: 'https://shikimori.one/system/animes/preview/20.jpg' },
  { id: 21,    title: 'One Piece',                         imageUrl: 'https://shikimori.one/system/animes/preview/21.jpg' },
  { id: 16498, title: 'Shingeki no Kyojin',               imageUrl: 'https://shikimori.one/system/animes/preview/16498.jpg' },
  { id: 5114,  title: 'Fullmetal Alchemist: Brotherhood', imageUrl: 'https://shikimori.one/system/animes/preview/5114.jpg' },
  { id: 1535,  title: 'Death Note',                       imageUrl: 'https://shikimori.one/system/animes/preview/1535.jpg' },
  { id: 11757, title: 'Sword Art Online',                 imageUrl: 'https://shikimori.one/system/animes/preview/11757.jpg' },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('❌ Uso: npx tsx prisma/seed-history.ts <email-del-usuario>');
    process.exit(1);
  }

  // ── Target user ──────────────────────────────────────────
  const mainUser = await prisma.user.findUnique({ where: { email } });
  if (!mainUser) throw new Error(`Usuario con email "${email}" no encontrado.`);
  console.log(`✓ Usuario encontrado: ${mainUser.username} (${mainUser.id})`);

  // ── Competitor bots (upsert para no duplicar en re-runs) ──
  const [botA, botB, botC, botD] = await Promise.all([
    prisma.user.upsert({ where: { email: 'bot_alpha@seed.local' }, update: {}, create: { username: 'bot_alpha', email: 'bot_alpha@seed.local', password: 'seed' } }),
    prisma.user.upsert({ where: { email: 'bot_beta@seed.local'  }, update: {}, create: { username: 'bot_beta',  email: 'bot_beta@seed.local',  password: 'seed' } }),
    prisma.user.upsert({ where: { email: 'bot_gamma@seed.local' }, update: {}, create: { username: 'bot_gamma', email: 'bot_gamma@seed.local', password: 'seed' } }),
    prisma.user.upsert({ where: { email: 'bot_delta@seed.local' }, update: {}, create: { username: 'bot_delta', email: 'bot_delta@seed.local', password: 'seed' } }),
  ]);
  console.log(`✓ Bots: ${botA.username}, ${botB.username}, ${botC.username}, ${botD.username}`);

  // ── Games data ───────────────────────────────────────────
  // Each entry: { daysAgo, roomName, players: [{userId, pts: pointsPerRound}] }
  const fixtures = [
    {
      daysAgo: 2,
      roomName: 'Sala Ninja ⚡',
      animes: ANIMES.slice(0, 3),
      players: [
        { userId: mainUser.id, pts: [500, 500, 500] },   // 1500 → 1°
        { userId: botA.id,     pts: [300, 300, 200] },   //  800 → 2°
      ],
    },
    {
      daysAgo: 5,
      roomName: 'One Piece Night',
      animes: ANIMES.slice(1, 4),
      players: [
        { userId: mainUser.id, pts: [200, 200, 200] },   //  600 → 2°
        { userId: botA.id,     pts: [400, 400, 400] },   // 1200 → 1°
      ],
    },
    {
      daysAgo: 10,
      roomName: 'Torneo Semanal',
      animes: ANIMES.slice(2, 5),
      players: [
        { userId: mainUser.id, pts: [700, 700, 600] },   // 2000 → 1°
        { userId: botA.id,     pts: [500, 500, 500] },   // 1500 → 2°
        { userId: botB.id,     pts: [300, 400, 300] },   // 1000 → 3°
      ],
    },
    {
      daysAgo: 15,
      roomName: 'Anime Clásico',
      animes: ANIMES.slice(3, 6),
      players: [
        { userId: mainUser.id, pts: [150, 150, 100] },   //  400 → 3°
        { userId: botA.id,     pts: [400, 400, 400] },   // 1200 → 1°
        { userId: botB.id,     pts: [300, 300, 200] },   //  800 → 2°
      ],
    },
    {
      daysAgo: 20,
      roomName: 'Gran Torneo 🏆',
      animes: ANIMES.slice(0, 3),
      players: [
        { userId: botA.id,     pts: [600, 600, 600] },   // 1800 → 1°
        { userId: botB.id,     pts: [500, 500, 400] },   // 1400 → 2°
        { userId: botC.id,     pts: [400, 300, 300] },   // 1000 → 3°
        { userId: mainUser.id, pts: [200, 200, 100] },   //  500 → 4°
      ],
    },
    {
      daysAgo: 25,
      roomName: 'Noche de Anime 🌙',
      animes: ANIMES.slice(1, 4),
      players: [
        { userId: botA.id,     pts: [700, 700, 700] },   // 2100 → 1°
        { userId: botB.id,     pts: [600, 500, 500] },   // 1600 → 2°
        { userId: botC.id,     pts: [400, 400, 300] },   // 1100 → 3°
        { userId: botD.id,     pts: [300, 300, 200] },   //  800 → 4°
        { userId: mainUser.id, pts: [100, 100, 100] },   //  300 → 5°
      ],
    },
  ];

  for (const fixture of fixtures) {
    const startedAt = daysAgo(fixture.daysAgo + 0.01);
    const endedAt   = daysAgo(fixture.daysAgo);

    const room = await prisma.room.create({
      data: {
        name: fixture.roomName,
        code: Math.random().toString(36).slice(2, 8).toUpperCase(),
        ownerId: mainUser.id,
        nRondas: fixture.animes.length,
      },
    });

    const game = await prisma.game.create({
      data: { roomId: room.id, status: 'FINISHED', startedAt, endedAt },
    });

    const rounds = await Promise.all(
      fixture.animes.map((anime, idx) =>
        prisma.round.create({
          data: {
            gameId: game.id,
            animeId: anime.id,
            animeTitle: anime.title,
            imageUrls: [anime.imageUrl],
            order: idx + 1,
          },
        }),
      ),
    );

    for (const player of fixture.players) {
      for (let i = 0; i < rounds.length; i++) {
        await prisma.score.create({
          data: {
            userId: player.userId,
            gameId: game.id,
            roundId: rounds[i].id,
            points: player.pts[i],
            correct: player.pts[i] > 0,
          },
        });
      }
    }

    const mainPlayerEntry = fixture.players.find(p => p.userId === mainUser.id);
    if (!mainPlayerEntry) throw new Error(`mainUser ausente en fixture "${fixture.roomName}"`);
    const userPts = mainPlayerEntry.pts.reduce((a, b) => a + b, 0);
    const position = fixture.players
      .map(p => ({ id: p.userId, total: p.pts.reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .findIndex(p => p.id === mainUser.id) + 1;
    console.log(`✓ "${fixture.roomName}" — ${userPts} pts → ${position}° de ${fixture.players.length}`);
  }

  console.log(`\n✅ 6 partidas creadas para ${mainUser.username} (1°, 2°, 3°, 4°, 5° cubiertos).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
