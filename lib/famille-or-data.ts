export interface FamilleOrReponseData {
  ordre: number;
  texte: string;
  points: number;
}

export interface FamilleOrQuestionData {
  question: string;
  reponses: FamilleOrReponseData[];
}

export interface FinaleReponseData {
  texte: string
  points: number
}
export interface FinaleQuestionData {
  ordre: number
  question: string
  points: number
  reponses: FinaleReponseData[]
}

export const defaultQuestions: FamilleOrQuestionData[] = [
  {
    question: "Citez quelque chose qu'on fait en secret dans les toilettes",
    reponses: [
      { ordre: 1, texte: "Scroller son téléphone", points: 42 },
      { ordre: 2, texte: "Se regarder dans le miroir", points: 28 },
      { ordre: 3, texte: "Chanter", points: 15 },
      { ordre: 4, texte: "Pleurer", points: 8 },
      { ordre: 5, texte: "Lire", points: 5 },
      { ordre: 6, texte: "Manger", points: 2 },
    ],
  },
  {
    question: "Citez une excuse bidon pour ne pas aller au sport",
    reponses: [
      { ordre: 1, texte: "J'ai mal au dos", points: 45 },
      { ordre: 2, texte: "Je suis trop fatigué(e)", points: 30 },
      { ordre: 3, texte: "Il pleut", points: 12 },
      { ordre: 4, texte: "J'ai pas mes affaires", points: 8 },
      { ordre: 5, texte: "Je commence lundi", points: 5 },
    ],
  },
];

export const defaultFinaleQuestions: FinaleQuestionData[] = [
  {
    ordre: 1,
    question: "Citez quelque chose qu'on fait toujours en dernière minute",
    points: 30,
    reponses: [
      { texte: "Les valises", points: 40 },
      { texte: "Les devoirs", points: 30 },
      { texte: "Les impôts", points: 20 },
      { texte: "Acheter un cadeau", points: 10 },
    ]
  },
  {
    ordre: 2,
    question: "Citez un mot qu'on écrit souvent mal",
    points: 25,
    reponses: [
      { texte: "Ça / sa", points: 40 },
      { texte: "Quand / quant", points: 30 },
      { texte: "Leur / leurs", points: 20 },
      { texte: "Davantage / d'avantage", points: 10 },
    ]
  },
]
