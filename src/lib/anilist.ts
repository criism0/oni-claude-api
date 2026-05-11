const ANILIST_URL = 'https://graphql.anilist.co'

export async function fetchEnglishTitles(malIds: number[]): Promise<Map<number, string | null>> {
  if (malIds.length === 0) return new Map()

  const safeIds = malIds.filter((id) => Number.isInteger(id) && id > 0)
  if (safeIds.length === 0) return new Map(malIds.map((id) => [id, null]))

  const aliases = safeIds
    .map((id, i) => `a${i}: Media(idMal: ${id}, type: ANIME) { title { english } }`)
    .join('\n')

  const query = `{ ${aliases} }`

  try {
    const res = await fetch(ANILIST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) return new Map(safeIds.map((id) => [id, null]))

    const json = (await res.json()) as {
      data: Record<string, { title: { english: string | null } } | null>
    }

    const result = new Map<number, string | null>()
    safeIds.forEach((id, i) => {
      result.set(id, json.data[`a${i}`]?.title.english ?? null)
    })
    return result
  } catch {
    return new Map(malIds.map((id) => [id, null]))
  }
}
