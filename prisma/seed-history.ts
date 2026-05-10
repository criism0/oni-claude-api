import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ANIMES = [
  { id: 20,    title: 'Naruto',                imageUrl: 'https://shikimori.one/system/animes/preview/20.jpg' },
  { id: 21,    title: 'One Piece',              imageUrl: 'https://shikimori.one/system/animes/preview/21.jpg' },
  { id: 16498, title: 'Shingeki no Kyojin',    imageUrl: 'https://shikimori.one/system/animes/preview/16498.jpg' },
  { id: 5114,  title: 'Fullmetal Alchemist: Brotherhood', imageUrl: 'https://shikimori.one/system/animes/preview/5114.jpg' },
  { id: 1535,  title: 'Death Note',            imageUrl: 'https://shikimori.one/system/animes/preview/1535.jpg' },
  { id: 11757, title: 'Sword Art Online',      imageUrl: 'https://shikimori.one/system/animes/preview/11757.jpg' },
];

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function main() {
  // ── Target user ──────────────────────────────────────────
  const mainUser = await prisma.user.findUnique({ where: { email: 'crismo1712@uc.cl' } });
  if (!mainUser) throw new Error('Usuario criism0x2 no encontrado. Verificar email.');
  console.log(`✓ Usuario encontrado: ${mainUser.username} (${mainUser.id})`);

  // ── Competitor bots (upsert para no duplicar en re-runs) ──
  const botA = await prisma.user.upsert({
    where: { email: 'bot_alpha@seed.local' },
    update: {},
    create: { username: 'bot_alpha', email: 'bot_alpha@seed.local', password: 'seed' },
  });
  const botB = await prisma.user.upsert({
    where: { email: 'bot_beta@seed.local' },
    update: {},
    create: { username: 'bot_beta', email: 'bot_beta@seed.local', password: 'seed' },
  });
  console.log(`✓ Bots: ${botA.username}, ${botB.username}`);

  // ── Games data ───────────────────────────────────────────
  // Each entry: { daysAgo, roomName, players: [{userId, pointsPerRound}] }
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
      data: {
        roomId: room.id,
        status: 'FINISHED',
        startedAt,
        endedAt,
      },
    });

    // Create rounds
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

    // Create scores for each player per round
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

    const userPts = fixture.players.find(p => p.userId === mainUser.id)!.pts.reduce((a, b) => a + b, 0);
    console.log(`✓ Juego "${fixture.roomName}" — usuario: ${userPts} pts`);
  }

  console.log('\n✅ Seed completado. 4 partidas creadas para criism0x2.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
