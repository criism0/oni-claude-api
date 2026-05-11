import { prisma } from '../lib/prisma'
import { isCorrectGuess } from '../lib/fuzzy'
import { fetchGameScores } from '../lib/scores'
import type { AppServer, AppSocket } from './types'

// -- Maps existentes --
const roundTimers = new Map<string, NodeJS.Timeout[]>()
const roundRoom = new Map<string, string>()
const socketRounds = new Map<string, Set<string>>()
const roundCorrect = new Map<string, Set<string>>()
const roundPending = new Map<string, Set<string>>()
const roomActiveRound = new Map<string, string>()

// ── Maps nuevos: tracking de tiempo y revelación para cálculo de puntos --
const roundStartTime = new Map<string, number>()   // roundId → start timestamp
const roundRevealLevel = new Map<string, number>() // roundId → current reveal %
const roundDuration = new Map<string, number>()    // roundId → durationSec

type Hint = { type: 'year' | 'episodes' | 'title'; value: string; valueEnglish?: string }
const roundHints = new Map<string, Hint[]>()             // roundId → hints emitidos hasta ahora
const roundPrecomputedHints = new Map<string, Hint[]>()  // roundId → [year, episodes, title] pre-calculados

function maskTitle(title: string): string {
  const chars = title.split('')
  const nonSpaceIndices = chars.map((c, i) => (c !== ' ' ? i : -1)).filter((i) => i !== -1)
  const revealCount = Math.max(1, Math.ceil(nonSpaceIndices.length * 0.1))
  const arr = [...nonSpaceIndices]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  const revealedSet = new Set(arr.slice(0, revealCount))
  return chars.map((c, i) => (c === ' ' ? ' ' : revealedSet.has(i) ? c : '_')).join('')
}

function buildHints(
  animeTitle: string,
  year: number | null,
  episodes: number | null,
  animeTitleEnglish: string | null,
): Hint[] {
  const yearHint: Hint = { type: 'year', value: year != null ? String(year) : '???' }
  const episodesHint: Hint = { type: 'episodes', value: episodes != null ? String(episodes) : '???' }
  const titleHint: Hint = {
    type: 'title',
    value: maskTitle(animeTitle),
    ...(animeTitleEnglish ? { valueEnglish: maskTitle(animeTitleEnglish) } : {}),
  }
  return [yearHint, episodesHint, titleHint]
}

// Formula de puntos: timeBonus (basado en qué tan rapido respondió el jugador)
// + revealBonus (basado en qué tan poco de la imagen se reveló)
function calculatePoints(timeRemaining: number, durationSec: number, revealLevel: number): number {
  const timeBonus = Math.max(10, Math.round((100 * timeRemaining) / durationSec))
  const revealBonus =
    revealLevel <= 0 ? 75 : revealLevel <= 25 ? 50 : revealLevel <= 50 ? 25 : 0
  return timeBonus + revealBonus
}

export async function startRound(
  io: AppServer,
  socketId: string,
  roomId: string,
  params: {
    roundId: string
    order: number
    durationSec: number
    totalRounds: number
    imageUrl: string
  },
  onEnd?: () => void,
): Promise<void> {
  const { roundId, order, durationSec, totalRounds, imageUrl } = params

  // Sentinel: prevent duplicate concurrent startRound calls for the same round,
  // set synchronously before any await.
  if (roundTimers.has(roundId)) return
  roundTimers.set(roundId, [])

  roundHints.set(roundId, [])

  const roundData = await prisma.round.findUnique({
    where: { id: roundId },
    select: { animeTitle: true, animeTitleEnglish: true, year: true, episodes: true },
  })
  roundPrecomputedHints.set(
    roundId,
    roundData
      ? buildHints(roundData.animeTitle, roundData.year, roundData.episodes, roundData.animeTitleEnglish)
      : [
          { type: 'year', value: '???' },
          { type: 'episodes', value: '???' },
          { type: 'title', value: '???' },
        ],
  )

  // Guard: clearRound may have been called while we awaited the DB
  if (!roundTimers.has(roundId)) {
    roundPrecomputedHints.delete(roundId)
    roundHints.delete(roundId)
    return
  }

  const sockets = await io.in(roomId).fetchSockets()

  if (!roundTimers.has(roundId)) return  // clearRound was called during fetchSockets

  const pending = new Set(sockets.map((s) => s.data.user.userId))

  roundRoom.set(roundId, roomId)
  roundCorrect.set(roundId, new Set())
  roundPending.set(roundId, pending)
  roomActiveRound.set(roomId, roundId)

  // tracking para checkpoints y cálculo de puntos
  roundStartTime.set(roundId, Date.now())
  roundRevealLevel.set(roundId, 0)
  roundDuration.set(roundId, durationSec)

  const tracked = socketRounds.get(socketId) ?? new Set<string>()
  tracked.add(roundId)
  socketRounds.set(socketId, tracked)

  io.to(roomId).emit('round:start', { roundId, order, durationSec, totalRounds, imageUrl })

  const checkpoints = [0.25, 0.5, 0.75, 1.0]
  const timers: NodeJS.Timeout[] = []

  const hintByPct = new Map<number, number>([
    [0.25, 0],
    [0.5, 1],
    [0.75, 2],
  ])

  checkpoints.forEach((pct) => {
    const timer = setTimeout(() => {
      const percent = Math.round(pct * 100)
      roundRevealLevel.set(roundId, percent)
      io.to(roomId).emit('round:reveal', { roundId, percent })

      const hintIndex = hintByPct.get(pct)
      if (hintIndex !== undefined) {
        const hint = roundPrecomputedHints.get(roundId)?.[hintIndex]
        if (hint) {
          roundHints.get(roundId)?.push(hint)
          io.to(roomId).emit('round:hint', { roundId, ...hint })
        }
      }

      if (pct === 1.0) {
        io.to(roomId).emit('round:timeout', { roundId, animeTitle: roundData?.animeTitle ?? '' })
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
  roundStartTime.delete(roundId)
  roundRevealLevel.delete(roundId)
  roundDuration.delete(roundId)
  roundHints.delete(roundId)
  roundPrecomputedHints.delete(roundId)

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

export async function onPlayerLeave(io: AppServer, roomId: string, userId: string): Promise<void> {
  const roundId = roomActiveRound.get(roomId)
  if (!roundId) return

  roundPending.get(roundId)?.delete(userId)

  if (roundPending.get(roundId)?.size === 0) {
    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { animeTitle: true },
    })
    io.to(roomId).emit('round:timeout', { roundId, animeTitle: round?.animeTitle ?? '' })
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

export function emitCatchupHints(socket: AppSocket, roomId: string): void {
  const roundId = roomActiveRound.get(roomId)
  if (!roundId) return
  const accumulated = roundHints.get(roundId) ?? []
  for (const hint of accumulated) {
    socket.emit('round:hint', { roundId, ...hint })
  }
}

export function registerRoundHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('round:guess', async ({ roundId, guess }) => {
    const roomId = roundRoom.get(roundId)
    if (!roomId) return
    if (!socket.rooms.has(roomId)) return

    const { userId, username } = socket.data.user

    if (roundCorrect.get(roundId)?.has(userId)) return
    if (!roundPending.get(roundId)?.has(userId)) return

    // Reclama el slot sincrónicamente antes de cualquier await, previene race condition
    // donde dos eventos simultáneos pasan la guard antes de que alguno actualice su estado.
    roundCorrect.get(roundId)!.add(userId)
    roundPending.get(roundId)!.delete(userId)

    const round = await prisma.round.findUnique({
      where: { id: roundId },
      select: { animeTitle: true, animeTitleEnglish: true, gameId: true },
    })
    if (!round) {
      // Roll back: round not found
      roundCorrect.get(roundId)?.delete(userId)
      roundPending.get(roundId)?.add(userId)
      return
    }

    const correct = isCorrectGuess(guess, round.animeTitle, round.animeTitleEnglish)
    if (!correct) {
      roundCorrect.get(roundId)?.delete(userId)
      roundPending.get(roundId)?.add(userId)
      socket.emit('round:incorrect', { roundId })
      return
    }

    const startTime = roundStartTime.get(roundId) ?? Date.now()
    const durationSec = roundDuration.get(roundId) ?? 30
    const revealLevel = roundRevealLevel.get(roundId) ?? 0
    const timeRemaining = Math.max(0, durationSec - (Date.now() - startTime) / 1000)
    const points = calculatePoints(timeRemaining, durationSec, revealLevel)

    await prisma.score.upsert({
      where: { userId_roundId: { userId, roundId } },
      update: { guess, correct: true, points },
      create: { userId, gameId: round.gameId, roundId, guess, correct: true, points },
    })

    const scores = await fetchGameScores(round.gameId)
    io.to(roomId).emit('round:correct', { roundId, userId, username, points })
    io.to(roomId).emit('score:update', { scores })

    if (roundPending.get(roundId)?.size === 0) {
      clearRound(roundId)
    }
  })
}
