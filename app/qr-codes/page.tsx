'use client'
// app/qr-codes/page.tsx — Page QR codes animateur (usage interne, non listée dans le hub)

// ─────────────────────────────────────────────────────────────────────────────
// LISTE DES JEUX MULTIJOUEURS
// Pour ajouter un jeu : copie une ligne ci-dessous, change nom + url.
// Le QR code se génère automatiquement.
// ─────────────────────────────────────────────────────────────────────────────
const JEUX_MULTI = [
  { nom: 'Concours Ortho',  url: 'https://cater40.vercel.app/concours-ortho' },
  { nom: 'Dictée',          url: 'https://cater40.vercel.app/dictee' },
  { nom: 'Famille en or',   url: 'https://cater40.vercel.app/famille-or' },
  { nom: 'Une Cater en or', url: 'https://cater40.vercel.app/cater-en-or/joueurs' },
  { nom: 'Quizz Friends',   url: 'https://cater40.vercel.app/quizz-friends' },
  // 👉 Pour ajouter un jeu : copie une ligne ci-dessus, change nom + url. Le QR se génère automatiquement.
]

import { useEffect, useState } from 'react'

function useQRDataURLs(urls: string[]) {
  const [dataURLs, setDataURLs] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    async function generate() {
      try {
        const QRCode = (await import('qrcode')).default
        const results = await Promise.all(
          urls.map((url) =>
            QRCode.toDataURL(url, {
              width: 280,
              margin: 2,
              color: { dark: '#000000', light: '#ffffff' },
            })
          )
        )
        if (!cancelled) setDataURLs(results)
      } catch (err) {
        console.error('QR generation failed', err)
      }
    }
    generate()
    return () => { cancelled = true }
  }, [urls])

  return dataURLs
}

export default function QRCodesPage() {
  const urls = JEUX_MULTI.map((j) => j.url)
  const dataURLs = useQRDataURLs(urls)

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .grid { display: grid !important; }
          .card { break-inside: avoid; border: 1px solid #ccc !important; background: white !important; }
          .card-nom { color: black !important; }
          .card-url { color: #444 !important; }
        }
      `}</style>

      <main className="min-h-screen bg-white text-black p-6">
        <div className="max-w-3xl mx-auto">

          {/* En-tête */}
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">QR codes — Cater40</h1>
            <p className="text-gray-500 text-sm mt-1">Jeux multijoueurs — à scanner par les invités</p>
          </div>

          {/* Bouton impression */}
          <div className="no-print text-center mb-6">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800"
            >
              🖨️ Imprimer
            </button>
          </div>

          {/* Grille de cartes */}
          <div className="grid grid-cols-2 gap-5">
            {JEUX_MULTI.map((jeu, i) => (
              <div
                key={jeu.url}
                className="card flex flex-col items-center gap-3 border border-gray-200 rounded-2xl p-5 bg-white"
              >
                {/* Nom du jeu bien visible au-dessus du QR */}
                <p className="card-nom text-center text-lg font-bold leading-tight">{jeu.nom}</p>

                {/* QR code */}
                {dataURLs[i] ? (
                  <img
                    src={dataURLs[i]}
                    alt={`QR ${jeu.nom}`}
                    width={250}
                    height={250}
                    className="rounded"
                  />
                ) : (
                  <div className="w-[250px] h-[250px] flex items-center justify-center bg-gray-100 rounded text-gray-400 text-sm">
                    Génération…
                  </div>
                )}

                {/* URL lisible sous le QR */}
                <p className="card-url text-center text-[11px] text-gray-400 break-all">{jeu.url}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </>
  )
}
