import type { AppServer, AppSocket } from './types'
import { startRound, clearRound, getSocketRoundIds } from './round.handlers'

// gameId → roundIds activos (para limpieza en game:end)
const gameRounds = new Map<string, Set<string>>()

export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('game:start', ({ gameId }) => {
    // TODO: conectar con lógica de salas — validar que socket.data.user.userId sea el owner en DB
    const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
    const roomId = activeRooms[0]
    if (!roomId) return
    if (gameRounds.has(gameId)) return

    io.to(roomId).emit('game:started', { gameId })

    // TODO: conectar con lógica de rondas — reemplazar con query a DB para obtener las rondas reales del juego
    const roundId = `${gameId}-round-1`
    gameRounds.set(gameId, new Set([roundId]))

    startRound(io, socket.id, roomId, {
      roundId,
      order: 1,
      durationSec: 30,
      totalRounds: 1,
    })
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
