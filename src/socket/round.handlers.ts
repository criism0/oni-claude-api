import type { AppServer, AppSocket } from './types'

// roundId → timers activos
const roundTimers = new Map<string, NodeJS.Timeout[]>()
// roundId → roomId (para broadcast en round:guess)
const roundRoom = new Map<string, string>()
// socketId → roundIds iniciados por ese socket (para limpieza en disconnect)
const socketRounds = new Map<string, Set<string>>()
// roundId → users que han acertado (para evitar repetir)
const roundCorrect = new Map<string, Set<string>>()
// roundId → users que no han acertado (para emitir timeout)
const roundPending = new Map<string, Set<string>>()
// roomId → roundId activo (para evitar multiples rondas)
const roomActiveRound = new Map<string, string>()

export async function startRound(
  io: AppServer,
  socketId: string,
  roomId: string,
  params: {
    roundId: string
    order: number
    durationSec: number
    totalRounds: number
  },
  onEnd?: () => void,
): Promise<void> {
  const { roundId, order, durationSec, totalRounds } = params

  const sockets = await io.in(roomId).fetchSockets()
  const pending = new Set(sockets.map((s) => s.data.user.userId))

  roundRoom.set(roundId, roomId)
  roundCorrect.set(roundId, new Set())
  roundPending.set(roundId, pending)
  roomActiveRound.set(roomId, roundId)

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
        // TODO: leer animeTitle de DB (Round.animeTitle)
        io.to(roomId).emit('round:timeout', { roundId, animeTitle: '' })
        clearRound(roundId, onEnd)
      }
    }, durationSec * 1000 * pct)

    timers.push(timer)
  })

  roundTimers.set(roundId, timers)
}

export function clearRound(roundId: string, onEnd?: () => void): void {
  const timers = roundTimers.get(roundId)
  if (timers) {
    timers.forEach(clearTimeout)
    roundTimers.delete(roundId)
  }

  const roomId = roundRoom.get(roundId)
  if (roomId) {
    roomActiveRound.delete(roomId)
    roundRoom.delete(roundId)
  }

  roundCorrect.delete(roundId)
  roundPending.delete(roundId)

  for (const [socketId, rounds] of socketRounds) {
    rounds.delete(roundId)
    if (rounds.size === 0) socketRounds.delete(socketId)
  }

  onEnd?.()
}

export function onPlayerJoin(roomId: string, userId: string): void {
  const roundId = roomActiveRound.get(roomId)
  if (!roundId) return
  if (!roundCorrect.get(roundId)?.has(userId)) {
    roundPending.get(roundId)?.add(userId)
  }
}

export function onPlayerLeave(io: AppServer, roomId: string, userId: string): void {
  const roundId = roomActiveRound.get(roomId)
  if (!roundId) return

  roundPending.get(roundId)?.delete(userId)

  if (roundPending.get(roundId)?.size === 0) {
    // TODO: leer animeTitle de DB
    io.to(roomId).emit('round:timeout', { roundId, animeTitle: '' })
    clearRound(roundId)
  }
}

export function getSocketRoundIds(socketId: string): Set<string> {
  return socketRounds.get(socketId) ?? new Set()
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
  socket.on('round:guess', ({ roundId, guess: _guess }) => {
    const roomId = roundRoom.get(roundId)
    if (!roomId) return
    if (!socket.rooms.has(roomId)) return

    const { userId, username } = socket.data.user

    if (roundCorrect.get(roundId)?.has(userId)) return
    if (!roundPending.get(roundId)?.has(userId)) return

    // TODO: validar con isCloseEnough() contra animeTitle de DB
    const correct = true
    if (!correct) return

    roundPending.get(roundId)!.delete(userId)
    roundCorrect.get(roundId)!.add(userId)

    // TODO: calcular puntos reales (timeBonus + revealBonus)
    const points = 100
    // TODO: persistir Score en DB

    io.to(roomId).emit('round:correct', { roundId, userId, username, points })
    // TODO: emitir scores reales desde DB
    io.to(roomId).emit('score:update', { scores: [] })

    if (roundPending.get(roundId)!.size === 0) {
      clearRound(roundId)
    }
  })
}
