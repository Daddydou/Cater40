export type FriendsQuestion =
  | { id: number; type: 'qcm'; question: string; options: string[]; correctIndex: number }
  | { id: number; type: 'libre'; question: string }

export const FRIENDS_QUESTIONS: FriendsQuestion[] = [
  { id: 1,  type: 'qcm', question: "Quels sont les noms de légende de Joey et Phoebe ?", options: ["Ken Adams et Regina Phalange", "Joey Stalin et Regina Falsetto", "Kev Adams et Regina Filange"], correctIndex: 0 },
  { id: 2,  type: 'qcm', question: "Quel est le prénom de la copine chauve de Ross ?", options: ["Bonnie", "Mona", "Julie"], correctIndex: 0 },
  { id: 3,  type: 'qcm', question: "Quel est le 2ème prénom de Chandler ?", options: ["Muriel", "Murray", "Morris"], correctIndex: 0 },
  { id: 4,  type: 'qcm', question: "Quel est le 2ème prénom de Rachel ?", options: ["Karen", "Carol", "Kathleen"], correctIndex: 0 },
  { id: 5,  type: 'qcm', question: "Comment s'appelle le chat dans lequel Phoebe croit que sa mère s'est réincarnée ?", options: ["Julio", "Pedro", "Sebastian"], correctIndex: 0 },
  { id: 6,  type: 'qcm', question: "Comment s'appelle le personnage joué par Brad Pitt ?", options: ["Will", "Bill", "Tom"], correctIndex: 0 },
  { id: 7,  type: 'qcm', question: "Et comment s'appelle son club ?", options: ["I hate Rachel Club", "We hate Rachel Club", "Rachel Sucks Club"], correctIndex: 0 },
  { id: 8,  type: 'qcm', question: "Comment s'appelle le copain de Phoebe qui part vivre à Minsk ?", options: ["David", "Roger", "Vince"], correctIndex: 0 },
  { id: 9,  type: 'qcm', question: 'Qui dit "I could have a cat" ?', options: ["Mr Heckles", "Mr Treeger", "Gunther"], correctIndex: 0 },
  { id: 10, type: 'qcm', question: "Quel surnom avait Monica au lycée ?", options: ["Big fat goalie", "Fat Monica", "Big bad goalie"], correctIndex: 0 },
  { id: 11, type: 'qcm', question: 'À qui Chandler dit-il "step away from the duck" ?', options: ["Tommy", "Gary", "Pete"], correctIndex: 0 },
  { id: 12, type: 'qcm', question: "À quelle ville Ross devait-il s'arrêter quand il loupe son arrêt et se réveille à Montréal ?", options: ["Poughkeepsie", "Ellis Island", "Albany"], correctIndex: 0 },
  { id: 13, type: 'libre', question: "En français de Joey : comment dit-on \"Je m'appelle Claude\" et \"1, 2, 3, 4, 5\" ?" },
  { id: 14, type: 'qcm', question: 'Qui dit "I could get a goose !" ?', options: ["Joey", "Chandler", "Monica", "Phoebe", "Ross", "Rachel"], correctIndex: 0 },
  { id: 15, type: 'qcm', question: "Qui dit \"La première fois que j'ai vu Chandler, j'ai cru qu'il était de la jacquette\" ?", options: ["Phoebe", "Joey", "Chandler", "Monica", "Ross", "Rachel"], correctIndex: 0 },
  { id: 16, type: 'qcm', question: 'Qui dit "Yes yes, Bombay is very nice this time of the year" ?', options: ["Rachel", "Phoebe", "Joey", "Chandler", "Monica", "Ross"], correctIndex: 0 },
  { id: 17, type: 'libre', question: "À quelle guest-star est associée cette chanson ? (la chanson est diffusée à côté)" },
]

function seededRandom(seed: number): () => number {
  let s = seed
  return () => {
    s = ((s * 1664525) + 1013904223) >>> 0
    return s / 0x100000000
  }
}

export function seededShuffle<T>(arr: T[], seed: number): T[] {
  const result = [...arr]
  const rand = seededRandom(seed)
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
