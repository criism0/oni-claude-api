import type { AppServer, AppSocket } from './types'
import { startRound, clearRound } from './round.handlers'

// gameId → roundIds activos (para limpieza en game:end)
const gameRounds = new Map<string, Set<string>>()

export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('game:start', ({ gameId }) => {
    // TODO(tarea-9): validar que socket.data.user.userId sea el owner en DB
    const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
    const roomId = activeRooms[0]
    if (!roomId) return

    io.to(roomId).emit('game:started', { gameId })

    // TODO(tarea-9): reemplazar con query a DB para obtener las rondas reales del juego
    const roundId = `${gameId}-round-1`
    gameRounds.set(gameId, new Set([roundId]))

    startRound(io, socket.id, roomId, {
      roundId,
      order: 1,
      durationSec: 30,
      totalRounds: 1,
    })
  })

  socket.on('game:end', ({ gameId }) => {
    // TODO(tarea-9): validar que socket.data.user.userId sea el owner en DB
    const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
    const roomId = activeRooms[0]

    const rounds = gameRounds.get(gameId) ?? new Set<string>()
    for (const roundId of rounds) {
      clearRound(roundId)
    }
    gameRounds.delete(gameId)

    if (roomId) {
      // TODO(tarea-9): reemplazar scores: [] con scores reales desde DB
      io.to(roomId).emit('game:ended', { gameId, scores: [] })
    }
  })
}
