# CATER40 — Liens de test
# Mis à jour : 14 juin 2026
# Local : http://localhost:3000 | Prod : https://cater40.vercel.app

# ══════════════════════════════════════════════════════════
# JEU #1 — GROS BRAS (Solo Cater)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueur / Cater   → http://localhost:3000/jeu-bras
  Animateur        → http://localhost:3000/jeu-bras/animateur

PROD
  Joueur / Cater   → https://cater40.vercel.app/jeu-bras
  Animateur        → https://cater40.vercel.app/jeu-bras/animateur

FLOW DE TEST
  1. Ouvrir /jeu-bras → saisir un prénom → "En attente"
  2. Ouvrir /jeu-bras/animateur → vérifier joueur inscrit → cliquer "Lancer le jeu"
  3. La page joueur bascule sur les photos → Bon / Caca
  4. Terminer → classement animateur
  5. Tester "Nouvelle partie (reset)"


# ══════════════════════════════════════════════════════════
# JEU #2 — CONCOURS ORTHO (Multijoueur)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueur           → http://localhost:3000/concours-ortho
  Animateur        → http://localhost:3000/concours-ortho/animateur
  Classement       → http://localhost:3000/concours-ortho/classement

PROD
  Joueur           → https://cater40.vercel.app/concours-ortho
  Animateur        → https://cater40.vercel.app/concours-ortho/animateur
  Classement       → https://cater40.vercel.app/concours-ortho/classement

FLOW DE TEST
  1. Ouvrir /concours-ortho → saisir prénom → "En attente"
  2. Ouvrir /concours-ortho/animateur → "Lancer le concours"
  3. Lancer les questions une par une → vérifier réponses joueurs
  4. Corriger les réponses libres (✅ Valide / ❌ Incorrect)
  5. Lancer le classement → /concours-ortho/classement
  6. Révéler les joueurs un par un → confettis à la fin


# ══════════════════════════════════════════════════════════
# JEU #3 — DICTÉE (Multijoueur)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueur           → http://localhost:3000/dictee
  Animateur        → http://localhost:3000/dictee/animateur
  Correction IA    → http://localhost:3000/dictee/correction
  Classement       → http://localhost:3000/dictee/classement

PROD
  Joueur           → https://cater40.vercel.app/dictee
  Animateur        → https://cater40.vercel.app/dictee/animateur
  Correction IA    → https://cater40.vercel.app/dictee/correction
  Classement       → https://cater40.vercel.app/dictee/classement

FLOW DE TEST
  1. Ouvrir /dictee → saisir prénom → "En attente"
  2. Ouvrir /dictee/animateur → "Lancer la dictée"
     → Joueur voit "Écoute et écris" / Animateur voit le texte à lire
  3. Animateur → "Demander l'upload des copies"
     → Joueur voit le bouton photo → prendre une photo → "Photo envoyée"
  4. Animateur → "Lancer la correction IA" → /dictee/correction
  5. Analyser chaque copie → valider les fautes → "Valider cette copie"
  6. "Lancer le classement final" → /dictee/classement
  7. Révéler les joueurs un par un


# ══════════════════════════════════════════════════════════
# JEU #4 — FAMILLE EN OR (Multijoueur équipes)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueurs          → http://localhost:3000/famille-or
  Animateur        → http://localhost:3000/famille-or/animateur

PROD
  Joueurs          → https://cater40.vercel.app/famille-or
  Animateur        → https://cater40.vercel.app/famille-or/animateur

FLOW DE TEST
  1. Ouvrir /famille-or → saisir prénom → "En attente"
  2. Ouvrir /famille-or/animateur → nommer les équipes → "Assigner les équipes"
  3. Assigner chaque joueur à une équipe → "Lancer le jeu"
  4. Choisir quelle équipe commence → lancer une question
  5. Révéler les réponses une par une → vérifier scores côté joueurs
  6. Tester les croix → 3 croix → phase de vol
  7. Vol réussi : équipe voleuse prend les points révélés (pas les autres)
  8. Vol raté : première équipe garde ses points révélés
  9. Question suivante → terminer le jeu

RAPPEL LOGIQUE POINTS
  - Révéler une réponse = pas de points immédiats
  - Vol réussi = voleuse prend UNIQUEMENT les points déjà révélés
  - Vol raté = équipe avec 3 croix garde SES points révélés
  - Points non révélés = perdus dans tous les cas


# ══════════════════════════════════════════════════════════
# JEU #5 — MOTS CROISÉS (Widget Claude — hors app)
# ══════════════════════════════════════════════════════════

  Pas d'URL dans l'app — générer via widget Claude
  puis imprimer ou projeter le jour J.


# ══════════════════════════════════════════════════════════
# JEU #6 — UNE CATER EN OR (2 équipes tour à tour)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueurs          → http://localhost:3000/cater-en-or/joueurs
  Animateur/Cater  → http://localhost:3000/cater-en-or/animateur

PROD
  Joueurs          → https://cater40.vercel.app/cater-en-or/joueurs
  Animateur/Cater  → https://cater40.vercel.app/cater-en-or/animateur

FLOW DE TEST
  1. Ouvrir /cater-en-or/joueurs → saisir prénom → lobby
  2. Ouvrir /cater-en-or/animateur → assigner les équipes
  3. Lancer le jeu → première question s'affiche
  4. Bonne réponse équipe → surbrillance jaune sur toutes les interfaces
  5. Point équipe → score s'incrémente → question suivante
  6. Fin de jeu → score final affiché


# ══════════════════════════════════════════════════════════
# JEU #7 — PHOTOS GENS (Solo Cater)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueur / Cater   → http://localhost:3000/photos-gens
  Animateur        → http://localhost:3000/photos-gens/animateur

PROD
  Joueur / Cater   → https://cater40.vercel.app/photos-gens
  Animateur        → https://cater40.vercel.app/photos-gens/animateur

FLOW DE TEST
  Identique au Jeu #1 (Gros Bras) — même logique, photos de personnes


# ══════════════════════════════════════════════════════════
# JEU #8 — CITATIONS PERDUES (Solo Cater — pendu)
# ══════════════════════════════════════════════════════════

LOCAL
  Interface Cater  → http://localhost:3000/citations-perdues

PROD
  Interface Cater  → https://cater40.vercel.app/citations-perdues

FLOW DE TEST
  1. Onglet "Pendu" → phrases masquées avec tirets
  2. Acheter des lettres avec les points (valeur inverse Scrabble)
  3. Lettres fréquentes (A E I) = chères · lettres rares (K W X) = pas chères
  4. Modifier les points manuellement si besoin
  5. Cliquer "Compléter" sur une phrase → saisir la citation complète
  6. Onglet "Photos" → voir les 11 photos
  7. Associer chaque phrase à une photo (menu déroulant)


# ══════════════════════════════════════════════════════════
# JEU #9 — QUIZZ FRIENDS (Multijoueur QCM)
# ══════════════════════════════════════════════════════════

LOCAL
  Joueur / Cater   → http://localhost:3000/quizz-friends
  Animateur        → http://localhost:3000/quizz-friends/animateur
  Classement       → http://localhost:3000/quizz-friends/classement

PROD
  Joueur / Cater   → https://cater40.vercel.app/quizz-friends
  Animateur        → https://cater40.vercel.app/quizz-friends/animateur
  Classement       → https://cater40.vercel.app/quizz-friends/classement

FLOW DE TEST
  1. Ouvrir /quizz-friends → saisir prénom → "En attente"
     → Cater s'inscrit avec "Cater" (ou "Sophie") pour le bonus beauté
  2. Ouvrir /quizz-friends/animateur → "Mode animateur" → "Lancer le quiz"
  3. Lancer les questions une par une
     → Options mélangées (même ordre pour tous) · animateur voit la bonne réponse
     → compteur "X/Y joueurs ont répondu"
  4. "Fermer la question" entre chaque → questions passées disparaissent
  5. Après la dernière → "Lancer le classement final" → /quizz-friends/classement
  6. CLASSEMENT : reveal piloté UNIQUEMENT par l'animateur
     → animateur active le toggle 🔒 → 👁 Mode animateur
     → "Révéler le joueur suivant →" / "✨ Tout révéler"
     → joueurs PASSIFS (aucun bouton, mise à jour ≤ 2s via reveal_count)
  7. Cater révélée en dernier → score brut → badge "✨ +N points éclatante beauté ✨"
     → couronne 👑 + confettis

RAPPEL LOGIQUE BONUS CATER
  - Détection : prénom normalisé contient "cater" ou "sophie"
  - Si Cater ne gagne pas seule : bonus = (max_autres − brut_Cater) + 1
  - Résultat : Cater finit 1ère seule, 1 point devant le meilleur des autres
  - Bonus affiché devant tout le monde (c'est son anniversaire)


# ══════════════════════════════════════════════════════════
# PAGES UTILITAIRES
# ══════════════════════════════════════════════════════════

LOCAL
  Accueil hub      → http://localhost:3000
  Portail joueurs  → http://localhost:3000/joueurs
  Hub animateur    → http://localhost:3000/animateur
  Upload photos    → http://localhost:3000/upload-photos

PROD
  Accueil hub      → https://cater40.vercel.app
  Portail joueurs  → https://cater40.vercel.app/joueurs
  Hub animateur    → https://cater40.vercel.app/animateur
  Upload photos    → https://cater40.vercel.app/upload-photos

RAPPEL — LES 3 HUBS
  /            → Hub Cater : elle seule, accès à TOUS les jeux (solo + multi)
  /joueurs     → Hub invités : uniquement les jeux multijoueurs
  /animateur   → Hub animateur : tous les jeux en mode anim + statuts + reset


# ══════════════════════════════════════════════════════════
# CHECKLIST AVANT LE JOUR J
# ══════════════════════════════════════════════════════════

[ ] Injecter le vrai contenu (questions ortho, texte dictée, questions famille-or, cater-en-or, 11 citations, questions Friends)
[ ] Uploader les vraies photos de bras → /upload-photos
[ ] Uploader les vraies photos de personnes → /upload-photos
[ ] Placer les 11 photos citations dans Supabase Storage bucket "citations-photos"
[ ] Friends : exécuter ALTER TABLE reveal_count si pas déjà fait
[ ] Friends : tester le reveal piloté animateur (joueurs passifs)
[ ] Friends : vérifier inscription Cater en "Cater"/"Sophie" → bonus OK
[ ] Tester sur mobile Chrome Android
[ ] FAIRE UN RUN DE RÉPÉTITION avec 5-6 vrais téléphones sur la prod (conditions réelles)
[ ] Repasser la checklist de test complète end-to-end (tous les jeux)
[ ] Vérifier dernier build Vercel (vercel.com)
[ ] Préparer QR code → https://cater40.vercel.app
