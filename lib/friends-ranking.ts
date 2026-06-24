export type RankedPlayer = {
  id: string
  name: string
  avatar_url?: string | null
  rawScore: number
  bonus: number
  finalScore: number
  isCater: boolean
}

function normalizePrenom(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
}

export function isCaterPrenom(name: string): boolean {
  const n = normalizePrenom(name)
  return n.includes('cater') || n.includes('sophie')
}

export function computeRanking(
  players: { id: string; name: string; avatar_url?: string | null }[],
  answers: { player_id: string; is_correct: boolean | null; validated: boolean }[]
): RankedPlayer[] {
  const rawScores: Record<string, number> = {}
  for (const p of players) rawScores[p.id] = 0
  for (const a of answers) {
    if (a.is_correct || a.validated) rawScores[a.player_id] = (rawScores[a.player_id] ?? 0) + 1
  }

  const caterPlayer = players.find(p => isCaterPrenom(p.name))
  const others       = players.filter(p => !isCaterPrenom(p.name))
  const maxOthers    = others.length > 0
    ? Math.max(...others.map(p => rawScores[p.id] ?? 0))
    : 0

  let bonus = 0
  if (caterPlayer) {
    const caterRaw = rawScores[caterPlayer.id] ?? 0
    if (caterRaw < maxOthers) bonus = maxOthers - caterRaw + 1
  }

  const result: RankedPlayer[] = players.map(p => {
    const raw = rawScores[p.id] ?? 0
    const ic  = isCaterPrenom(p.name)
    return {
      id: p.id,
      name: p.name,
      avatar_url: p.avatar_url,
      rawScore: raw,
      bonus: ic ? bonus : 0,
      finalScore: raw + (ic ? bonus : 0),
      isCater: ic,
    }
  })
  result.sort((a, b) => b.finalScore - a.finalScore)
  return result
}
