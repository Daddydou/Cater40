'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const LETTER_VALUES: Record<string, number> = {
  A: 4, E: 4, I: 4, O: 4, U: 4, Y: 4,
  R: 3, S: 3, T: 3, L: 3, N: 3,
  B: 1, C: 1, D: 1, F: 1, G: 1, H: 1,
  J: 1, K: 1, M: 1, P: 1, Q: 1, V: 1,
  W: 1, X: 1, Z: 1,
};

const COLORED_LETTERS: Record<string, string> = {
  F: '#ef4444',  // rouge
  N: '#f97316',  // orange
  I: '#67e8f9',  // cyan clair
  S: '#22c55e',  // vert
  B: '#ec4899',  // rose
  L: '#eab308',  // jaune
};

const BOUTON_COLORS: Record<string, string> = {
  C: '#9ca3af',
  A: '#92400e',
  R: '#1e40af',
  O: '#000000',
};

const BOUTON_LETTERS: Record<number, string> = {
  1: 'C',
  2: 'A',
  3: 'R',
  4: 'O',
};

const PHRASES = [
  "Merci Beu pour cette couille du matin",
  "Est troublée par un ressenti",
  "Vous n'aurez pas la médaille cochon",
  "Les taxis parisiens bonjour",
  "D'abord parce que les gens font ce qu'ils veulent",
  "Ta !",
  "Euh c'est normal le Noir dans la piscine ?",
  "Notre couple aura vraiment surpris tout le monde ahahaha",
  "Ok let's go for jaquot",
  "Bah ? Et mon cul ?",
  "Mémé fait le vessel",
  "Alors t'as fait quoi de beau aujourd'hui ?",
  "Des baskets gratos !",
  "Mais on va finir tout nus !",
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

interface GameSession {
  id: string;
  points: number;
  phrases_validees: boolean[];
  lettres_achetees: string[];
  lettres_colorees_revelees: string[];
}

function normalizeLetter(char: string): string {
  return char.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
}

function isAlpha(char: string): boolean {
  return /^[A-Z]$/.test(normalizeLetter(char));
}

function normalizePhrase(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z\s]/g, '').trim();
}

export default function CitationsPerduesPage() {
  const [session, setSession]                 = useState<GameSession | null>(null);
  const [loading, setLoading]                 = useState(true);
  const [pointsInput, setPointsInput]         = useState('0');
  const [errorMsg, setErrorMsg]               = useState('');
  const [selectedPhraseIdx, setSelectedPhraseIdx] = useState<number | null>(null);
  const [phraseInput, setPhraseInput]         = useState('');
  const [bravoPhrase, setBravoPhrase]         = useState<number | null>(null);
  const [jeuTermine, setJeuTermine]           = useState(false);
  const [boutonsActifs, setBoutonsActifs]     = useState<Record<number, boolean>>({});
  const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSession = useCallback(async () => {
    const { data } = await supabase
      .from('citations_game')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      const s = data as GameSession;
      setSession(s);
      setPointsInput(String(s.points));
      if (s.phrases_validees?.length > 0 && s.phrases_validees.every(Boolean)) {
        setJeuTermine(true);
      }
      setLoading(false);
    } else {
      await createSession();
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const createSession = async () => {
    const fresh = {
      points: 0,
      phrases_validees: Array(PHRASES.length).fill(false) as boolean[],
      lettres_achetees: [] as string[],
      lettres_colorees_revelees: [] as string[],
    };
    const { data, error } = await supabase.from('citations_game').insert(fresh).select().single();
    if (error) console.error('createSession error:', error);
    if (data) {
      setSession(data as GameSession);
      setPointsInput('0');
      setJeuTermine(false);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(''), 2800);
  };

  const buyLetter = async (letter: string) => {
    if (!session) return;
    if (session.lettres_achetees.includes(letter)) return;
    const cost = LETTER_VALUES[letter];
    if (session.points < cost) {
      showError(`Pas assez de points — il faut ${cost} pts pour « ${letter} »`);
      return;
    }
    const newLettres = [...session.lettres_achetees, letter];
    const newPoints  = session.points - cost;
    let newColorees  = [...(session.lettres_colorees_revelees || [])];
    if (COLORED_LETTERS[letter] && !newColorees.includes(letter)) {
      newColorees = [...newColorees, letter];
    }
    const updated = { points: newPoints, lettres_achetees: newLettres, lettres_colorees_revelees: newColorees };
    setSession(prev => prev ? { ...prev, ...updated } : prev);
    setPointsInput(String(newPoints));
    await supabase.from('citations_game').update(updated).eq('id', session.id);
  };

  const validatePhrase = async (phraseIdx: number) => {
    if (!session) return;
    const correct = normalizePhrase(PHRASES[phraseIdx]);
    const attempt = normalizePhrase(phraseInput);
    if (attempt !== correct) {
      showError("Ce n'est pas ça… réessaie !");
      return;
    }
    const newValidees = [...(session.phrases_validees || Array(PHRASES.length).fill(false))];
    newValidees[phraseIdx] = true;
    const toutesValidees = newValidees.every(Boolean);
    const updated = { phrases_validees: newValidees };
    setSession(prev => prev ? { ...prev, ...updated } : prev);
    setBravoPhrase(phraseIdx);
    setPhraseInput('');
    setSelectedPhraseIdx(null);
    setTimeout(() => setBravoPhrase(null), 2500);
    await supabase.from('citations_game').update(updated).eq('id', session.id);
    if (toutesValidees) {
      setTimeout(() => setJeuTermine(true), 1500);
    }
  };

  const commitPoints = async (raw: string) => {
    if (!session) return;
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    setSession(prev => prev ? { ...prev, points: val } : prev);
    await supabase.from('citations_game').update({ points: val }).eq('id', session.id);
  };

  const resetGame = async () => {
    if (!session) return;
    const fresh = {
      points: 0,
      phrases_validees: Array(PHRASES.length).fill(false),
      lettres_achetees: [],
      lettres_colorees_revelees: [],
    };
    setSession(prev => prev ? { ...prev, ...fresh } : prev);
    setPointsInput('0');
    setJeuTermine(false);
    setBoutonsActifs({});
    await supabase.from('citations_game').update(fresh).eq('id', session.id);
  };

  const getBoutonColor = (letter: string): string | null => {
    const BOUTON_MAP: Record<string, { n: number, color: string }> = {
      C: { n: 1, color: '#9ca3af' },
      A: { n: 2, color: '#92400e' },
      R: { n: 3, color: '#1e40af' },
      O: { n: 4, color: '#000000' },
    };
    const entry = BOUTON_MAP[letter];
    if (!entry) return null;
    return boutonsActifs[entry.n] ? entry.color : null;
  };

  const renderPhrase = (phrase: string, phraseIdx: number) => {
    const achetees = session?.lettres_achetees || [];
    const validee = session?.phrases_validees?.[phraseIdx] ?? false;

    return phrase.split('').map((char, i) => {
      if (char === ' ') return <span key={i} className="inline-block w-3" />;
      if (!isAlpha(char)) return <span key={i} className="text-gray-400 mx-px">{char}</span>;
      const norm = normalizeLetter(char);
      const specialColor = COLORED_LETTERS[norm];
      const boutonColor = getBoutonColor(norm);

      const isRevealed = validee || achetees.includes(norm) || jeuTermine;

      if (!isRevealed) {
        return <span key={i} className="text-gray-300 mx-px select-none">_</span>;
      }

      if (boutonColor) {
        return <span key={i} className="mx-px font-black" style={{ color: boutonColor }}>{char.toUpperCase()}</span>;
      }
      if (specialColor && (achetees.includes(norm) || jeuTermine)) {
        return <span key={i} className="mx-px font-black" style={{ color: specialColor, textShadow: `0 0 8px ${specialColor}88` }}>{char.toUpperCase()}</span>;
      }
      return <span key={i} className="mx-px font-black" style={{ color: '#7c3aed' }}>{char.toUpperCase()}</span>;
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500 animate-pulse tracking-widest text-sm uppercase">Chargement…</p>
      </div>
    );
  }

  if (!session) return null;

  const validees  = session.phrases_validees || Array(PHRASES.length).fill(false);
  const nbValidees = validees.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900" style={{ fontFamily: 'Georgia, serif' }}>

      {/* Header sticky */}
      <div className="border-b border-gray-200 px-4 py-3 flex items-center justify-between bg-gray-100 sticky top-0 z-10">
        <h1 className="text-base font-bold text-yellow-600 tracking-widest uppercase">🎭 Citations Perdues</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500" style={{ fontFamily: 'sans-serif' }}>{nbValidees}/{PHRASES.length}</span>
          <button
            onClick={resetGame}
            className="bg-red-50 border border-red-200 hover:bg-red-100 text-red-500 font-bold text-xs px-4 py-2 rounded-xl transition-colors active:scale-95"
          >
            🔄 Reset
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">

        {/* Points */}
        <div className="flex items-center gap-4 bg-gray-200 rounded-2xl px-6 py-4 border border-gray-400">
          <span className="text-gray-500 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'sans-serif' }}>Points</span>
          <input
            type="number"
            value={pointsInput}
            onChange={e => setPointsInput(e.target.value)}
            onBlur={() => commitPoints(pointsInput)}
            onKeyDown={e => e.key === 'Enter' && commitPoints(pointsInput)}
            className="bg-transparent text-yellow-600 text-5xl font-black w-36 focus:outline-none text-center tabular-nums"
            style={{ fontFamily: 'monospace' }}
          />
        </div>

        {/* Erreur */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-center text-red-500 text-sm font-bold tracking-wide">
            {errorMsg}
          </div>
        )}

        {/* Citations */}
        <div className="space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>
            Citations ({nbValidees}/{PHRASES.length} trouvées)
          </p>
          {PHRASES.map((phrase, idx) => {
            const validee    = validees[idx];
            const isBravo    = bravoPhrase === idx;
            const isSelected = selectedPhraseIdx === idx;
            return (
              <div
                key={idx}
                className={`rounded-2xl px-4 py-4 space-y-3 border transition-all duration-300 ${
                  isBravo    ? 'bg-green-50 border-green-400 scale-[1.01]' :
                  validee    ? 'bg-green-50 border-green-200' :
                  isSelected ? 'bg-yellow-50 border-yellow-400' :
                               'bg-gray-50 border-gray-500'
                }`}
              >
                <div
                  className="text-base leading-loose tracking-widest cursor-pointer"
                  style={{ fontFamily: 'monospace' }}
                  onClick={() => {
                    if (!validee) {
                      setSelectedPhraseIdx(isSelected ? null : idx);
                      setPhraseInput('');
                    }
                  }}
                >
                  {renderPhrase(phrase, idx)}
                </div>
                {isBravo && (
                  <div className="text-center text-green-600 font-black text-lg animate-bounce tracking-widest">
                    ✨ Bravo Cater ! ✨
                  </div>
                )}
                {isSelected && !validee && (
                  <div className="space-y-2 pt-1">
                    <input
                      type="text"
                      value={phraseInput}
                      onChange={e => setPhraseInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && validatePhrase(idx)}
                      placeholder="Tape la citation complète…"
                      className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-yellow-500 placeholder-gray-400"
                      style={{ fontFamily: 'sans-serif' }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => validatePhrase(idx)}
                        className="flex-1 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-sm tracking-wide transition-colors active:scale-95"
                      >
                        ✓ Valider
                      </button>
                      <button
                        onClick={() => { setSelectedPhraseIdx(null); setPhraseInput(''); }}
                        className="px-4 py-2 rounded-xl border border-gray-300 text-gray-500 hover:text-gray-700 text-sm transition-colors"
                      >
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Boutons mystérieux — uniquement quand jeuTermine */}
        {jeuTermine && (
          <div className="flex gap-3 justify-center mt-6">
            {[1, 2, 3, 4].map(n => (
              <button
                key={n}
                onClick={() => setBoutonsActifs(prev => ({ ...prev, [n]: true }))}
                className={`w-14 h-14 rounded-2xl font-black text-xl border-2 transition-all active:scale-95 ${
                  boutonsActifs[n]
                    ? 'bg-gray-200 border-gray-300 text-gray-400'
                    : 'bg-gray-900 border-gray-700 text-white hover:border-yellow-400'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
        )}

        {/* Alphabet — acheter une lettre */}
        <div className="bg-gray-50 border border-gray-600 rounded-2xl px-5 py-4 space-y-3">
          <p className="text-xs text-gray-500 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>Acheter une lettre</p>
          <div className="grid grid-cols-9 gap-1">
            {ALPHABET.map(letter => {
              const bought = (session.lettres_achetees || []).includes(letter);
              const cost   = LETTER_VALUES[letter];
              return (
                <button
                  key={letter}
                  onClick={() => buyLetter(letter)}
                  disabled={bought}
                  title={`${letter} — ${cost} pts`}
                  className={`flex flex-col items-center justify-center rounded-lg py-1.5 border transition-all text-[11px] ${
                    bought
                      ? 'bg-gray-50 border-gray-100 cursor-not-allowed'
                      : 'bg-gray-100 border-gray-300 hover:border-yellow-500 active:scale-95 cursor-pointer'
                  }`}
                >
                  <span className="font-black leading-none" style={{ color: bought ? '#d1d5db' : '#111827' }}>{letter}</span>
                  <span className={`text-xs mt-0.5 ${bought ? 'text-gray-300' : 'text-yellow-600'}`}>{cost}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lettres spéciales découvertes */}
        {(() => {
          const BOUTON_LETTERS: Record<number, { letter: string, color: string }> = {
            1: { letter: 'C', color: '#9ca3af' },
            2: { letter: 'A', color: '#92400e' },
            3: { letter: 'R', color: '#1e40af' },
            4: { letter: 'O', color: '#000000' },
          }
          const boutonsEntries = ([1, 2, 3, 4] as number[])
            .filter(n => boutonsActifs[n])
            .map(n => BOUTON_LETTERS[n])

          const coloredLetters = (session.lettres_colorees_revelees || []).map(l => ({ letter: l, color: COLORED_LETTERS[l] }))
          const allLetters = [...coloredLetters, ...boutonsEntries]

          return allLetters.length > 0 ? (
            <div className="bg-gray-200 border border-gray-500 rounded-2xl px-5 py-4 space-y-2">
              <p className="text-xs text-gray-500 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>
                Lettres spéciales découvertes
              </p>
              <div className="flex gap-3 flex-wrap">
                {allLetters.map((l, i) => (
                  <span key={i} className="text-3xl font-black" style={{ color: l.color, textShadow: `0 0 8px ${l.color}66` }}>
                    {l.letter}
                  </span>
                ))}
              </div>
            </div>
          ) : null
        })()}

      </div>
    </div>
  );
}
