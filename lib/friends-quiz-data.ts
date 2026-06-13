export type FriendsQuestion = {
  id: number
  question: string
  options: string[]
  correctIndex: number
}

export const FRIENDS_QUESTIONS: FriendsQuestion[] = [
  {
    id: 1,
    question: "Quels sont les noms de légende de Joey et Phoebe ?",
    options: ["Ken Adams et Regina Phalange", "Joey Stalin et Regina Falsetto", "Kevin Adams et Regina Filange", "Ken Adams et Phoebe Buffé"],
    correctIndex: 0,
  },
  {
    id: 2,
    question: "Quel est le prénom de la copine chauve de Ross ?",
    options: ["Bonnie", "Mona", "Emily", "Julie"],
    correctIndex: 0,
  },
  {
    id: 3,
    question: "Quel est le 2ème prénom de Chandler ?",
    options: ["Muriel", "Murray", "Marcel", "Morris"],
    correctIndex: 0,
  },
  {
    id: 4,
    question: "Quel est le 2ème prénom de Rachel ?",
    options: ["Karen", "Carol", "Kathleen", "Green"],
    correctIndex: 0,
  },
  {
    id: 5,
    question: "Comment s'appelle le chat dans lequel Phoebe croit que sa mère s'est réincarnée ?",
    options: ["Julio", "Pedro", "Sebastian", "Marcel"],
    correctIndex: 0,
  },
  {
    id: 6,
    question: "Comment s'appelle le personnage joué par Brad Pitt ?",
    options: ["Will", "Bill", "Tom", "Frank"],
    correctIndex: 0,
  },
  {
    id: 7,
    question: "Et comment s'appelle son club ?",
    options: ["I hate Rachel Club", "We hate Rachel Club", "Anti-Rachel Society", "Rachel Sucks Club"],
    correctIndex: 0,
  },
  {
    id: 8,
    question: "Comment s'appelle le copain de Phoebe qui part vivre à Minsk ?",
    options: ["David", "Mike", "Roger", "Vince"],
    correctIndex: 0,
  },
  {
    id: 9,
    question: 'Qui dit "I could have a cat" ?',
    options: ["Mr Heckles", "Mr Treeger", "Gunther", "Mr Geller"],
    correctIndex: 0,
  },
  {
    id: 10,
    question: "Quel surnom avait Monica au lycée ?",
    options: ["Big fat goalie", "Big fat poolie", "Fat Monica", "Big bad goalie"],
    correctIndex: 0,
  },
  {
    id: 11,
    question: 'À qui Chandler dit-il "step away from the duck" ?',
    options: ["Tommy (Ben Stiller)", "Gary le flic", "Pete", "Eric"],
    correctIndex: 0,
  },
  {
    id: 12,
    question: "À quelle ville Ross devait-il s'arrêter quand il loupe son arrêt et se réveille à Montréal ?",
    options: ["Pookipsy", "Poughkeepsie", "Schenectady", "Albany"],
    correctIndex: 0,
  },
  {
    id: 13,
    question: 'Comment dit-on "je m\'appelle Claude" en français selon Joey ?',
    options: ["Je bou bou Claude", "Je voo voo Claude", "Je m'appelle Claude", "Je clo clo Claude"],
    correctIndex: 0,
  },
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
