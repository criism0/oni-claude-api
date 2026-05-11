import fuzzball from 'fuzzball'

export function extractCoreTitle(title: string): string {
  return title
    .replace(/\s+[:\-–]\s*.+$/, '')
    .replace(/\s+(season|part|cour)\s+\d+/gi, '')
    .replace(/\s+\d+(st|nd|rd|th)\s+season/gi, '')
    .replace(/\s+M{0,4}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/i, '')
    .trim()
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getMatchScore(
  guess: string,
  titleRomaji: string,
  titleEnglish: string | null,
): number {
  const g = normalize(guess)
  if (!g || g.length < 4) return 0

  const targets = [
    normalize(extractCoreTitle(titleRomaji)),
    ...(titleEnglish ? [normalize(extractCoreTitle(titleEnglish))] : []),
  ]

  if (targets.length === 0) return 0

  return Math.max(
    ...targets.map((target) => {
      if (!target) return 0
      // When the guess is shorter than the title, require at least 85% character
      // coverage before scoring — prevents guessing only the first few words of a
      // long title (e.g. "is it wrong" for a 49-char title).
      if (g.length < target.length * 0.85) return 0
      return fuzzball.token_set_ratio(g, target)
    }),
  )
}

export function isCorrectGuess(
  guess: string,
  titleRomaji: string,
  titleEnglish: string | null,
): boolean {
  return getMatchScore(guess, titleRomaji, titleEnglish) >= 85
}

