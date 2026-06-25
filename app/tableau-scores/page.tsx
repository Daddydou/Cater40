"use client";

import { useState, useEffect, useMemo, useRef } from "react";

const STORAGE_KEY = "cater40_scores_v1";

type Participant = { id: string; name: string };
type Epreuve = { id: string; name: string };
type Scores = Record<string, Record<string, number>>;
type Data = { participants: Participant[]; epreuves: Epreuve[]; scores: Scores };

const seed = (): Data => ({ participants: [], epreuves: [], scores: {} });
const uid = () => Math.random().toString(36).slice(2, 9);

export default function TableauScoresPage() {
  const [data, setData] = useState<Data>(seed);
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [confirmReset, setConfirmReset] = useState<"all" | "points" | null>(null);
  const firstSave = useRef(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setData(JSON.parse(raw));
    } catch (e) {
      console.error("Chargement échoué", e);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    if (firstSave.current) {
      firstSave.current = false;
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      setSavedAt(new Date());
    } catch (e) {
      console.error("Sauvegarde échouée", e);
    }
  }, [data, loaded]);

  const total = (pid: string) => {
    const row = data.scores[pid] || {};
    return data.epreuves.reduce((s, ep) => s + (Number(row[ep.id]) || 0), 0);
  };

  const classement = useMemo(() => {
    const rows = data.participants.map((p) => ({ ...p, total: total(p.id) }));
    rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
    let rank = 0;
    let prev: number | null = null;
    return rows.map((r, i) => {
      if (prev === null || r.total !== prev) rank = i + 1;
      prev = r.total;
      return { ...r, rank };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const addParticipant = () =>
    setData((d) => ({ ...d, participants: [...d.participants, { id: uid(), name: "" }] }));

  const addEpreuve = () =>
    setData((d) => ({ ...d, epreuves: [...d.epreuves, { id: uid(), name: "" }] }));

  const renameParticipant = (id: string, name: string) =>
    setData((d) => ({
      ...d,
      participants: d.participants.map((p) => (p.id === id ? { ...p, name } : p)),
    }));

  const renameEpreuve = (id: string, name: string) =>
    setData((d) => ({
      ...d,
      epreuves: d.epreuves.map((e) => (e.id === id ? { ...e, name } : e)),
    }));

  const setScore = (pid: string, eid: string, val: string) =>
    setData((d) => {
      const row = { ...(d.scores[pid] || {}) };
      if (val === "") delete row[eid];
      else row[eid] = Number(val);
      return { ...d, scores: { ...d.scores, [pid]: row } };
    });

  const removeParticipant = (id: string) =>
    setData((d) => {
      const scores = { ...d.scores };
      delete scores[id];
      return { ...d, participants: d.participants.filter((p) => p.id !== id), scores };
    });

  const removeEpreuve = (id: string) =>
    setData((d) => {
      const scores: Scores = {};
      for (const pid in d.scores) {
        const row = { ...d.scores[pid] };
        delete row[id];
        scores[pid] = row;
      }
      return { ...d, epreuves: d.epreuves.filter((e) => e.id !== id), scores };
    });

  const doReset = (mode: "all" | "points") => {
    if (mode === "all") setData(seed());
    else setData((d) => ({ ...d, scores: {} }));
    setConfirmReset(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-2xl font-bold text-gray-900">Tableau des scores</h1>
        <p className="mb-6 text-sm text-gray-500">Espace animateur — classement automatique par total de points.</p>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            onClick={addParticipant}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
          >
            + Participant
          </button>
          <button
            onClick={addEpreuve}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
          >
            + Épreuve
          </button>
          <div className="flex-1" />
          <button
            onClick={() => setConfirmReset("points")}
            className="rounded-lg border border-amber-400 px-4 py-2 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
          >
            Remettre les points à 0
          </button>
          <button
            onClick={() => setConfirmReset("all")}
            className="rounded-lg border border-red-400 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50"
          >
            Tout effacer
          </button>
        </div>

        {confirmReset && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 px-4 py-3">
            <span className="text-sm text-amber-800">
              {confirmReset === "all"
                ? "Effacer tous les participants, épreuves et points ? Action irréversible."
                : "Remettre tous les points à 0 ? Les noms et épreuves sont conservés."}
            </span>
            <div className="flex-1" />
            <button
              onClick={() => doReset(confirmReset)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
            >
              Confirmer
            </button>
            <button
              onClick={() => setConfirmReset(null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Annuler
            </button>
          </div>
        )}

        {data.participants.length === 0 ? (
          <p className="text-sm text-gray-500">Commence par ajouter des participants et des épreuves.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="bg-gray-100 text-gray-700">
                  <th className="w-12 border border-gray-200 px-2 py-2 text-center">#</th>
                  <th className="min-w-[120px] border border-gray-200 px-2 py-2 text-left">Participant</th>
                  {data.epreuves.map((ep) => (
                    <th key={ep.id} className="min-w-[120px] border border-gray-200 px-2 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          value={ep.name}
                          onChange={(e) => renameEpreuve(ep.id, e.target.value)}
                          placeholder="Épreuve"
                          className="w-full min-w-0 rounded border border-gray-300 px-2 py-1 text-sm font-normal"
                        />
                        <button
                          onClick={() => removeEpreuve(ep.id)}
                          aria-label="Supprimer l'épreuve"
                          className="rounded px-1.5 py-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                        >
                          ✕
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-20 border border-gray-200 bg-blue-50 px-2 py-2 text-center font-semibold text-blue-700">
                    Total
                  </th>
                  <th className="w-10 border border-gray-200 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {classement.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td
                      className={`border border-gray-200 px-2 py-2 text-center font-semibold ${
                        p.rank === 1 ? "text-amber-500" : "text-gray-400"
                      }`}
                    >
                      {p.rank === 1 ? "👑" : p.rank}
                    </td>
                    <td className="border border-gray-200 px-2 py-2">
                      <input
                        value={p.name}
                        onChange={(e) => renameParticipant(p.id, e.target.value)}
                        placeholder="Nom"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </td>
                    {data.epreuves.map((ep) => (
                      <td key={ep.id} className="border border-gray-200 px-2 py-2 text-center">
                        <input
                          type="number"
                          value={data.scores[p.id]?.[ep.id] ?? ""}
                          onChange={(e) => setScore(p.id, ep.id, e.target.value)}
                          placeholder="—"
                          className="w-16 rounded border border-gray-300 px-2 py-1 text-center text-sm"
                        />
                      </td>
                    ))}
                    <td className="border border-gray-200 bg-blue-50 px-2 py-2 text-center text-base font-bold text-blue-700">
                      {p.total}
                    </td>
                    <td className="border border-gray-200 px-2 py-2 text-center">
                      <button
                        onClick={() => removeParticipant(p.id)}
                        aria-label="Supprimer le participant"
                        className="rounded px-1.5 py-1 text-gray-400 hover:bg-gray-200 hover:text-red-600"
                      >
                        🗑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-3 text-xs text-gray-400">
          {savedAt
            ? `Enregistré automatiquement à ${savedAt.toLocaleTimeString("fr-FR")}`
            : "Enregistrement automatique activé"}
        </p>
      </div>
    </div>
  );
}
