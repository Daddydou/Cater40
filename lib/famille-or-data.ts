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
    question: "A qui une femme ne dirait-elle pas qu'elle trompe son mari ?",
    reponses: [
      { ordre: 1, texte: "Sa belle-mère", points: 23 },
      { ordre: 2, texte: "Sa propre mère", points: 21 },
      { ordre: 3, texte: "Ami de son mari", points: 15 },
      { ordre: 4, texte: "Meilleure amie", points: 15 },
      { ordre: 5, texte: "Enfants", points: 12 },
    ],
  },
  {
    question: "Que veut-on rendre à quelqu'un après une rupture ?",
    reponses: [
      { ordre: 1, texte: "Bijoux", points: 73 },
      { ordre: 2, texte: "Lettres", points: 12 },
      { ordre: 3, texte: "Clés de l'appartement", points: 4 },
      { ordre: 4, texte: "Photos", points: 4 },
      { ordre: 5, texte: "Vêtements", points: 3 },
    ],
  },
  {
    question: "De quoi certaines personnes abusent-elles ?",
    reponses: [
      { ordre: 1, texte: "Alcool", points: 64 },
      { ordre: 2, texte: "Bonté/Patience des gens", points: 15 },
      { ordre: 3, texte: "Cigarettes", points: 9 },
      { ordre: 4, texte: "Argent", points: 2 },
      { ordre: 5, texte: "Drogue", points: 2 },
      { ordre: 6, texte: "Nourriture", points: 2 },
      { ordre: 7, texte: "Pouvoir", points: 2 },
    ],
  },
  {
    question: "Quel animal est difficile à promener en laisse ?",
    reponses: [
      { ordre: 1, texte: "Chat", points: 20 },
      { ordre: 2, texte: "Lion", points: 14 },
      { ordre: 3, texte: "Éléphant", points: 12 },
      { ordre: 4, texte: "Serpent", points: 9 },
      { ordre: 5, texte: "Oiseau/Poule", points: 7 },
      { ordre: 6, texte: "Tigre", points: 7 },
    ],
  },
  {
    question: "Qu'est-ce qui fait dire d'un homme qu'il a la classe ?",
    reponses: [
      { ordre: 1, texte: "Bien habillé", points: 63 },
      { ordre: 2, texte: "Allure/Démarche", points: 12 },
      { ordre: 3, texte: "Grand", points: 5 },
      { ordre: 4, texte: "Langage raffiné", points: 4 },
      { ordre: 5, texte: "Galant/Courtois", points: 3 },
    ],
  },
  {
    question: "Quand une femme retire-t-elle son alliance ?",
    reponses: [
      { ordre: 1, texte: "Avec son amant", points: 21 },
      { ordre: 2, texte: "Faire la vaisselle", points: 18 },
      { ordre: 3, texte: "Divorcée", points: 13 },
      { ordre: 4, texte: "Se laver", points: 7 },
    ],
  },
  {
    question: "Quelle peut être la réaction d'un homme quand sa petite amie lui apprend qu'elle est enceinte ?",
    reponses: [
      { ordre: 1, texte: "Content/Heureux", points: 57 },
      { ordre: 2, texte: "Mécontent", points: 11 },
      { ordre: 3, texte: "La quitte", points: 10 },
      { ordre: 4, texte: "S'étonne", points: 6 },
      { ordre: 5, texte: "L'épouse", points: 3 },
      { ordre: 6, texte: "Panique/Angoisse", points: 3 },
    ],
  },
  {
    question: "Pour quelle raison un homme peut-il se sentir coupable envers sa femme ?",
    reponses: [
      { ordre: 1, texte: "Infidèle", points: 90 },
      { ordre: 2, texte: "L'a frappée", points: 3 },
      { ordre: 3, texte: "A oublié son anniversaire", points: 2 },
      { ordre: 4, texte: "Pas bon au lit", points: 2 },
    ],
  },
  {
    question: "Qu'associe-t-on au Maroc ?",
    reponses: [
      { ordre: 1, texte: "Couscous", points: 23 },
      { ordre: 2, texte: "Soleil/Chaleur", points: 23 },
      { ordre: 3, texte: "Hassan II", points: 10 },
      { ordre: 4, texte: "Désert/Sahara", points: 7 },
      { ordre: 5, texte: "Oranges", points: 7 },
      { ordre: 6, texte: "Marchés/Souks", points: 5 },
    ],
  },
  {
    question: "De quoi parlent les femmes chez le coiffeur ?",
    reponses: [
      { ordre: 1, texte: "Famille", points: 28 },
      { ordre: 2, texte: "Mode vestimentaire", points: 17 },
      { ordre: 3, texte: "Coiffure/Cheveux", points: 11 },
      { ordre: 4, texte: "Ragots/Commérages", points: 11 },
      { ordre: 5, texte: "Cuisine", points: 7 },
    ],
  },
];

export const defaultFinaleQuestions: FinaleQuestionData[] = [
  {
    ordre: 1,
    question: "Pourquoi un homme rejoindrait-il sa femme en vacances ?",
    points: 30,
    reponses: [
      { texte: "Jalousie/Soupçons", points: 43 },
      { texte: "Elle lui manque", points: 27 },
      { texte: "Elle a eu un accident", points: 18 },
      { texte: "Elle est malade", points: 6 },
      { texte: "Pour sa cuisine", points: 3 },
      { texte: "Enfant malade", points: 2 },
    ],
  },
  {
    ordre: 2,
    question: "Comment appelle-t-on un homme qui collectionne les conquêtes féminines ?",
    points: 30,
    reponses: [
      { texte: "Don Juan", points: 42 },
      { texte: "Macho", points: 16 },
      { texte: "Coureur", points: 10 },
      { texte: "Dragueur", points: 10 },
      { texte: "Casanova", points: 5 },
      { texte: "Play-boy", points: 4 },
      { texte: "Séducteur", points: 4 },
    ],
  },
  {
    ordre: 3,
    question: "Quand détestez-vous arriver en premier ?",
    points: 30,
    reponses: [
      { texte: "Fête/Réception", points: 54 },
      { texte: "Au travail", points: 10 },
      { texte: "Enterrement", points: 7 },
      { texte: "Repas d'affaires", points: 5 },
      { texte: "A table (maison)", points: 4 },
    ],
  },
  {
    ordre: 4,
    question: "Que seriez-vous surpris de trouver dans une église ?",
    points: 30,
    reponses: [
      { texte: "Animaux", points: 24 },
      { texte: "Diable", points: 7 },
      { texte: "Musulman", points: 7 },
      { texte: "Tenues indécentes", points: 7 },
      { texte: "Préservatifs", points: 5 },
    ],
  },
  {
    ordre: 5,
    question: "Quelle raison un homme donne-t-il pour justifier qu'il quitte sa femme ?",
    points: 30,
    reponses: [
      { texte: "Il en a trouvé une autre", points: 30 },
      { texte: "Il ne l'aime plus", points: 24 },
      { texte: "Elle est infidèle", points: 19 },
      { texte: "Elle n'est pas belle", points: 5 },
      { texte: "Maison mal rangée", points: 4 },
    ],
  },
];
