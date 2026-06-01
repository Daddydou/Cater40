'use client';

import { useState, useRef, FormEvent, ChangeEvent } from 'react';
import { supabase } from '@/lib/supabase';

function normalizePrenom(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function getExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? 'jpg';
}

export default function UploadPhotosPage() {
  const [prenom, setPrenom] = useState('');
  const [photoBras, setPhotoBras] = useState<File | null>(null);
  const [photoGens, setPhotoGens] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const refBras = useRef<HTMLInputElement>(null);
  const refGens = useRef<HTMLInputElement>(null);

  const canSubmit = prenom.trim().length > 0 && (photoBras !== null || photoGens !== null);

  const resetForm = () => {
    setPrenom('');
    setPhotoBras(null);
    setPhotoGens(null);
    if (refBras.current) refBras.current.value = '';
    if (refGens.current) refGens.current.value = '';
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit || loading) return;
    setLoading(true);
    setSuccess('');
    setError('');

    const nom = normalizePrenom(prenom);
    const errors: string[] = [];

    if (photoBras) {
      const ext = getExtension(photoBras.name);
      const { error: err } = await supabase.storage
        .from('jeu-bras')
        .upload(`Bras-${nom}.${ext}`, photoBras, { upsert: true, contentType: photoBras.type });
      if (err) errors.push(`Photo bras : ${err.message}`);
    }

    if (photoGens) {
      const ext = getExtension(photoGens.name);
      const { error: err } = await supabase.storage
        .from('jeu-photos-gens')
        .upload(`Gens-${nom}.${ext}`, photoGens, { upsert: true, contentType: photoGens.type });
      if (err) errors.push(`Photo gens : ${err.message}`);
    }

    setLoading(false);

    if (errors.length === 0) {
      setSuccess(`Merci ${nom}, tes photos ont bien été envoyées !`);
      resetForm();
    } else {
      setError(errors.join('\n'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-950 px-4 py-10 text-white">
      <div className="w-full max-w-sm space-y-8">

        <div className="text-center">
          <div className="text-5xl mb-3">📤</div>
          <h1 className="text-2xl font-extrabold text-yellow-400">Upload de photos</h1>
          <p className="text-gray-400 text-sm mt-1">Gros Bras &amp; Photos Gens</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
              Qui es-tu ? <span className="text-yellow-400">*</span>
            </label>
            <input
              type="text"
              value={prenom}
              onChange={e => setPrenom(e.target.value)}
              placeholder="Ex : Daddy"
              required
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-lg focus:outline-none focus:border-yellow-400 transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
              Ta photo de bras
              <span className="text-gray-600 normal-case ml-1">(optionnel)</span>
            </label>
            <div
              className={`w-full bg-gray-800 border-2 rounded-xl px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors ${photoBras ? 'border-blue-500' : 'border-gray-700 hover:border-gray-500'}`}
              onClick={() => refBras.current?.click()}
            >
              <span className="text-2xl">🦾</span>
              <span className={`text-sm flex-1 truncate ${photoBras ? 'text-white' : 'text-gray-500'}`}>
                {photoBras ? photoBras.name : 'Choisir une photo…'}
              </span>
              {photoBras && (
                <button type="button" onClick={e => { e.stopPropagation(); setPhotoBras(null); if (refBras.current) refBras.current.value = ''; }} className="text-gray-500 hover:text-white text-xs">✕</button>
              )}
            </div>
            <input ref={refBras} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoBras(e.target.files?.[0] ?? null)} />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wide mb-1">
              Photo de toi avec Sophie
              <span className="text-gray-600 normal-case ml-1">(optionnel)</span>
            </label>
            <div
              className={`w-full bg-gray-800 border-2 rounded-xl px-4 py-4 flex items-center gap-3 cursor-pointer transition-colors ${photoGens ? 'border-purple-500' : 'border-gray-700 hover:border-gray-500'}`}
              onClick={() => refGens.current?.click()}
            >
              <span className="text-2xl">📸</span>
              <span className={`text-sm flex-1 truncate ${photoGens ? 'text-white' : 'text-gray-500'}`}>
                {photoGens ? photoGens.name : 'Choisir une photo…'}
              </span>
              {photoGens && (
                <button type="button" onClick={e => { e.stopPropagation(); setPhotoGens(null); if (refGens.current) refGens.current.value = ''; }} className="text-gray-500 hover:text-white text-xs">✕</button>
              )}
            </div>
            <input ref={refGens} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e: ChangeEvent<HTMLInputElement>) => setPhotoGens(e.target.files?.[0] ?? null)} />
          </div>

          {!photoBras && !photoGens && prenom.trim() && (
            <p className="text-yellow-600 text-xs text-center">
              Ajoute au moins une photo pour pouvoir envoyer.
            </p>
          )}

          <button
            type="submit"
            disabled={!canSubmit || loading}
            className="w-full py-4 rounded-2xl font-black text-lg transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed bg-yellow-400 hover:bg-yellow-300 text-gray-900"
          >
            {loading ? '⏳ Envoi en cours…' : '📤 Envoyer'}
          </button>
        </form>

        {success && (
          <div className="bg-green-900/50 border border-green-600 rounded-2xl px-5 py-4 text-center">
            <p className="text-green-300 font-bold text-lg">✅ {success}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-2xl px-5 py-4">
            <p className="text-red-300 font-bold text-sm whitespace-pre-line">❌ {error}</p>
            <p className="text-red-400/70 text-xs mt-1">Réessaie ou contacte l&apos;animateur.</p>
          </div>
        )}

      </div>
    </div>
  );
}
