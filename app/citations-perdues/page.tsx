'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { listBucketPhotos, StoragePhoto } from '@/lib/storage-utils';

// ── Constantes ────────────────────────────────────────────────────────────────

const LETTER_VALUES: Record<string, number> = {
  A: 10, E: 10, I: 10, O: 10, U: 10,
  N: 10, R: 10, S: 10, T: 10, L: 10,
  D: 5,  G: 5,  M: 5,
  B: 4,  C: 4,  P: 4,
  F: 3,  H: 3,  V: 3,
  J: 2,  Q: 2,
  K: 1,  W: 1,  X: 1,  Y: 1,  Z: 1,
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

const PHRASES = [
  "La vie est belle",
  "Je pense donc je suis",
  "L'amour est aveugle",
  "Le temps c'est de l'argent",
  "Qui vivra verra",
  "La nuit porte conseil",
  "Vouloir c'est pouvoir",
  "Il faut cultiver notre jardin",
  "Les absents ont toujours tort",
  "Mieux vaut tard que jamais",
  "La fortune sourit aux audacieux",
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface GameSession {
  id: string;
  points: number;
  lettres_achetees: string[];
  associations: Record<string, number | null>;
  completees?: boolean[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeLetter(char: string): string {
  return char.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

function isAlpha(char: string): boolean {
  return /^[A-Z]$/.test(normalizeLetter(char));
}

function normalizePhrase(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CitationsPerduesPage() {
  const [tab, setTab] = useState<'pendu' | 'photos'>('pendu');
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [photos, setPhotos] = useState<StoragePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [pointsInput, setPointsInput] = useState('0');
  const [completees, setCompletees] = useState<boolean[]>(() => PHRASES.map(() => false));
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [completeInputs, setCompleteInputs] = useState<string[]>(() => PHRASES.map(() => ''));
  const [wrongIdx, setWrongIdx] = useState<number | null>(null);
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrongTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch session ────────────────────────────────────────────────────────────

  const fetchSession = useCallback(async () => {
    const { data } = await supabase
      .from('citations_game')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      setSession(data as GameSession);
      setPointsInput(String(data.points));
      if (Array.isArray(data.completees)) {
        setCompletees(data.completees);
      } else {
        try {
          const stored = localStorage.getItem('citations-completees');
          if (stored) setCompletees(JSON.parse(stored));
        } catch {}
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const createSession = async () => {
    const { data } = await supabase
      .from('citations_game')
      .insert({ points: 0, lettres_achetees: [], associations: {}, completees: PHRASES.map(() => false) })
      .select()
      .single();
    if (data) {
      setSession(data as GameSession);
      setPointsInput('0');
      setCompletees(PHRASES.map(() => false));
    }
  };

  // ── Realtime ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!session) return;
    const sid = session.id;
    const channel = supabase
      .channel(`citations-${sid}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'citations_game',
        filter: `id=eq.${sid}`,
      }, (payload) => {
        const updated = payload.new as GameSession;
        setSession(updated);
        setPointsInput(String(updated.points));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  // ── Photos (chargées au premier clic sur l'onglet) ────────────────────────

  useEffect(() => {
    if (tab !== 'photos') return;
    setLoadingPhotos(true);
    listBucketPhotos('citations-photos').then(items => {
      setPhotos(items);
      setLoadingPhotos(false);
    });
  }, [tab]);

  // ── Helpers UI ───────────────────────────────────────────────────────────────

  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(''), 2500);
  };

  // ── Actions ──────────────────────────────────────────────────────────────────

  const buyLetter = async (letter: string) => {
    if (!session || session.lettres_achetees.includes(letter)) return;
    const cost = LETTER_VALUES[letter];
    if (session.points < cost) {
      showError(`Pas assez de points — il faut ${cost} pts pour le « ${letter} »`);
      return;
    }
    const newLettres = [...session.lettres_achetees, letter];
    const newPoints = session.points - cost;
    // Mise à jour optimiste locale
    setSession(prev => prev ? { ...prev, points: newPoints, lettres_achetees: newLettres } : prev);
    setPointsInput(String(newPoints));
    await supabase
      .from('citations_game')
      .update({ points: newPoints, lettres_achetees: newLettres })
      .eq('id', session.id);
  };

  const commitPoints = async (raw: string) => {
    if (!session) return;
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    setSession(prev => prev ? { ...prev, points: val } : prev);
    await supabase.from('citations_game').update({ points: val }).eq('id', session.id);
  };

  const updateAssociation = async (phraseIdx: number, photoNum: number | null) => {
    if (!session) return;
    const newAssoc = { ...session.associations, [String(phraseIdx)]: photoNum };
    setSession(prev => prev ? { ...prev, associations: newAssoc } : prev);
    await supabase.from('citations_game').update({ associations: newAssoc }).eq('id', session.id);
  };

  const resetGame = async () => {
    if (!session) return;
    const freshCompletees = PHRASES.map(() => false);
    const fresh = { points: 0, lettres_achetees: [] as string[], associations: {}, completees: freshCompletees };
    setSession(prev => prev ? { ...prev, ...fresh } : prev);
    setPointsInput('0');
    setCompletees(freshCompletees);
    setOpenIdx(null);
    setCompleteInputs(PHRASES.map(() => ''));
    await supabase.from('citations_game').update(fresh).eq('id', session.id);
    try { localStorage.removeItem('citations-completees'); } catch {}
  };

  const completePhrase = async (idx: number) => {
    if (!session) return;
    if (normalizePhrase(completeInputs[idx]) !== normalizePhrase(PHRASES[idx])) {
      setWrongIdx(idx);
      if (wrongTimer.current) clearTimeout(wrongTimer.current);
      wrongTimer.current = setTimeout(() => setWrongIdx(null), 2000);
      return;
    }
    const newCompletees = completees.map((v, i) => i === idx ? true : v);
    setCompletees(newCompletees);
    setOpenIdx(null);
    const { error } = await supabase
      .from('citations_game')
      .update({ completees: newCompletees })
      .eq('id', session.id);
    if (error) {
      try { localStorage.setItem('citations-completees', JSON.stringify(newCompletees)); } catch {}
    }
  };

  // ── Rendu d'une phrase masquée ────────────────────────────────────────────

  const renderPhrase = (phrase: string, achetees: string[], completed = false) =>
    phrase.split('').map((char, i) => {
      if (char === ' ')
        return <span key={i} className="inline-block w-3" />;
      if (!isAlpha(char))
        return <span key={i} className="text-gray-400 mx-px">{char}</span>;
      const norm = normalizeLetter(char);
      return (completed || achetees.includes(norm))
        ? <span key={i} className="text-yellow-300 font-bold mx-px">{char.toUpperCase()}</span>
        : <span key={i} className="text-gray-700 mx-px select-none">_</span>;
    });

  // ─────────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-gray-500 animate-pulse tracking-widest text-sm uppercase">Chargement…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="text-center space-y-6">
          <div className="text-6xl select-none">🎭</div>
          <h1 className="text-3xl font-bold text-yellow-400 tracking-wide" style={{ fontFamily: 'Georgia, serif' }}>
            Citations Perdues
          </h1>
          <button
            onClick={createSession}
            className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black px-10 py-4 rounded-2xl text-lg transition-colors"
          >
            Nouvelle partie
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: 'Georgia, serif' }}>

      {/* ── En-tête ────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-800/80 px-4 py-3 flex items-center justify-between backdrop-blur-sm sticky top-0 bg-gray-950/95 z-10">
        <h1 className="text-base font-bold text-yellow-400 tracking-widest uppercase">
          🎭 Citations Perdues
        </h1>
        <button
          onClick={resetGame}
          className="text-xs text-gray-700 hover:text-red-500 transition-colors tracking-wide"
        >
          Réinitialiser
        </button>
      </div>

      {/* ── Onglets ────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-800">
        {(['pendu', 'photos'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-bold tracking-wide transition-colors ${
              tab === t
                ? 'text-yellow-400 border-b-2 border-yellow-400 bg-yellow-400/5'
                : 'text-gray-600 hover:text-gray-400'
            }`}
          >
            {t === 'pendu' ? '🔤 Pendu' : '📸 Photos'}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Onglet PENDU
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'pendu' && (
        <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

          {/* Points */}
          <div className="flex items-center gap-4 bg-gray-900/80 rounded-2xl px-6 py-4 border border-gray-800">
            <span className="text-gray-500 text-xs uppercase tracking-widest font-bold">Points</span>
            <input
              type="number"
              value={pointsInput}
              onChange={e => setPointsInput(e.target.value)}
              onBlur={() => commitPoints(pointsInput)}
              onKeyDown={e => e.key === 'Enter' && commitPoints(pointsInput)}
              className="bg-transparent text-yellow-400 text-5xl font-black w-32 focus:outline-none text-center tabular-nums"
              style={{ fontFamily: 'monospace' }}
            />
          </div>

          {/* Message d'erreur */}
          {errorMsg && (
            <div className="bg-red-950/80 border border-red-800 rounded-xl px-4 py-3 text-center text-red-300 text-sm font-bold tracking-wide">
              {errorMsg}
            </div>
          )}

          {/* ── Citations ─────────────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs text-gray-600 uppercase tracking-widest">Citations</p>
            {PHRASES.map((phrase, idx) => {
              const assoc = session.associations[String(idx)] ?? 0;
              const done  = completees[idx] ?? false;
              return (
                <div
                  key={idx}
                  className={`rounded-2xl px-4 py-4 space-y-3 border transition-colors ${assoc ? 'bg-green-950/60 border-green-700' : 'bg-gray-900/60 border-gray-800'}`}
                >
                  <div className="text-base leading-loose tracking-widest" style={{ fontFamily: 'monospace' }}>
                    {renderPhrase(phrase, session.lettres_achetees, done)}
                  </div>

                  {/* ── Compléter ─────────────────────────────────────── */}
                  {done ? (
                    <p className="text-green-400 text-xs font-bold" style={{ fontFamily: 'sans-serif' }}>✅ Complétée !</p>
                  ) : openIdx === idx ? (
                    <div className="space-y-2" style={{ fontFamily: 'sans-serif' }}>
                      <div className="flex gap-2">
                        <input
                          autoFocus
                          value={completeInputs[idx]}
                          onChange={e => {
                            const next = [...completeInputs];
                            next[idx] = e.target.value;
                            setCompleteInputs(next);
                          }}
                          onKeyDown={e => e.key === 'Enter' && completePhrase(idx)}
                          placeholder="Écrire la phrase complète…"
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-yellow-500"
                        />
                        <button
                          onClick={() => completePhrase(idx)}
                          className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-bold px-3 py-1.5 rounded-lg text-sm transition-colors active:scale-95"
                        >
                          Valider
                        </button>
                        <button
                          onClick={() => setOpenIdx(null)}
                          className="text-gray-600 hover:text-gray-400 px-2 text-lg transition-colors"
                        >
                          ✕
                        </button>
                      </div>
                      {wrongIdx === idx && (
                        <p className="text-red-400 text-xs font-bold">❌ Pas tout à fait...</p>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setOpenIdx(idx)}
                      className="text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                      style={{ fontFamily: 'sans-serif' }}
                    >
                      ✏️ Compléter
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Photo :</span>
                    <select
                      value={assoc}
                      onChange={e => updateAssociation(idx, Number(e.target.value) || null)}
                      className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1 text-sm text-gray-300 focus:outline-none focus:border-yellow-500 cursor-pointer"
                      style={{ fontFamily: 'sans-serif' }}
                    >
                      <option value={0}>— aucune —</option>
                      {Array.from({ length: 11 }, (_, i) => (
                        <option key={i + 1} value={i + 1}>Photo {i + 1}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Acheter une lettre ────────────────────────────────────────── */}
          <div className="space-y-3">
            <p className="text-xs text-gray-600 uppercase tracking-widest">Acheter une lettre</p>
            <div className="grid grid-cols-7 gap-1.5 sm:grid-cols-9">
              {ALPHABET.map(letter => {
                const bought = session.lettres_achetees.includes(letter);
                const cost = LETTER_VALUES[letter];
                return (
                  <button
                    key={letter}
                    onClick={() => buyLetter(letter)}
                    disabled={bought}
                    title={`${letter} — ${cost} pts`}
                    className={`flex flex-col items-center justify-center rounded-xl py-2.5 px-1 border transition-all duration-150 ${
                      bought
                        ? 'bg-gray-900/30 border-gray-900 text-gray-800 cursor-not-allowed'
                        : 'bg-gray-800/80 border-gray-700 hover:border-yellow-500 hover:bg-gray-700/80 active:scale-95 cursor-pointer'
                    }`}
                  >
                    <span className={`text-sm font-bold leading-none ${bought ? 'text-gray-800' : 'text-white'}`}>
                      {letter}
                    </span>
                    <span className={`text-[9px] mt-0.5 leading-none font-bold ${bought ? 'text-gray-800' : 'text-yellow-500'}`}>
                      {cost}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-gray-700 text-center" style={{ fontFamily: 'sans-serif' }}>
              Lettres achetées : {session.lettres_achetees.length > 0
                ? session.lettres_achetees.sort().join(', ')
                : 'aucune'}
            </p>
          </div>

        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          Onglet PHOTOS
      ══════════════════════════════════════════════════════════════════════ */}
      {tab === 'photos' && (
        <div className="px-4 py-6 max-w-2xl mx-auto">
          {loadingPhotos ? (
            <p className="text-gray-600 text-center text-sm animate-pulse tracking-widest uppercase" style={{ fontFamily: 'sans-serif' }}>
              Chargement des photos…
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {Array.from({ length: 11 }, (_, i) => {
                const photo = photos[i];
                return (
                  <div
                    key={i}
                    className="relative rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 aspect-square"
                  >
                    {photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photo.src}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-gray-800 text-4xl select-none">📸</span>
                      </div>
                    )}
                    {/* Numéro */}
                    <div className="absolute top-2 left-2 bg-black/80 text-yellow-400 font-black text-sm px-2.5 py-0.5 rounded-lg border border-yellow-400/30"
                      style={{ fontFamily: 'monospace' }}>
                      {i + 1}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
