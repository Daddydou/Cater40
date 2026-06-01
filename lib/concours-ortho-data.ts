export interface DefaultQuestion {
  ordre: number;
  type: 'qcm' | 'libre';
  question: string;
  propositions: string[] | null;
  bonne_reponse: string;
}

export const defaultQuestions: DefaultQuestion[] = [
  // ── QCM ────────────────────────────────────────────────────
  {
    ordre: 1,
    type: 'qcm',
    question: "Quelle est la définition de la 'pragmatique' en linguistique ?",
    propositions: [
      "L'étude des sons du langage",
      "L'utilisation du langage en contexte social",
      "La structure interne des mots",
      "L'ordre des mots dans une phrase",
    ],
    bonne_reponse: "L'utilisation du langage en contexte social",
  },
  {
    ordre: 2,
    type: 'qcm',
    question: "Quel terme désigne la difficulté spécifique à lire et à écrire ?",
    propositions: [
      "Dysphasie",
      "Dysarthrie",
      "Dyslexie",
      "Dyspraxie",
    ],
    bonne_reponse: "Dyslexie",
  },
  {
    ordre: 3,
    type: 'qcm',
    question: "Le bégaiement est principalement un trouble de…",
    propositions: [
      "La compréhension",
      "La fluidité de la parole",
      "La mémoire verbale",
      "L'articulation des consonnes",
    ],
    bonne_reponse: "La fluidité de la parole",
  },
  {
    ordre: 4,
    type: 'qcm',
    question: "Quelle aire cérébrale est principalement associée à la production du langage ?",
    propositions: [
      "L'aire de Wernicke",
      "Le cervelet",
      "L'aire de Broca",
      "Le cortex visuel",
    ],
    bonne_reponse: "L'aire de Broca",
  },
  {
    ordre: 5,
    type: 'qcm',
    question: "La dysphagie désigne une difficulté à…",
    propositions: [
      "Parler en public",
      "Avaler",
      "Lire à voix haute",
      "Entendre les sons aigus",
    ],
    bonne_reponse: "Avaler",
  },
  // ── Réponses libres ─────────────────────────────────────────
  {
    ordre: 6,
    type: 'libre',
    question: "Qu'est-ce qu'un phonème ? Donnez un exemple.",
    propositions: null,
    bonne_reponse: "La plus petite unité sonore distinctive d'une langue (ex : /p/ dans « pain »).",
  },
  {
    ordre: 7,
    type: 'libre',
    question: "Citez un signe précoce pouvant indiquer un retard de langage chez un enfant de 2 ans.",
    propositions: null,
    bonne_reponse: "Absence de mots simples, peu de babillage, ne pointe pas du doigt.",
  },
  {
    ordre: 8,
    type: 'libre',
    question: "Quel est le rôle d'un orthophoniste dans la prise en charge post-AVC ?",
    propositions: null,
    bonne_reponse: "Rééduquer les troubles du langage, de la parole et de la déglutition consécutifs à l'AVC.",
  },
  {
    ordre: 9,
    type: 'libre',
    question: "Décrivez en quelques mots la différence entre langage oral et langage écrit.",
    propositions: null,
    bonne_reponse: "Le langage oral est spontané et s'appuie sur la voix ; le langage écrit est différé et utilise des symboles graphiques.",
  },
  {
    ordre: 10,
    type: 'libre',
    question: "Qu'est-ce que la conscience phonologique et pourquoi est-elle importante pour la lecture ?",
    propositions: null,
    bonne_reponse: "Capacité à identifier et manipuler les sons du langage ; fondamentale pour décoder l'écrit.",
  },
];
