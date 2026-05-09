import 'dotenv/config';
import { httpServer } from './app';
import { initSocket } from './socket';
import { prisma } from './lib/prisma';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function start(): Promise<void> {
  // Al arrancar, cerrar partidas que quedaron IN_PROGRESS por un reinicio previo
  const { count } = await prisma.game.updateMany({
    where: { status: 'IN_PROGRESS' },
    data: { status: 'FINISHED', endedAt: new Date() },
  });
  if (count > 0) {
    console.log(`[startup] ${count} partida(s) IN_PROGRESS cerradas por reinicio del servidor`);
  }

  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`OniClaude API corriendo en http://localhost:${PORT}`);
  });
}

start();
