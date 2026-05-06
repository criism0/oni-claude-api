import type { AppServer, AppSocket } from './types'

// roundId → timers activos
const roundTimers = new Map<string, NodeJS.Timeout[]>()
// roundId → roomId (para broadcast en round:guess)
const roundRoom = new Map<string, string>()
// socketId → roundIds iniciados por ese socket (para limpieza en disconnect)
const socketRounds = new Map<string, Set<string>>()

export function startRound(
  io: AppServer,
  socketId: string,
  roomId: string,
  params: { roundId: string; order: number; durationSec: number; totalRounds: number },
): void {
  const { roundId, order, durationSec, totalRounds } = params

  roundRoom.set(roundId, roomId)

  const tracked = socketRounds.get(socketId) ?? new Set<string>()
  tracked.add(roundId)
  socketRounds.set(socketId, tracked)

  if (roundTimers.has(roundId)) return

  io.to(roomId).emit('round:start', { roundId, order, durationSec, totalRounds })

  const checkpoints = [0.25, 0.5, 0.75, 1.0]
  const timers: NodeJS.Timeout[] = []

  checkpoints.forEach((pct) => {
    const timer = setTimeout(() => {
      const percent = Math.round(pct * 100)
      io.to(roomId).emit('round:reveal', { roundId, percent })

      if (pct === 1.0) {
        // TODO(tarea-9): leer animeTitle de DB (Round.animeTitle)
        io.to(roomId).emit('round:timeout', { roundId, animeTitle: '' })
        clearRound(roundId)
      }
    }, durationSec * 1000 * pct)

    timers.push(timer)
  })

  roundTimers.set(roundId, timers)
}

export function clearRound(roundId: string): void {
  const timers = roundTimers.get(roundId)
  if (timers) {
    timers.forEach(clearTimeout)
    roundTimers.delete(roundId)
  }
  roundRoom.delete(roundId)

  for (const [socketId, rounds] of socketRounds) {
    rounds.delete(roundId)
    if (rounds.size === 0) socketRounds.delete(socketId)
  }
}

export function clearSocketRounds(socketId: string): void {
  const rounds = socketRounds.get(socketId)
  if (rounds) {
    for (const roundId of rounds) {
      clearRound(roundId)
    }
    socketRounds.delete(socketId)
  }
}

export function registerRoundHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('round:guess', ({ roundId }) => {
    const roomId = roundRoom.get(roundId)
    if (!roomId) return
    if (!socket.rooms.has(roomId)) return

    clearRound(roundId)

    // TODO(tarea-9): validar con isCloseEnough() de src/lib/levenshtein.ts y persistir Score en DB
    // No reimplementar la lógica — extraer la función core de src/controllers/rounds.controller.ts
    const { userId, username } = socket.data.user
    io.to(roomId).emit('round:correct', { roundId, userId, username, points: 100 })
    io.to(roomId).emit('score:update', { scores: [] })
  })
}
