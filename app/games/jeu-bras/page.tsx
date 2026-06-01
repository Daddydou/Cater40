'use client';

import { useState, useEffect } from 'react';
import { RESULT_LEVELS, getResultLevel } from '@/lib/jeu-bras-data';
import { listBucketPhotos, StoragePhoto } from '@/lib/storage-utils';

export default function JeuBrasPage() {
  const [photos, setPhotos] = useState<StoragePhoto[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(true);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<('bon' | 'caca')[]>([]);
  const [finished, setFinished] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    listBucketPhotos('jeu-bras').then(items => {
      setPhotos(items);
      setLoadingPhotos(false);
    });
  }, []);

  const answer = (choice: 'bon' | 'caca') => {
    if (animating) return;
    setAnimating(true);
    const newAnswers = [...answers, choice];
    setAnswers(newAnswers);
    const newIndex = index + 1;
    setIndex(newIndex);
    if (newIndex >= photos.length) setFinished(true);
    setTimeout(() => setAnimating(false), 150);
  };

  const restart = () => { setIndex(0); setAnswers([]); setFinished(false); };

  if (loadingPhotos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <p className="text-white animate-pulse text-xl">Chargement des photos…</p>
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
        <div className="text-center space-y-3">
          <div className="text-5xl">🦾</div>
          <h1 className="text-2xl font-bold text-yellow-400">Gros Bras</h1>
          <p className="text-gray-400">Aucune photo disponible pour l&apos;instant.<br />Demande aux joueurs d&apos;uploader leurs photos via <span className="text-yellow-400">/upload-photos</span>.</p>
        </div>
      </div>
    );
  }

  // — Écran de résultat —
  if (finished || index >= photos.length) {
    const bonCount = answers.filter(a => a === 'bon').length;
    const total = photos.length;
    const pct = Math.round((bonCount / total) * 100);
    const level = getResultLevel(pct);

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 py-8 text-white">
        <div className="w-full max-w-sm text-center space-y-6">
          <h1 className="text-3xl font-extrabold text-yellow-400">Résultats</h1>

          <div className="w-full aspect-square rounded-3xl overflow-hidden bg-gray-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={level.image} alt={level.titre} className="w-full h-full object-cover" />
          </div>

          <div>
            <p className="text-7xl font-black">{pct}%</p>
            <p className="text-2xl font-bold text-yellow-400 mt-2">{level.titre}</p>
            <p className="text-gray-400 mt-1">{level.texte}</p>
            <p className="text-gray-600 text-sm mt-3">
              {bonCount} ✅ bon{bonCount > 1 ? 's' : ''} · {total - bonCount} 💩 caca
            </p>
          </div>

          <button
            onClick={restart}
            className="w-full py-4 bg-yellow-400 hover:bg-yellow-300 text-gray-900 font-black text-lg rounded-2xl transition-colors"
          >
            🔄 Rejouer
          </button>
        </div>
      </div>
    );
  }

  // — Écran de jeu —
  const currentPhoto = photos[index];
  const progressPct = (index / photos.length) * 100;

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 px-4 py-6 text-white">
      <div className="w-full max-w-sm mx-auto flex flex-col gap-4 flex-1">

        <div className="flex justify-between items-center">
          <h1 className="text-lg font-bold text-yellow-400">🦾 Gros Bras</h1>
          <p className="text-gray-400 text-sm">{index + 1} / {photos.length}</p>
        </div>

        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-yellow-400 rounded-full transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        <div className="flex-1 rounded-3xl overflow-hidden bg-gray-800 min-h-[320px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={currentPhoto.id}
            src={currentPhoto.src}
            alt={`Photo ${index + 1}`}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="grid grid-cols-2 gap-4 pb-2">
          <button
            onClick={() => answer('caca')}
            disabled={animating}
            className="py-6 rounded-2xl bg-gray-800 hover:bg-red-900/50 border-2 border-transparent hover:border-red-700 flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
          >
            <span className="text-4xl">💩</span>
            <span className="text-base font-bold text-gray-300">Caca</span>
          </button>
          <button
            onClick={() => answer('bon')}
            disabled={animating}
            className="py-6 rounded-2xl bg-gray-800 hover:bg-green-900/50 border-2 border-transparent hover:border-green-600 flex flex-col items-center gap-1 transition-all active:scale-95 disabled:opacity-50"
          >
            <span className="text-4xl">✅</span>
            <span className="text-base font-bold text-gray-300">Bon</span>
          </button>
        </div>

      </div>
    </div>
  );
}
