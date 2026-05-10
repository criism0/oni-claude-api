import type { Server, Socket } from 'socket.io'

export interface ScoreSummary {
  userId: string
  username: string
  points: number
}

export interface ServerToClientEvents {
  'room:joined': (payload: { userId: string; username: string }) => void
  'room:left': (payload: { userId: string; username: string }) => void
  'room:players': (payload: { players: Array<{ userId: string; username: string }> }) => void
  'room:full': () => void
  'room:error': (payload: { code: string }) => void
  'game:started': (payload: { gameId: string }) => void
  'game:ended': (payload: { gameId: string; scores: ScoreSummary[] }) => void
  'game:error': (payload: { gameId: string }) => void
  'round:start': (payload: {
    roundId: string
    order: number
    durationSec: number
    totalRounds: number
    imageUrl: string
  }) => void
  'round:reveal': (payload: { roundId: string; percent: number }) => void
  'round:correct': (payload: {
    roundId: string
    userId: string
    username: string
    points: number
  }) => void
  'round:timeout': (payload: { roundId: string; animeTitle: string }) => void
  'score:update': (payload: { scores: ScoreSummary[] }) => void
}

export interface ClientToServerEvents {
  'room:join': (payload: { roomId: string }) => void
  'room:leave': (payload: { roomId: string }) => void
  'game:start': (payload: { gameId: string }) => void
  'game:end': (payload: { gameId: string }) => void
  'round:guess': (payload: { roundId: string; guess: string }) => void
}

export interface SocketData {
  user: { userId: string; username: string }
}

export type AppServer = Server<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>

export type AppSocket = Socket<
  ClientToServerEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>
