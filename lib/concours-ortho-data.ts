export interface DefaultQuestion {
  ordre: number;
  type: 'qcm';
  section: string;
  question: string;
  propositions: string[];
  bonne_reponse: string;
  explication: string;
}

export const defaultQuestions: DefaultQuestion[] = [

  // ══ I — VOCABULAIRE
  {
    ordre: 1,
    type: 'qcm',
    section: 'I — Vocabulaire',
    question: `Quelle est la définition du mot « périgée » ?`,
    propositions: [
      'A — Plancher du petit bassin',
    'B — Sans valeur',
    'C — Point de l\'orbite le plus proche de la Terre',
    'D — Contour extérieur',
    'E — Construite',
    ],
    bonne_reponse: 'C — Point de l\'orbite le plus proche de la Terre',
    explication: `Le périgée est le point de l'orbite d'un astre le plus proche de la Terre (ou du corps autour duquel il gravite).`,
  },
  {
    ordre: 2,
    type: 'qcm',
    section: 'I — Vocabulaire',
    question: `Quelle est la définition du mot « cistre » ?`,
    propositions: [
      'A — Luth (instrument à cordes pincées)',
    'B — Arbrisseau',
    'C — Corbeille d\'osier',
    'D — Espèce de courge',
    'E — Brun noirâtre',
    ],
    bonne_reponse: 'A — Luth (instrument à cordes pincées)',
    explication: `Le cistre est un instrument à cordes pincées, proche du luth, populaire aux XVIe-XVIIe siècles.`,
  },
  {
    ordre: 3,
    type: 'qcm',
    section: 'I — Vocabulaire',
    question: `Quelle est la définition du mot « balane » ?`,
    propositions: [
      'A — Fruit',
    'B — Danse',
    'C — Instrument à percussion',
    'D — Crustacé sessile',
    'E — Baume tiré d\'un peuplier',
    ],
    bonne_reponse: 'D — Crustacé sessile',
    explication: `La balane est un crustacé sessile en forme de cône qui s'accroche aux rochers et aux coques de bateaux.`,
  },
  {
    ordre: 4,
    type: 'qcm',
    section: 'I — Vocabulaire',
    question: `Quelle est la définition du mot « adret » ?`,
    propositions: [
      'A — Ubac',
    'B — Versant ensoleillé',
    'C — Avec adresse',
    'D — Poète grec',
    'E — Tribord',
    ],
    bonne_reponse: 'B — Versant ensoleillé',
    explication: `L'adret est le versant d'une montagne exposé au soleil. Son contraire est l'ubac.`,
  },
  {
    ordre: 5,
    type: 'qcm',
    section: 'I — Vocabulaire',
    question: `Quelle est la définition du mot « rhizome » ?`,
    propositions: [
      'A — Coryza',
    'B — Tige souterraine',
    'C — Méduse',
    'D — Muscle facial',
    'E — Boisson astringente',
    ],
    bonne_reponse: 'B — Tige souterraine',
    explication: `Le rhizome est une tige souterraine horizontale de certaines plantes (iris, gingembre).`,
  },

  // ══ II — CHASSEZ L'INTRUS
  {
    ordre: 11,
    type: 'qcm',
    section: 'II — Chassez l\'intrus',
    question: `Chassez l'intrus — Ces mots ont une propriété linguistique commune, sauf un :
greffe · moule · touriste · manche · mémoire`,
    propositions: [
      'A — greffe',
    'B — moule',
    'C — touriste',
    'D — manche',
    'E — mémoire',
    ],
    bonne_reponse: 'C — touriste',
    explication: `Greffe, moule, manche, mémoire sont des mots polysémiques (plusieurs sens très différents). Touriste n'a qu'un sens courant.`,
  },
  {
    ordre: 12,
    type: 'qcm',
    section: 'II — Chassez l\'intrus',
    question: `Chassez l'intrus — Ces mots sont des pluralia tantum (n'existent qu'au pluriel), sauf un :
obsèques · ténèbres · arrhes · funérailles · vacances`,
    propositions: [
      'A — obsèques',
    'B — ténèbres',
    'C — arrhes',
    'D — funérailles',
    'E — vacances',
    ],
    bonne_reponse: 'E — vacances',
    explication: `Obsèques, ténèbres, arrhes, funérailles sont des pluralia tantum stricts. Vacances a un singulier usuel (une vacance de poste).`,
  },
  {
    ordre: 13,
    type: 'qcm',
    section: 'II — Chassez l\'intrus',
    question: `Chassez l'intrus — Ces mots composés sont formés avec verbe + nom, sauf un :
chou-fleur · brise-glace · pare-boue · porte-monnaie · casse-tête`,
    propositions: [
      'A — chou-fleur',
    'B — brise-glace',
    'C — pare-boue',
    'D — porte-monnaie',
    'E — casse-tête',
    ],
    bonne_reponse: 'A — chou-fleur',
    explication: `Brise-glace, pare-boue, porte-monnaie, casse-tête = verbe + nom. Chou-fleur = nom + nom — c'est l'intrus.`,
  },
  {
    ordre: 14,
    type: 'qcm',
    section: 'II — Chassez l\'intrus',
    question: `Chassez l'intrus — Ces verbes appartiennent au 3e groupe, sauf un :
rougir · courir · mourir · ouvrir · partir`,
    propositions: [
      'A — rougir',
    'B — courir',
    'C — mourir',
    'D — ouvrir',
    'E — partir',
    ],
    bonne_reponse: 'A — rougir',
    explication: `Courir, mourir, ouvrir, partir = 3e groupe. Rougir = 2e groupe (rougissant) — c'est l'intrus.`,
  },
  {
    ordre: 15,
    type: 'qcm',
    section: 'II — Chassez l\'intrus',
    question: `Chassez l'intrus — Ces mots sont des pronoms, sauf un :
celle · le mien · chacun · notre · lequel`,
    propositions: [
      'A — celle',
    'B — le mien',
    'C — chacun',
    'D — notre',
    'E — lequel',
    ],
    bonne_reponse: 'D — notre',
    explication: `Celle, le mien, chacun, lequel sont des pronoms. Notre est un adjectif possessif — c'est l'intrus.`,
  },

  // ══ III — CONJUGAISON
  {
    ordre: 21,
    type: 'qcm',
    section: 'III — Conjugaison',
    question: `ACQUÉRIR — Trouvez la forme incorrecte (E si toutes sont correctes) :
A: acquiers · B: que nous acquérions · C: j'acquérais · D: tu acquerras`,
    propositions: [
      'A — acquiers',
    'B — que nous acquérions',
    'C — j\'acquérais',
    'D — tu acquerras',
    'E — Toutes les formes sont correctes',
    ],
    bonne_reponse: 'E — Toutes les formes sont correctes',
    explication: `Acquiers (présent), que nous acquérions (subj.), j'acquérais (imparfait), tu acquerras (futur) — toutes correctes.`,
  },
  {
    ordre: 22,
    type: 'qcm',
    section: 'III — Conjugaison',
    question: `TRESSAILLIR — Trouvez la forme incorrecte :
A: je tressaillerai · B: qu'il tressaillît · C: tressaillant · D: nous tressaillons`,
    propositions: [
      'A — je tressaillerai',
    'B — qu\'il tressaillît',
    'C — tressaillant',
    'D — nous tressaillons',
    'E — Toutes les formes sont correctes',
    ],
    bonne_reponse: 'A — je tressaillerai',
    explication: `Le futur correct est « je tressaillirai » (pas tressaillerai). Les formes B, C, D sont correctes.`,
  },
  {
    ordre: 23,
    type: 'qcm',
    section: 'III — Conjugaison',
    question: `VALOIR — Trouvez la forme incorrecte :
A: valu · B: que nous valions · C: vaux · D: que je vale`,
    propositions: [
      'A — valu',
    'B — que nous valions',
    'C — vaux',
    'D — que je vale',
    'E — Toutes les formes sont correctes',
    ],
    bonne_reponse: 'D — que je vale',
    explication: `Le subjonctif présent de valoir est « que je vaille » (pas vale). Valu, que nous valions, vaux sont corrects.`,
  },
  {
    ordre: 24,
    type: 'qcm',
    section: 'III — Conjugaison',
    question: `FUIR — Trouvez la forme incorrecte :
A: elle fuirait · B: je fuierai · C: fuîtes-vous · D: fui`,
    propositions: [
      'A — elle fuirait',
    'B — je fuierai',
    'C — fuîtes-vous',
    'D — fui',
    'E — Toutes les formes sont correctes',
    ],
    bonne_reponse: 'B — je fuirai',
    explication: `Fais-moi confiance.`,
  },
  {
    ordre: 25,
    type: 'qcm',
    section: 'III — Conjugaison',
    question: `ABSOUDRE — Trouvez la forme incorrecte :
A: absolu · B: nous absoudrions · C: que j'absolve · D: il absout`,
    propositions: [
      'A — absolu',
    'B — nous absoudrions',
    'C — que j\'absolve',
    'D — il absout',
    'E — Toutes les formes sont correctes',
    ],
    bonne_reponse: 'A — absolu',
    explication: `« Absolu » n'est pas une forme d'absoudre (c'est un adjectif). Le participe passé d'absoudre est « absous/absoute ».`,
  },

  // ══ IV — VRAI OU FAUX
  {
    ordre: 31,
    type: 'qcm',
    section: 'IV — Vrai ou Faux',
    question: `VRAI ou FAUX ?
L'énoncé « pas mal, ton histoire » est une litote.`,
    propositions: [
      'A — Vrai',
    'B — Faux',
    ],
    bonne_reponse: 'A — Vrai',
    explication: `Une litote exprime beaucoup en disant peu. « Pas mal » pour « très bien » en est un exemple classique.`,
  },
  {
    ordre: 32,
    type: 'qcm',
    section: 'IV — Vrai ou Faux',
    question: `VRAI ou FAUX ?
L'adjectif possessif s'accorde en personne avec le possesseur de l'objet possédé.`,
    propositions: [
      'A — Vrai',
    'B — Faux',
    ],
    bonne_reponse: 'A — Vrai',
    explication: `Il s'accorde en personne/nombre avec le possesseur et en genre/nombre avec le nom accompagné.`,
  },
  {
    ordre: 33,
    type: 'qcm',
    section: 'IV — Vrai ou Faux',
    question: `VRAI ou FAUX ?
« Une décision a des conséquences » est un syntagme nominal.`,
    propositions: [
      'A — Vrai',
    'B — Faux',
    ],
    bonne_reponse: 'B — Faux',
    explication: `C'est une phrase verbale. Un syntagme nominal serait : « une décision aux lourdes conséquences ».`,
  },
  {
    ordre: 34,
    type: 'qcm',
    section: 'IV — Vrai ou Faux',
    question: `VRAI ou FAUX ?
« Aucun » est un adjectif numéral cardinal.`,
    propositions: [
      'A — Vrai',
    'B — Faux',
    ],
    bonne_reponse: 'B — Faux',
    explication: `« Aucun » est un adjectif indéfini, pas un numéral cardinal.`,
  },
  {
    ordre: 35,
    type: 'qcm',
    section: 'IV — Vrai ou Faux',
    question: `VRAI ou FAUX ?
Un adjectif qualificatif épithète est toujours antéposé (placé avant le nom).`,
    propositions: [
      'A — Vrai',
    'B — Faux',
    ],
    bonne_reponse: 'B — Faux',
    explication: `Un adjectif épithète peut être antéposé (« belle maison ») ou postposé (« maison bleue »).`,
  },

  // ══ V — NATURE ET FONCTION
  {
    ordre: 41,
    type: 'qcm',
    section: 'V — Nature et Fonction',
    question: `Quelle est la nature/fonction du mot souligné ?
Je fais [mienne] cette opinion.`,
    propositions: [
      'A — Attribut du sujet',
    'B — Complément d\'objet direct',
    'C — Épithète',
    'D — Attribut du complément d\'objet',
    ],
    bonne_reponse: 'D — Attribut du complément d\'objet',
    explication: `C'est Manag qui l'a dit !`,
  },
  {
    ordre: 42,
    type: 'qcm',
    section: 'V — Nature et Fonction',
    question: `Quelle est la nature du mot souligné ?
J'[y] reste.`,
    propositions: [
      'A — Adverbe de lieu',
    'B — Pronom indéfini',
    'C — Pronom relatif',
    'D — Pronom personnel',
    'E — Adverbe de lieu',
    ],
    bonne_reponse: 'E — Adverbe de lieu',
    explication: `« Y » est un pronom adverbial de lieu remplaçant « là / dans cet endroit ».`,
  },
  {
    ordre: 43,
    type: 'qcm',
    section: 'V — Nature et Fonction',
    question: `Quelle est la nature du mot souligné ?
Il exercerait bien un [tout] autre travail.`,
    propositions: [
      'A — Adverbe',
    'B — Pronom indéfini',
    'C — Adjectif indéfini',
    'D — Adjectif qualificatif',
    'E — Autre',
    ],
    bonne_reponse: 'A — Adverbe',
    explication: `« Tout » devant un adjectif est adverbe (= entièrement). « Tout autre » = entièrement autre.`,
  },
  {
    ordre: 44,
    type: 'qcm',
    section: 'V — Nature et Fonction',
    question: `Quelle est la fonction du mot souligné ?
Ce tapis est mangé aux [mites].`,
    propositions: [
      'A — Complément circonstanciel de moyen',
    'B — Complément d\'agent',
    'C — Complément d\'objet',
    'D — Complément d\'objet indirect',
    'E — Autre',
    ],
    bonne_reponse: 'B — Complément d\'agent',
    explication: `Construction passive : les mites = agent. Reformulation : les mites mangent ce tapis.`,
  },
  {
    ordre: 45,
    type: 'qcm',
    section: 'V — Nature et Fonction',
    question: `Quelle est la nature du mot souligné ?
J'[y] songe.`,
    propositions: [
      'A — Adverbe de lieu',
    'B — Pronom personnel',
    'C — Pronom relatif',
    'D — Pronom indéfini',
    'E — Autre',
    ],
    bonne_reponse: 'D — Pronom indéfini',
    explication: `C'est Manag qui l'a dit !`,
  },

  // ══ CULTURE GÉNÉRALE
  {
    ordre: 51,
    type: 'qcm',
    section: 'Culture générale',
    question: `Le film « La Grande Illusion » a été réalisé par :`,
    propositions: [
      '1 — Orson Welles',
    '2 — John Ford',
    '3 — Jean Renoir',
    '4 — François Truffaut',
    '5 — Jean-Luc Godard',
    ],
    bonne_reponse: '3 — Jean Renoir',
    explication: `Chef-d'œuvre de 1937, avec Jean Gabin et Erich von Stroheim. Film sur la Première Guerre mondiale.`,
  },
  {
    ordre: 52,
    type: 'qcm',
    section: 'Culture générale',
    question: `Parmi ces œuvres théâtrales, laquelle n'est PAS de Molière ?`,
    propositions: [
      '1 — L\'Avare',
    '2 — Les Plaideurs',
    '3 — L\'Amour médecin',
    '4 — Les Précieuses Ridicules',
    '5 — Le Bourgeois gentilhomme',
    ],
    bonne_reponse: '2 — Les Plaideurs',
    explication: `Les Plaideurs est une comédie de Jean Racine (1668). Les autres pièces sont bien de Molière.`,
  },
  {
    ordre: 53,
    type: 'qcm',
    section: 'Culture générale',
    question: `Le Soleil est plus volumineux que la Terre. Dans quelle proportion ?`,
    propositions: [
      '1 — 130 fois',
    '2 — 1 300 fois',
    '3 — 13 000 fois',
    '4 — 130 000 fois',
    '5 — 1 300 000 fois',
    ],
    bonne_reponse: '5 — 1 300 000 fois',
    explication: `Le Soleil est ~1,3 million de fois plus volumineux. Diamètre ×109 → Volume ×109³ ≈ 1 300 000.`,
  },
  {
    ordre: 54,
    type: 'qcm',
    section: 'Culture générale',
    question: `Ludwig van Beethoven a écrit combien de symphonies ?`,
    propositions: [
      '1 — Trois',
    '2 — Cinq',
    '3 — Neuf',
    '4 — Douze',
    '5 — Vingt',
    ],
    bonne_reponse: '3 — Neuf',
    explication: `Beethoven a composé 9 symphonies, dont la célèbre 5e (ta-ta-ta-TAA) et la 9e (Ode à la Joie).`,
  },
  {
    ordre: 55,
    type: 'qcm',
    section: 'Culture générale',
    question: `L'actuel Souverain du Maroc s'appelle :`,
    propositions: [
      '1 — Abdallah II',
    '2 — Hassan II',
    '3 — Mohammed V',
    '4 — Mohammed VI',
    '5 — Farouk 1er',
    ],
    bonne_reponse: '4 — Mohammed VI',
    explication: `Mohammed VI règne depuis 1999 (après le décès de Hassan II). Toujours en place au moment du concours (2005).`,
  },

  // ══ RAISONNEMENT
  {
    ordre: 61,
    type: 'qcm',
    section: 'Raisonnement',
    question: `Si 7 personnes se rencontrent et que chacune ne serre la main des autres qu'une seule fois, combien de poignées de main seront échangées ?`,
    propositions: [
      '1 — 6',
    '2 — 21',
    '3 — 36',
    '4 — 42',
    '5 — 49',
    ],
    bonne_reponse: '2 — 21',
    explication: `C(7,2) = 7×6/2 = 21. Chaque paire unique de personnes échange une poignée de main.`,
  },
  {
    ordre: 62,
    type: 'qcm',
    section: 'Raisonnement',
    question: `On ajoute 1 mètre à une ficelle faisant le tour de la Terre ET à une ficelle faisant le tour d'une roue. Les deux s'éloignent-elles autant, plus ou moins ?`,
    propositions: [
      '1 — Autant',
    '2 — Plus (la roue)',
    '3 — Moins (la roue)',
    ],
    bonne_reponse: '1 — Autant',
    explication: `Δrayon = 1/(2π) ≈ 16 cm, quelle que soit la circonférence initiale. Le résultat est identique pour la Terre et la roue !`,
  },
  {
    ordre: 63,
    type: 'qcm',
    section: 'Raisonnement',
    question: `Un bouquet de 8 fleurs : 7 tulipes dont 6 rouges. Combien de bouquets différents selon les critères « tulipe » et « rouge » ?`,
    propositions: [
      '1 — 1',
    '2 — 2',
    '3 — 4',
    '4 — On ne peut pas savoir',
    '5 — 8',
    ],
    bonne_reponse: '3 — 4',
    explication: `Combinaisons : tulipes rouges (6), tulipes non-rouges (1), non-tulipes rouges (0), non-tulipes non-rouges (1) = 4 configurations.`,
  },
  {
    ordre: 64,
    type: 'qcm',
    section: 'Raisonnement',
    question: `1 microbe double/seconde, remplit un pot en 60s. Avec 4 microbes au départ, combien de temps ?`,
    propositions: [
      '1 — 60s',
    '2 — 30s',
    '3 — 58s',
    '4 — 56s',
    '5 — 15s',
    ],
    bonne_reponse: '3 — 58 secondes',
    explication: `4 microbes = 2² → on gagne 2 secondes. Donc 60 − 2 = 58 secondes.`,
  },
  {
    ordre: 65,
    type: 'qcm',
    section: 'Raisonnement',
    question: `Vol Zing→Setnan : 9h00→13h40. Vol Setnan→Zing : 15h00→21h40.
Si l'horloge de Zing lit 0h50 le 4 janv., que lit l'horloge de Setnan ?`,
    propositions: [
      '1 — Lundi 3/01, 22h50',
    '2 — Lundi 3/01, 23h50',
    '3 — Mardi 4/01, 0h50',
    '4 — Mardi 4/01, 1h50',
    '5 — Mardi 4/01, 2h50',
    ],
    bonne_reponse: '5 — Mardi 4 janv., 2h50',
    explication: `Durée A→B = 4h40, B→A = 6h40 → décalage = 2h. Setnan est en avance de 2h. 0h50 + 2h = 2h50.`,
  },
];
