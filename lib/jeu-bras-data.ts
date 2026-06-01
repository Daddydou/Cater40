export interface ResultLevel {
  minPct: number;
  image: string;
  titre: string;
  texte: string;
}

// Images résultat partagées avec photos-gens (à remplacer par des visuels dédiés)
export const RESULT_LEVELS: ResultLevel[] = [
  { minPct: 0,  image: '/images/jeu-photos-gens/resultats/zero.svg',   titre: '😬 Aïe...', texte: 'On repassera !' },
  { minPct: 25, image: '/images/jeu-photos-gens/resultats/moyen.svg', titre: '🤔 Bof bof', texte: 'Peut mieux faire.' },
  { minPct: 50, image: '/images/jeu-photos-gens/resultats/bien.svg',  titre: '😊 Pas mal !', texte: "Tu t'en es bien sorti·e !" },
  { minPct: 75, image: '/images/jeu-photos-gens/resultats/top.svg',   titre: '🏆 Excellent !', texte: 'Presque parfait !' },
];

export function getResultLevel(pct: number): ResultLevel {
  const sorted = [...RESULT_LEVELS].sort((a, b) => b.minPct - a.minPct);
  return sorted.find(l => pct >= l.minPct) ?? RESULT_LEVELS[0];
}
