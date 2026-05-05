function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }

  return dp[m][n];
}

// Tolerance: up to 20% of the answer length, capped at 3 characters
export function isCloseEnough(guess: string, answer: string): boolean {
  const g = guess.toLowerCase().trim();
  const a = answer.toLowerCase().trim();

  if (g === a) return true;

  const dist = levenshtein(g, a);
  const threshold = Math.min(3, Math.floor(a.length * 0.2));

  return dist <= threshold;
}
