'use client'
// app/joueurs/page.tsx — Portail joueurs

const JEUX = [
  { num: 2, nom: 'Concours Ortho',  emoji: '✍️', desc: 'QCM & orthophonie',             href: '/concours-ortho' },
  { num: 3, nom: 'Dictée',          emoji: '📝', desc: 'Dictée corrigée par l\'IA',       href: '/dictee' },
  { num: 4, nom: 'Famille en or',   emoji: '🏆', desc: '100 familles version Cater',      href: '/famille-or' },
  { num: 6, nom: 'Une Cater en or', emoji: '🎯', desc: '2 équipes — tour à tour',          href: '/cater-en-or/joueurs' },
  { num: 9, nom: 'Quizz Friends',   emoji: '🛋️', desc: 'QCM sur la série Friends',        href: '/quizz-friends' },
]

export default function PortailJoueurs() {
  return (
    <main className="min-h-screen bg-[#0f0f1a] text-white p-6">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-10 pt-6">
          <div className="text-5xl mb-3">🎂</div>
          <h1 className="text-2xl font-bold mb-1">Bienvenue ! Choisis ton jeu</h1>
          <p className="text-white/50 text-sm">Les jeux de l&apos;anniversaire de Cater 🎂</p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {JEUX.map(jeu => (
            <a
              key={jeu.num}
              href={jeu.href}
              className="flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/25 rounded-2xl p-5 transition-all group active:scale-[0.98]"
            >
              <span className="text-4xl w-12 text-center">{jeu.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-xs text-white/40 font-mono">#{jeu.num}</span>
                  <span className="font-bold text-lg group-hover:text-white transition-colors">{jeu.nom}</span>
                </div>
                <p className="text-white/40 text-sm">{jeu.desc}</p>
              </div>
              <span className="text-white/20 group-hover:text-white/60 text-xl transition-colors">→</span>
            </a>
          ))}
        </div>

        <div className="mt-8 text-center">
          <a href="/" className="text-white/30 hover:text-white/60 text-sm transition-colors">
            ← Retour à l&apos;accueil
          </a>
        </div>
      </div>
    </main>
  )
}
