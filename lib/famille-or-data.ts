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
  {
    question: "Citez quelque chose qu'on fait semblant de comprendre",
    reponses: [
      { ordre: 1, texte: "Une blague", points: 38 },
      { ordre: 2, texte: "Un contrat / document officiel", points: 25 },
      { ordre: 3, texte: "L'anglais", points: 18 },
      { ordre: 4, texte: "La politique", points: 12 },
      { ordre: 5, texte: "Les impôts", points: 7 },
    ],
  },
  {
    question: "Citez une chose qu'on dit à son médecin mais pas à sa mère",
    reponses: [
      { ordre: 1, texte: "Combien on boit", points: 40 },
      { ordre: 2, texte: "Qu'on fume", points: 27 },
      { ordre: 3, texte: "Qu'on a mal quelque part depuis 3 ans", points: 18 },
      { ordre: 4, texte: "Ce qu'on mange vraiment", points: 10 },
      { ordre: 5, texte: "Qu'on dort mal", points: 5 },
    ],
  },
  {
    question: "Citez quelque chose qu'on remet à plus tard depuis des années",
    reponses: [
      { ordre: 1, texte: "Ranger le placard", points: 35 },
      { ordre: 2, texte: "Appeler sa grand-mère", points: 22 },
      { ordre: 3, texte: "Aller chez le dentiste", points: 20 },
      { ordre: 4, texte: "Faire du sport", points: 12 },
      { ordre: 5, texte: "Trier ses mails", points: 8 },
      { ordre: 6, texte: "Apprendre une langue", points: 3 },
    ],
  },
  {
    question: "Citez ce qu'on fait quand quelqu'un sonne à la porte sans prévenir",
    reponses: [
      { ordre: 1, texte: "Faire semblant de ne pas être là", points: 44 },
      { ordre: 2, texte: "Regarder par la fenêtre", points: 26 },
      { ordre: 3, texte: "Paniquer", points: 15 },
      { ordre: 4, texte: "Ranger en vitesse", points: 10 },
      { ordre: 5, texte: "Envoyer quelqu'un d'autre ouvrir", points: 5 },
    ],
  },
  {
    question: "Citez quelque chose qu'on vole dans les hôtels",
    reponses: [
      { ordre: 1, texte: "Le shampoing / gel douche", points: 50 },
      { ordre: 2, texte: "Les serviettes", points: 22 },
      { ordre: 3, texte: "Le peignoir", points: 15 },
      { ordre: 4, texte: "Le stylo", points: 8 },
      { ordre: 5, texte: "Le cache-théière", points: 5 },
    ],
  },
  {
    question: "Citez une chose qu'on fait au bureau qu'on ne devrait pas",
    reponses: [
      { ordre: 1, texte: "Rien foutre", points: 42 },
      { ordre: 2, texte: "Faire ses courses en ligne", points: 28 },
      { ordre: 3, texte: "Dormir", points: 15 },
      { ordre: 4, texte: "Manger les trucs des autres", points: 10 },
      { ordre: 5, texte: "Pleurer dans les toilettes", points: 5 },
    ],
  },
];
