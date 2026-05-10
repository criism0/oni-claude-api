import { prisma } from '../lib/prisma'
import type { AppServer, AppSocket } from './types'
import { startRound, clearRound, getSocketRoundIds } from './round.handlers'
import { fetchGameScores } from '../lib/scores'

// gameId → roundIds activos (para limpieza en game:end)
const gameRounds = new Map<string, Set<string>>()
const endingGames = new Set<string>()

type RoundRow = { id: string; order: number; imageUrls: string[]; animeTitle: string }

// Marca el juego como FINISHED y emite scores reales a todos los jugadores
async function endGame(io: AppServer, gameId: string, roomId: string): Promise<void> {
  if (endingGames.has(gameId)) return
  endingGames.add(gameId)
  try {
    await prisma.game.update({
      where: { id: gameId },
      data: { status: 'FINISHED', endedAt: new Date() },
    })
    const scores = await fetchGameScores(gameId)
    gameRounds.delete(gameId)
    io.to(roomId).emit('game:ended', { gameId, scores })
  } finally {
    endingGames.delete(gameId)
  }
}

// orquesta secuencialmente las rondas del pool pre-creado
// Pausa 5s entre rondas; al agotar el pool llama endGame automáticamente
async function runRound(
  io: AppServer,
  socketId: string,
  roomId: string,
  gameId: string,
  rounds: RoundRow[],
  index: number,
  durationSec: number,
): Promise<void> {
  if (index >= rounds.length) {
    await endGame(io, gameId, roomId)
    return
  }

  const round = rounds[index]
  gameRounds.get(gameId)?.add(round.id)

  await startRound(
    io,
    socketId,
    roomId,
    {
      roundId: round.id,
      order: round.order,
      durationSec,
      totalRounds: rounds.length,
      imageUrl: round.imageUrls[0] ?? '',
    },
    () => {
      setTimeout(() => {
        runRound(io, socketId, roomId, gameId, rounds, index + 1, durationSec).catch(
          (err) => console.error('[socket] runRound error:', err),
        )
      }, 5000)
    },
  )
}

export function registerGameHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('game:start', async ({ gameId }) => {
    const { userId, username } = socket.data.user
    let roomId: string | undefined

    try {
      if (gameRounds.has(gameId)) return
      gameRounds.set(gameId, new Set())

      // cargar rondas reales de DB junto con duracionRonda de la sala
      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: {
          room: { select: { ownerId: true, duracionRonda: true } },
          rounds: { orderBy: { order: 'asc' } },
        },
      })
      if (!game) { gameRounds.delete(gameId); return }
      if (game.room.ownerId !== userId) {
        console.log(`[socket] game:start blocked: ${username} is not owner of game ${gameId}`)
        gameRounds.delete(gameId)
        return
      }

      const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
      roomId = activeRooms[0]
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

      await runRound(io, socket.id, roomId, gameId, game.rounds, 0, game.room.duracionRonda)
    } catch (err) {
      console.error('[socket] game:start error:', err)
      gameRounds.delete(gameId)
      await prisma.game.updateMany({
        where: { id: gameId, status: 'IN_PROGRESS' },
        data: { status: 'FINISHED', endedAt: new Date() },
      }).catch(() => {})
      if (roomId) {
        io.to(roomId).emit('game:error', { gameId })
      }
    }
  })

  socket.on('disconnect', () => {
    const socketRoundIds = getSocketRoundIds(socket.id)
    for (const [gameId, roundSet] of gameRounds) {
      for (const roundId of roundSet) {
        if (socketRoundIds.has(roundId)) {
          for (const id of roundSet) clearRound(id)
          gameRounds.delete(gameId)
          break
        }
      }
    }
  })

  socket.on('game:end', async ({ gameId }) => {
    try {
      const { userId } = socket.data.user
      const activeRooms = [...socket.rooms].filter((r) => r !== socket.id)
      const roomId = activeRooms[0]
      if (!roomId) return

      const game = await prisma.game.findUnique({
        where: { id: gameId },
        include: { room: { select: { ownerId: true } } },
      })
      if (!game || game.room.ownerId !== userId) return

      const rounds = gameRounds.get(gameId) ?? new Set<string>()
      for (const roundId of rounds) clearRound(roundId)

      await endGame(io, gameId, roomId)
    } catch (err) {
      console.error('[socket] game:end error:', err)
    }
  })
}
