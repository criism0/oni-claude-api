import { prisma } from '../lib/prisma'
import type { AppServer, AppSocket } from './types'
import { clearSocketRounds } from './round.handlers'

export function registerRoomHandlers(io: AppServer, socket: AppSocket): void {
  socket.on('room:join', async ({ roomId }) => {
    const { username } = socket.data.user

    try {
      const alreadyInRoom = socket.rooms.has(roomId)

      const room = await prisma.room.findUnique({ where: { id: roomId } })
      if (!room) {
        console.log(`[socket] room:join blocked: room ${roomId} not found`)
        return
      }

      if (!alreadyInRoom) {
        const existing = await io.in(roomId).fetchSockets()
        if (existing.length >= room.maxPlayers) {
          console.log(`[socket] room:join blocked: ${username} → ${roomId} full (${existing.length}/${room.maxPlayers})`)
          socket.emit('room:full')
          return
        }
      }

      socket.join(roomId)

      const all = await io.in(roomId).fetchSockets()
      if (!alreadyInRoom && all.length > room.maxPlayers) {
        socket.leave(roomId)
        console.log(`[socket] room:join rejected post-join: ${username} → ${roomId} over capacity`)
        socket.emit('room:full')
        return
      }

      console.log(`[socket] room:join: ${username} → ${roomId} (${all.length}/${room.maxPlayers})`)
      socket.emit('room:players', { players: all.map((s) => s.data.user) })

      if (!alreadyInRoom) {
        socket.to(roomId).emit('room:joined', socket.data.user)
      }
    } catch (err) {
      console.error('[socket] room:join error:', err)
      socket.emit('room:error', { code: 'JOIN_FAILED' })
    }
  })

  socket.on('room:leave', ({ roomId }) => {
    const { username } = socket.data.user
    console.log(`[socket] room:leave: ${username} ← ${roomId}`)
    socket.leave(roomId)
    socket.to(roomId).emit('room:left', socket.data.user)
  })

  socket.on('disconnecting', () => {
    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('room:left', socket.data.user)
      }
    }
  })

  socket.on('disconnect', () => {
    clearSocketRounds(socket.id)
  })
}
