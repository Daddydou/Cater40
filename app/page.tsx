'use client'
// app/page.tsx — Accueil Cater40

const JEUX = [
  { slug: 'quizz-friends',     nom: 'Quizz Friends',     emoji: '🛋️', desc: 'QCM pour experts de Friends' },
  { slug: 'jeu-bras',          nom: 'Gros Bras',         emoji: '💪', desc: 'À qui appartient ce bras ?' },
  { slug: 'dictee',            nom: 'Dictée',            emoji: '📝', desc: 'Dictée corrigée par l\'IA' },
  { slug: 'citations-perdues', nom: 'Citations Perdues', emoji: '💬', desc: 'Le pendu des citations' },
  { slug: 'concours-ortho',    nom: 'Concours Ortho',    emoji: '✍️', desc: 'QCM & orthophonie' },
  { slug: 'famille-or',        nom: 'Famille en or',     emoji: '🏆', desc: '100 familles version Cater' },
  { slug: 'mots-croises',      nom: 'Mots croisés',      emoji: '🔤', desc: 'Widget Claude — hors app' },
  { slug: 'cater-en-or',       nom: 'Une Cater en or',   emoji: '🎯', desc: '2 équipes — tour à tour' },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-10 pt-6">
          <div className="text-5xl mb-3">🎂</div>
          <h1 className="text-3xl font-bold mb-1">Cater40</h1>
          <p className="text-white/50 text-sm">Les jeux des 40 ans de Cater</p>
        </div>

        <div className="grid grid-cols-1 gap-3">
          {JEUX.map((jeu) => {
            if (jeu.slug === 'mots-croises') {
              return (
                <div key={jeu.slug}
                  className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 opacity-50">
                  <span className="text-3xl w-10 text-center">{jeu.emoji}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{jeu.nom}</span>
                      <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Widget Claude</span>
                    </div>
                    <p className="text-white/40 text-sm mt-0.5">{jeu.desc}</p>
                  </div>
                </div>
              )
            }
            return (
              <a key={jeu.slug} href={`/${jeu.slug}`}
                className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-2xl p-4 transition-all group">
                <span className="text-3xl w-10 text-center">{jeu.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold group-hover:text-white transition-colors">{jeu.nom}</span>
                  </div>
                  <p className="text-white/40 text-sm mt-0.5">{jeu.desc}</p>
                </div>
                <span className="text-white/20 group-hover:text-white/60 transition-colors">→</span>
              </a>
            )
          })}
        </div>

        <div className="mt-6 flex items-center justify-center gap-6">
          <a href="/joueurs" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            👥 Portail joueurs
          </a>
          <a href="/animateur" className="text-sm text-white/40 hover:text-white/70 transition-colors">
            🎛️ Hub animateur
          </a>
          <a href="/upload-photos" className="text-xs text-white/20 hover:text-white/50 transition-colors underline underline-offset-2">
            Upload photos
          </a>
        </div>
      </div>
    </main>
  )
}