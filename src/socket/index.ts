import { Server } from 'socket.io'
import { parse } from 'cookie'
import jwt from 'jsonwebtoken'
import type { Server as HttpServer } from 'node:http'
import type { AppServer } from './types'
import { registerRoomHandlers } from './room.handlers'
import { registerGameHandlers } from './game.handlers'
import { registerRoundHandlers } from './round.handlers'

export function initSocket(httpServer: HttpServer): AppServer {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET env var is required')
  }

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  }) as AppServer

  io.use((socket, next) => {
    const cookies = parse(socket.handshake.headers.cookie ?? '')
    const token = cookies['token']

    if (!token) {
      return next(new Error('Unauthorized'))
    }

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
        userId: string
        username: string
      }
      socket.data.user = { userId: payload.userId, username: payload.username }
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    console.log(`[socket] connected: ${socket.data.user.username} (${socket.id})`)
    socket.on('disconnect', () => {
      console.log(`[socket] disconnected: ${socket.data.user.username} (${socket.id})`)
    })
    registerRoomHandlers(io, socket)
    registerGameHandlers(io, socket)
    registerRoundHandlers(io, socket)
  })

  return io
}
