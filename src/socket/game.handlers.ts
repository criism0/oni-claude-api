import { prisma } from '../lib/prisma'
import type { AppServer, AppSocket } from './types'
import { startRound, clearRound, getSocketRoundIds } from './round.handlers'

// gameId → roundIds activos (para limpieza en game:end)
const gameRounds = new Map<string, Set<string>>()

export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('game:start', async ({ gameId }) => {
    const { userId, username } = socket.data.user

    try {
      if (gameRounds.has(gameId)) return
      gameRounds.set(gameId, new Set())

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { room: { select: { ownerId: true } } },
      })
      if (!game) { gameRounds.delete(gameId); return }
      if (game.room.ownerId !== userId) {
        console.log(`[socket] game:start blocked: ${username} is not owner of game ${gameId}`)
        gameRounds.delete(gameId)
        return
      }

      const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
      const roomId = activeRooms[0]
      if (!roomId) { gameRounds.delete(gameId); return }

      const { count } = await prisma.game.updateMany({
        where: { id: gameId, status: 'WAITING' },
        data: { status: 'IN_PROGRESS', startedAt: new Date() },
      })
      if (count === 0) {
        gameRounds.delete(gameId)
        return
      }

      console.log(`[socket] game:start: ${username} → game ${gameId}`)
      io.to(roomId).emit('game:started', { gameId })

      // TODO: reemplazar con rondas reales de DB — pendiente lógica del servidor de rondas
      const roundId = `${gameId}-round-1`
      gameRounds.set(gameId, new Set([roundId]))

      startRound(io, socket.id, roomId, {
        roundId,
        order: 1,
        durationSec: 30,
        totalRounds: 1,
      })
    } catch (err) {
      console.error('[socket] game:start error:', err)
      gameRounds.delete(gameId)
    }
  })

  socket.on('disconnect', () => {
    const socketRoundIds = getSocketRoundIds(socket.id)
    for (const [gameId, roundSet] of gameRounds) {
      for (const roundId of roundSet) {
        if (socketRoundIds.has(roundId)) {
          gameRounds.delete(gameId)
          break
        }
      }
    }
  })

  socket.on('game:end', ({ gameId }) => {
    // TODO: conectar con lógica de salas — validar que socket.data.user.userId sea el owner en DB
    const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
    const roomId = activeRooms[0]

    const rounds = gameRounds.get(gameId) ?? new Set<string>()
    for (const roundId of rounds) {
      clearRound(roundId)
    }
    gameRounds.delete(gameId)

    if (roomId) {
      // TODO: conectar con lógica de puntuación — reemplazar scores: [] con scores reales desde DB
      io.to(roomId).emit('game:ended', { gameId, scores: [] })
    }
  })
}
