import type { AppSocket } from './types'
import { clearSocketRounds } from './round.handlers'

export function registerRoomHandlers(socket: AppSocket): void {
  socket.on('room:join', ({ roomId }) => {
    socket.join(roomId)
    socket.to(roomId).emit('room:joined', socket.data.user)
  })

  socket.on('room:leave', ({ roomId }) => {
    socket.leave(roomId)
    socket.to(roomId).emit('room:left', socket.data.user)
  })

  socket.on('disconnect', () => {
    clearSocketRounds(socket.id)

    for (const roomId of socket.rooms) {
      if (roomId !== socket.id) {
        socket.to(roomId).emit('room:left', socket.data.user)
      }
    }
  })
}
