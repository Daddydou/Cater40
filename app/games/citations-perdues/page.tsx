'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

const LETTER_VALUES: Record<string, number> = {
  A: 10, E: 10, I: 10, O: 10, U: 10,
  N: 10, R: 10, S: 10, T: 10, L: 10,
  D: 5,  G: 5,  M: 5,
  B: 4,  C: 4,  P: 4,
  F: 3,  H: 3,  V: 3,
  J: 2,  Q: 2,
  K: 1,  W: 1,  X: 1,  Y: 1,  Z: 1,
};

const COLORED_LETTERS: Record<string, string> = {
  F: '#ef4444',
  N: '#f97316',
  I: '#3b82f6',
  S: '#22c55e',
  B: '#ec4899',
  L: '#eab308',
};

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
  "L'union fait la force",
  "Chaque jour suffit sa peine",
  "Bien mal acquis ne profite jamais",
];

const HINT_BATCHES = [
  ['C', 'C'],
  ['A', 'A'],
  ['R', 'R'],
  ['O', 'O'],
];

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const TARGET_PHASE2 = 'FRANCOIS CABROL';

interface GameSession {
  id: string;
  points: number;
  phrases_validees: boolean[];
  lettres_par_phrase: Record<number, string[]>;
  lettres_colorees_revelees: string[];
  phase2_debloquee: boolean;
  hint_index: number;
}

interface DraggableLetter {
  id: string;
  letter: string;
  color: string | null;
  x: number;
  y: number;
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

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function buildPhase2Letters(coloredRevealed: string[], hintIndex: number): DraggableLetter[] {
  const letters: DraggableLetter[] = [];
  Object.entries(COLORED_LETTERS).forEach(([letter, color]) => {
    if (coloredRevealed.includes(letter)) {
      letters.push({ id: makeId(), letter, color, x: 20 + Math.random() * 150, y: 20 + Math.random() * 80 });
    }
  });
  for (let i = 0; i < hintIndex; i++) {
    HINT_BATCHES[i].forEach(letter => {
      letters.push({ id: makeId(), letter, color: null, x: 20 + Math.random() * 150, y: 20 + Math.random() * 80 });
    });
  }
  return letters;
}

export default function CitationsPerduesPage() {
  const [session, setSession] = useState<GameSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [pointsInput, setPointsInput] = useState('0');
  const [errorMsg, setErrorMsg] = useState('');
  const [phase, setPhase] = useState<1 | 2>(1);
  const [selectedPhraseIdx, setSelectedPhraseIdx] = useState<number | null>(null);
  const [phraseInput, setPhraseInput] = useState('');
  const [bravoPhrase, setBravoPhrase] = useState<number | null>(null);
  const [dragLetters, setDragLetters] = useState<DraggableLetter[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [phase2Answer, setPhase2Answer] = useState('');
  const [showFete, setShowFete] = useState(false);
  const [phase2Error, setPhase2Error] = useState('');
  const zoneRef = useRef<HTMLDivElement>(null);
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
      if (s.phase2_debloquee) {
        setPhase(2);
        setDragLetters(buildPhase2Letters(s.lettres_colorees_revelees || [], s.hint_index || 0));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSession(); }, [fetchSession]);

  const createSession = async () => {
    const fresh = {
      points: 0,
      phrases_validees: Array(PHRASES.length).fill(false),
      lettres_par_phrase: {},
      lettres_colorees_revelees: [],
      phase2_debloquee: false,
      hint_index: 0,
    };
    const { data } = await supabase.from('citations_game').insert(fresh).select().single();
    if (data) {
      setSession(data as GameSession);
      setPointsInput('0');
      setPhase(1);
    }
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    if (errorTimer.current) clearTimeout(errorTimer.current);
    errorTimer.current = setTimeout(() => setErrorMsg(''), 2800);
  };

  const buyLetter = async (letter: string, phraseIdx: number) => {
    if (!session) return;
    const already = (session.lettres_par_phrase[phraseIdx] || []).includes(letter);
    if (already) return;
    const cost = LETTER_VALUES[letter];
    if (session.points < cost) {
      showError(`Pas assez de points — il faut ${cost} pts pour « ${letter} »`);
      return;
    }
    const newLettresParPhrase: Record<number, string[]> = {
      ...session.lettres_par_phrase,
      [phraseIdx]: [...(session.lettres_par_phrase[phraseIdx] || []), letter],
    };
    const newPoints = session.points - cost;
    let newColorees = [...(session.lettres_colorees_revelees || [])];
    if (COLORED_LETTERS[letter] && !newColorees.includes(letter)) {
      newColorees = [...newColorees, letter];
    }
    const updated = { points: newPoints, lettres_par_phrase: newLettresParPhrase, lettres_colorees_revelees: newColorees };
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
    const phraseLetters = PHRASES[phraseIdx].split('').map(c => normalizeLetter(c)).filter(c => isAlpha(c));
    let newColorees = [...(session.lettres_colorees_revelees || [])];
    phraseLetters.forEach(l => {
      if (COLORED_LETTERS[l] && !newColorees.includes(l)) newColorees = [...newColorees, l];
    });
    const newValidees = [...(session.phrases_validees || Array(PHRASES.length).fill(false))];
    newValidees[phraseIdx] = true;
    const toutesValidees = newValidees.every(Boolean);
    const updated = { phrases_validees: newValidees, lettres_colorees_revelees: newColorees, phase2_debloquee: toutesValidees };
    setSession(prev => prev ? { ...prev, ...updated } : prev);
    setBravoPhrase(phraseIdx);
    setPhraseInput('');
    setSelectedPhraseIdx(null);
    setTimeout(() => setBravoPhrase(null), 2500);
    await supabase.from('citations_game').update(updated).eq('id', session.id);
    if (toutesValidees) {
      setTimeout(() => {
        setPhase(2);
        setDragLetters(buildPhase2Letters(newColorees, session.hint_index || 0));
      }, 1500);
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
      lettres_par_phrase: {},
      lettres_colorees_revelees: [],
      phase2_debloquee: false,
      hint_index: 0,
    };
    setSession(prev => prev ? { ...prev, ...fresh } : prev);
    setPointsInput('0');
    setPhase(1);
    setDragLetters([]);
    setShowFete(false);
    await supabase.from('citations_game').update(fresh).eq('id', session.id);
  };

  const renderPhrase = (phrase: string, phraseIdx: number) => {
    const achetees = session?.lettres_par_phrase?.[phraseIdx] || [];
    const validee = session?.phrases_validees?.[phraseIdx] ?? false;
    return phrase.split('').map((char, i) => {
      if (char === ' ') return <span key={i} className="inline-block w-3" />;
      if (!isAlpha(char)) return <span key={i} className="text-gray-400 mx-px">{char}</span>;
      const norm = normalizeLetter(char);
      const color = COLORED_LETTERS[norm];
      if (validee || achetees.includes(norm)) {
        if (color) {
          return <span key={i} className="mx-px font-black" style={{ color, textShadow: `0 0 8px ${color}88` }}>{char.toUpperCase()}</span>;
        }
        return <span key={i} className="text-yellow-200 font-bold mx-px">{char.toUpperCase()}</span>;
      }
      return <span key={i} className="text-gray-700 mx-px select-none">_</span>;
    });
  };

  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    const letter = dragLetters.find(l => l.id === id);
    if (!letter) return;
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!zone) return;
    setDragging(id);
    setDragOffset({ x: e.clientX - zone.left - letter.x, y: e.clientY - zone.top - letter.y });
  };

  const handleTouchStart = (e: React.TouchEvent, id: string) => {
    const touch = e.touches[0];
    const letter = dragLetters.find(l => l.id === id);
    if (!letter) return;
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!zone) return;
    setDragging(id);
    setDragOffset({ x: touch.clientX - zone.left - letter.x, y: touch.clientY - zone.top - letter.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!zone) return;
    setDragLetters(prev => prev.map(l => l.id === dragging ? { ...l, x: e.clientX - zone.left - dragOffset.x, y: e.clientY - zone.top - dragOffset.y } : l));
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    const zone = zoneRef.current?.getBoundingClientRect();
    if (!zone) return;
    setDragLetters(prev => prev.map(l => l.id === dragging ? { ...l, x: touch.clientX - zone.left - dragOffset.x, y: touch.clientY - zone.top - dragOffset.y } : l));
  };

  const handleDragEnd = () => setDragging(null);

  const revealHint = async () => {
    if (!session) return;
    const nextIdx = (session.hint_index || 0) + 1;
    if (nextIdx > HINT_BATCHES.length) return;
    const batch = HINT_BATCHES[nextIdx - 1];
    const newLetters = batch.map(letter => ({ id: makeId(), letter, color: null, x: 20 + Math.random() * 200, y: 20 + Math.random() * 80 }));
    setDragLetters(prev => [...prev, ...newLetters]);
    setSession(prev => prev ? { ...prev, hint_index: nextIdx } : prev);
    await supabase.from('citations_game').update({ hint_index: nextIdx }).eq('id', session.id);
  };

  const validatePhase2 = () => {
    const norm = phase2Answer.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
    if (norm === TARGET_PHASE2) {
      setShowFete(true);
    } else {
      setPhase2Error('Pas tout à fait… cherche encore !');
      setTimeout(() => setPhase2Error(''), 2500);
    }
  };

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
          <button onClick={createSession} className="bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black px-10 py-4 rounded-2xl text-lg transition-colors">
            Nouvelle partie
          </button>
        </div>
      </div>
    );
  }

  if (showFete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 text-center relative overflow-hidden">
        <style>{`
          @keyframes fall {
            0% { transform: translateY(-100px) rotate(0deg); opacity: 1; }
            100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
          }
          .confetti { position: fixed; width: 10px; height: 10px; top: -20px; animation: fall linear infinite; }
        `}</style>
        {Array.from({ length: 30 }, (_, i) => (
          <div key={i} className="confetti" style={{
            left: `${Math.random() * 100}%`,
            animationDuration: `${2 + Math.random() * 3}s`,
            animationDelay: `${Math.random() * 2}s`,
            backgroundColor: ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#ec4899','#a855f7'][i % 7],
            borderRadius: Math.random() > 0.5 ? '50%' : '0',
          }} />
        ))}
        <div className="z-10 space-y-6">
          <div className="text-7xl animate-bounce">🎉</div>
          <h1 className="text-4xl font-black tracking-widest" style={{
            fontFamily: 'Georgia, serif',
            background: 'linear-gradient(135deg, #f97316, #eab308, #ec4899, #3b82f6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Joyeux Anniversaire
          </h1>
          <div className="text-5xl font-black text-yellow-400 tracking-widest" style={{ fontFamily: 'Georgia, serif' }}>
            Cater ! 🥳
          </div>
        </div>
      </div>
    );
  }

  if (phase === 2) {
    const hintIdx = session.hint_index || 0;
    const allHintsRevealed = hintIdx >= HINT_BATCHES.length;
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: 'Georgia, serif' }}>
        <div className="border-b border-gray-800 px-4 py-3 flex items-center justify-between bg-gray-950/95 sticky top-0 z-10">
          <h1 className="text-base font-bold text-yellow-400 tracking-widest uppercase">🌟 Phase 2 — Le secret</h1>
          <button onClick={resetGame} className="text-xs text-gray-700 hover:text-red-500 transition-colors">Réinitialiser</button>
        </div>
        <div className="flex-1 flex flex-col px-4 py-6 gap-6 max-w-2xl mx-auto w-full">
          <p className="text-center text-gray-400 text-sm tracking-wide">Utilise les lettres pour trouver le secret caché…</p>
          <div className="space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>Lettres à disposition</p>
            <div
              ref={zoneRef}
              className="relative bg-gray-900/60 border border-gray-700 rounded-2xl overflow-hidden select-none"
              style={{ height: '300px', touchAction: 'none' }}
              onMouseMove={handleMouseMove}
              onMouseUp={handleDragEnd}
              onMouseLeave={handleDragEnd}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleDragEnd}
            >
              {dragLetters.map(dl => (
                <div
                  key={dl.id}
                  className="absolute cursor-grab active:cursor-grabbing font-black text-4xl select-none"
                  style={{
                    left: dl.x, top: dl.y,
                    color: dl.color || '#d1d5db',
                    textShadow: dl.color ? `0 0 12px ${dl.color}99` : 'none',
                    zIndex: dragging === dl.id ? 50 : 10,
                    transform: dragging === dl.id ? 'scale(1.25)' : 'scale(1)',
                    transition: dragging === dl.id ? 'none' : 'transform 0.1s',
                    userSelect: 'none',
                  }}
                  onMouseDown={e => handleMouseDown(e, dl.id)}
                  onTouchStart={e => handleTouchStart(e, dl.id)}
                >
                  {dl.letter}
                </div>
              ))}
              {dragLetters.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-gray-800 text-sm italic">Les lettres apparaîtront ici</p>
                </div>
              )}
            </div>
          </div>
          {!allHintsRevealed && (
            <button onClick={revealHint} className="w-full py-3 rounded-2xl border border-purple-700 bg-purple-950/60 text-purple-300 font-bold tracking-widest text-sm hover:bg-purple-900/60 transition-colors active:scale-95">
              ✨ Un petit indice…
            </button>
          )}
          <div className="space-y-3 mt-2">
            <p className="text-xs text-gray-600 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>Ta réponse</p>
            <input
              type="text"
              value={phase2Answer}
              onChange={e => setPhase2Answer(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && validatePhase2()}
              placeholder="Tape ta réponse ici…"
              className="w-full bg-gray-900 border border-gray-700 rounded-2xl px-5 py-4 text-white text-xl font-bold tracking-widest focus:outline-none focus:border-yellow-500 placeholder-gray-700"
              style={{ fontFamily: 'monospace' }}
              autoComplete="off"
              autoCapitalize="characters"
            />
            {phase2Error && (
              <div className="bg-red-950/80 border border-red-800 rounded-xl px-4 py-3 text-center text-red-300 text-sm font-bold">{phase2Error}</div>
            )}
            <button onClick={validatePhase2} className="w-full py-4 rounded-2xl bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-lg tracking-widest transition-colors active:scale-95">
              🎯 C'est ça !
            </button>
          </div>
        </div>
      </div>
    );
  }

  const validees = session.phrases_validees || Array(PHRASES.length).fill(false);
  const nbValidees = validees.filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white" style={{ fontFamily: 'Georgia, serif' }}>
      <div className="border-b border-gray-800/80 px-4 py-3 flex items-center justify-between bg-gray-950/95 sticky top-0 z-10">
        <h1 className="text-base font-bold text-yellow-400 tracking-widest uppercase">🎭 Citations Perdues</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-600" style={{ fontFamily: 'sans-serif' }}>{nbValidees}/{PHRASES.length}</span>
          <button onClick={resetGame} className="text-xs text-gray-700 hover:text-red-500 transition-colors tracking-wide">Réinitialiser</button>
        </div>
      </div>
      <div className="px-4 py-6 max-w-2xl mx-auto space-y-8">
        <div className="flex items-center gap-4 bg-gray-900/80 rounded-2xl px-6 py-4 border border-gray-800">
          <span className="text-gray-500 text-xs uppercase tracking-widest font-bold" style={{ fontFamily: 'sans-serif' }}>Points</span>
          <input
            type="number"
            value={pointsInput}
            onChange={e => setPointsInput(e.target.value)}
            onBlur={() => commitPoints(pointsInput)}
            onKeyDown={e => e.key === 'Enter' && commitPoints(pointsInput)}
            className="bg-transparent text-yellow-400 text-5xl font-black w-36 focus:outline-none text-center tabular-nums"
            style={{ fontFamily: 'monospace' }}
          />
        </div>
        {errorMsg && (
          <div className="bg-red-950/80 border border-red-800 rounded-xl px-4 py-3 text-center text-red-300 text-sm font-bold tracking-wide">{errorMsg}</div>
        )}
        <div className="space-y-3">
          <p className="text-xs text-gray-600 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>Citations ({nbValidees}/{PHRASES.length} trouvées)</p>
          {PHRASES.map((phrase, idx) => {
            const validee = validees[idx];
            const isBravo = bravoPhrase === idx;
            const isSelected = selectedPhraseIdx === idx;
            const achetees = session.lettres_par_phrase?.[idx] || [];
            return (
              <div key={idx} className={`rounded-2xl px-4 py-4 space-y-3 border transition-all duration-300 ${isBravo ? 'bg-green-900/60 border-green-500 scale-[1.01]' : validee ? 'bg-green-950/40 border-green-800' : isSelected ? 'bg-gray-800/80 border-yellow-600' : 'bg-gray-900/60 border-gray-800'}`}>
                <div
                  className="text-base leading-loose tracking-widest cursor-pointer"
                  style={{ fontFamily: 'monospace' }}
                  onClick={() => { if (!validee) { setSelectedPhraseIdx(isSelected ? null : idx); setPhraseInput(''); } }}
                >
                  {renderPhrase(phrase, idx)}
                </div>
                {isBravo && (
                  <div className="text-center text-green-400 font-black text-lg animate-bounce tracking-widest">✨ Bravo Cater ! ✨</div>
                )}
                {!validee && (
                  <div className="text-xs text-gray-700 tracking-wide" style={{ fontFamily: 'sans-serif' }}>
                    Lettres révélées : {achetees.length > 0 ? achetees.sort().join(', ') : 'aucune'}
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
                      className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-yellow-500 placeholder-gray-700"
                      style={{ fontFamily: 'sans-serif' }}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => validatePhrase(idx)} className="flex-1 py-2 rounded-xl bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-sm tracking-wide transition-colors active:scale-95">✓ Valider</button>
                      <button onClick={() => { setSelectedPhraseIdx(null); setPhraseInput(''); }} className="px-4 py-2 rounded-xl border border-gray-700 text-gray-500 hover:text-gray-300 text-sm transition-colors">Annuler</button>
                    </div>
                  </div>
                )}
                {!validee && (
                  <details className="group">
                    <summary className="text-xs text-gray-600 hover:text-gray-400 cursor-pointer select-none tracking-widest" style={{ fontFamily: 'sans-serif' }}>
                      🔤 Acheter une lettre pour cette citation
                    </summary>
                    <div className="grid grid-cols-9 gap-1 mt-2">
                      {ALPHABET.map(letter => {
                        const bought = achetees.includes(letter);
                        const cost = LETTER_VALUES[letter];
                        const color = COLORED_LETTERS[letter];
                        return (
                          <button
                            key={letter}
                            onClick={() => buyLetter(letter, idx)}
                            disabled={bought}
                            title={`${letter} — ${cost} pts`}
                            className={`flex flex-col items-center justify-center rounded-lg py-1.5 border transition-all text-[11px] ${bought ? 'bg-gray-900/20 border-gray-900 cursor-not-allowed' : 'bg-gray-800/80 border-gray-700 hover:border-yellow-500 active:scale-95 cursor-pointer'}`}
                          >
                            <span className="font-black leading-none" style={{ color: bought ? '#374151' : color || 'white', textShadow: bought || !color ? 'none' : `0 0 6px ${color}88` }}>{letter}</span>
                            <span className={`text-[8px] mt-0.5 ${bought ? 'text-gray-800' : 'text-yellow-600'}`}>{cost}</span>
                          </button>
                        );
                      })}
                    </div>
                  </details>
                )}
              </div>
            );
          })}
        </div>
        {(session.lettres_colorees_revelees?.length || 0) > 0 && (
          <div className="bg-gray-900/40 border border-gray-800 rounded-2xl px-5 py-4 space-y-2">
            <p className="text-xs text-gray-600 uppercase tracking-widest" style={{ fontFamily: 'sans-serif' }}>Lettres spéciales découvertes</p>
            <div className="flex gap-3 flex-wrap">
              {session.lettres_colorees_revelees.map(letter => (
                <span key={letter} className="text-3xl font-black" style={{ color: COLORED_LETTERS[letter], textShadow: `0 0 10px ${COLORED_LETTERS[letter]}99` }}>{letter}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
