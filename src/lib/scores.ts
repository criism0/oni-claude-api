import { prisma } from './prisma'
import type { ScoreSummary } from '../socket/types'

export async function fetchGameScores(gameId: string): Promise<ScoreSummary[]> {
  const rows = await prisma.score.findMany({
    where: { gameId },
    include: { user: { select: { id: true, username: true } } },
  })

  const totals = new Map<string, ScoreSummary>()
  for (const s of rows) {
    const existing = totals.get(s.userId)
    if (existing) {
      existing.points += s.points
    } else {
      totals.set(s.userId, { userId: s.userId, username: s.user.username, points: s.points })
    }
  }

  return [...totals.values()].sort((a, b) => b.points - a.points)
}
