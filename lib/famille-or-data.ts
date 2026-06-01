export interface FamilleOrReponseData {
  ordre: number;
  texte: string;
  points: number;
}

export interface FamilleOrQuestionData {
  question: string;
  reponses: FamilleOrReponseData[];
}

export const defaultQuestions: FamilleOrQuestionData[] = [
  {
    question: "Citez un animal domestique",
    reponses: [
      { ordre: 1, texte: "Chien", points: 40 },
      { ordre: 2, texte: "Chat", points: 30 },
      { ordre: 3, texte: "Lapin", points: 15 },
      { ordre: 4, texte: "Poisson", points: 8 },
      { ordre: 5, texte: "Hamster", points: 5 },
      { ordre: 6, texte: "Tortue", points: 2 },
    ],
  },
  {
    question: "Citez un sport qu'on pratique en été",
    reponses: [
      { ordre: 1, texte: "Natation", points: 38 },
      { ordre: 2, texte: "Tennis", points: 25 },
      { ordre: 3, texte: "Football", points: 18 },
      { ordre: 4, texte: "Cyclisme", points: 10 },
      { ordre: 5, texte: "Volleyball de plage", points: 6 },
      { ordre: 6, texte: "Pétanque", points: 3 },
    ],
  },
  {
    question: "Citez quelque chose qu'on emporte à la plage",
    reponses: [
      { ordre: 1, texte: "Serviette", points: 42 },
      { ordre: 2, texte: "Crème solaire", points: 28 },
      { ordre: 3, texte: "Lunettes de soleil", points: 16 },
      { ordre: 4, texte: "Chapeau", points: 8 },
      { ordre: 5, texte: "Bouteille d'eau", points: 4 },
      { ordre: 6, texte: "Livre", points: 2 },
    ],
  },
  {
    question: "Citez un aliment qu'on mange au petit-déjeuner",
    reponses: [
      { ordre: 1, texte: "Pain / Tartines", points: 35 },
      { ordre: 2, texte: "Céréales", points: 25 },
      { ordre: 3, texte: "Yaourt", points: 18 },
      { ordre: 4, texte: "Œufs", points: 12 },
      { ordre: 5, texte: "Fruit", points: 7 },
      { ordre: 6, texte: "Fromage", points: 3 },
    ],
  },
  {
    question: "Citez un pays qu'on visite souvent en vacances",
    reponses: [
      { ordre: 1, texte: "Espagne", points: 36 },
      { ordre: 2, texte: "Italie", points: 28 },
      { ordre: 3, texte: "Portugal", points: 16 },
      { ordre: 4, texte: "Grèce", points: 12 },
      { ordre: 5, texte: "Maroc", points: 6 },
      { ordre: 6, texte: "Thaïlande", points: 2 },
    ],
  },
];
