import React, { useState } from "react";
import { Users, Clock, Plus, Trash2, Lock } from "lucide-react";
import {
  BillingStatus,
  Book,
  Character,
  PaywallReason,
  TimelineEvent,
} from "../types";

interface CharactersTimelineProps {
  currentBook: Book;
  onUpdateBook: (updated: Partial<Book>) => void;
  onOpenNewBook: () => void;
  billingStatus: BillingStatus | null;
  onTriggerPaywall: (reason: PaywallReason) => void;
}

export const CharactersTimelineModal: React.FC<CharactersTimelineProps> = ({
  currentBook,
  onUpdateBook,
  onOpenNewBook,
  billingStatus,
  onTriggerPaywall,
}) => {
  const [activeTab, setActiveTab] = useState<"characters" | "timeline">(
    "characters"
  );

  const [newCharName, setNewCharName] = useState("");
  const [newCharRole, setNewCharRole] = useState("");
  const [newCharDesc, setNewCharDesc] = useState("");

  const [newTlTime, setNewTlTime] = useState("");
  const [newTlEvent, setNewTlEvent] = useState("");

  const isPro = Boolean(billingStatus?.isPro);
  const isReadOnlyDemo = Boolean(currentBook.isDemo);
  const reachedCharacterLimit =
    !isPro && !isReadOnlyDemo && currentBook.characters.length >= 3;

  const handleAddCharacter = () => {
    if (isReadOnlyDemo) {
      onOpenNewBook();
      return;
    }
    if (reachedCharacterLimit) {
      onTriggerPaywall("characters");
      return;
    }
    if (!newCharName.trim()) return;
    const newChar: Character = {
      id: `char-${Date.now()}`,
      name: newCharName.trim(),
      role: newCharRole.trim() || "Personaje secundario",
      description: newCharDesc.trim() || "Sin descripción",
    };
    onUpdateBook({
      characters: [...currentBook.characters, newChar],
    });
    setNewCharName("");
    setNewCharRole("");
    setNewCharDesc("");
  };

  const handleDeleteCharacter = (id: string) => {
    if (isReadOnlyDemo) return;
    onUpdateBook({
      characters: currentBook.characters.filter((c) => c.id !== id),
    });
  };

  const handleAddTimeline = () => {
    if (isReadOnlyDemo) {
      onOpenNewBook();
      return;
    }
    if (!newTlEvent.trim()) return;
    const newEvent: TimelineEvent = {
      id: `tl-${Date.now()}`,
      timeContext: newTlTime.trim() || "En el curso de la historia",
      event: newTlEvent.trim(),
    };
    onUpdateBook({
      timeline: [...currentBook.timeline, newEvent],
    });
    setNewTlTime("");
    setNewTlEvent("");
  };

  const handleDeleteTimeline = (id: string) => {
    if (isReadOnlyDemo) return;
    onUpdateBook({
      timeline: currentBook.timeline.filter((t) => t.id !== id),
    });
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-5">
      {isReadOnlyDemo && (
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-200">
            Reparto y línea temporal de demostración (solo lectura).
          </span>
          <button
            type="button"
            onClick={onOpenNewBook}
            className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-stone-950 font-bold hover:bg-amber-300 transition"
          >
            Crear Mi Libro
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("characters")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm tabular-nums ${
              activeTab === "characters"
                ? "bg-gradient-to-r from-amber-400 to-rose-500 text-stone-950"
                : "text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-850"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>
              Personajes ({currentBook.characters.length}
              {!isPro && !isReadOnlyDemo ? "/3" : ""})
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition shadow-sm tabular-nums ${
              activeTab === "timeline"
                ? "bg-gradient-to-r from-rose-500 to-violet-500 text-white"
                : "text-stone-300 hover:text-white bg-stone-900 hover:bg-stone-850"
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Línea Temporal ({currentBook.timeline.length})</span>
          </button>
        </div>

        <span className="text-xs text-stone-400 hidden sm:inline">
          Se actualiza automáticamente al dictar
        </span>
      </div>

      {activeTab === "characters" ? (
        <div className="space-y-5">
          {!isReadOnlyDemo && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5" />
                  Añadir Personaje al Reparto
                </h3>
                {reachedCharacterLimit && (
                  <span className="text-[11px] text-amber-300 flex items-center gap-1 font-semibold">
                    <Lock className="w-3 h-3" />
                    Límite gratis: 3 personajes
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Nombre del personaje"
                  value={newCharName}
                  onChange={(e) => setNewCharName(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="Rol (ej: Protagonista, Aliado)"
                  value={newCharRole}
                  onChange={(e) => setNewCharRole(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <textarea
                placeholder="Descripción breve, motivaciones o rasgos particulares..."
                value={newCharDesc}
                onChange={(e) => setNewCharDesc(e.target.value)}
                rows={2}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleAddCharacter}
                  disabled={!reachedCharacterLimit && !newCharName.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-stone-950 font-black text-xs transition shadow-md disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  {reachedCharacterLimit && <Lock className="w-3.5 h-3.5" />}
                  <span>
                    {reachedCharacterLimit
                      ? "Desbloquear Personajes Pro"
                      : "Guardar Personaje"}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Characters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentBook.characters.map((char) => (
              <div
                key={char.id}
                className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-2 relative group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="font-display-book font-bold text-base text-stone-100 break-words">
                      {char.name}
                    </h4>
                    <span className="text-xs text-amber-300 font-medium inline-block mt-0.5">
                      {char.role}
                    </span>
                  </div>
                  {!isReadOnlyDemo && (
                    <button
                      type="button"
                      onClick={() => handleDeleteCharacter(char.id)}
                      className="p-1.5 rounded-lg text-stone-500 hover:text-red-400 hover:bg-stone-800 transition shrink-0"
                      title="Eliminar personaje"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-stone-300 leading-relaxed pt-1">
                  {char.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {!isReadOnlyDemo && (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 space-y-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                Añadir Hito Cronológico
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  placeholder="Momento temporal (ej: 5:17 PM)"
                  value={newTlTime}
                  onChange={(e) => setNewTlTime(e.target.value)}
                  className="bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
                <input
                  type="text"
                  placeholder="¿Qué sucedió en la historia?"
                  value={newTlEvent}
                  onChange={(e) => setNewTlEvent(e.target.value)}
                  className="sm:col-span-2 bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div className="text-right">
                <button
                  type="button"
                  onClick={handleAddTimeline}
                  disabled={!newTlEvent.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-rose-500 to-violet-500 hover:from-rose-400 hover:to-violet-400 text-white font-black text-xs transition shadow-md disabled:opacity-40"
                >
                  Añadir a la Línea de Tiempo
                </button>
              </div>
            </div>
          )}

          <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-amber-500/30">
            {currentBook.timeline.map((item) => (
              <div key={item.id} className="relative group">
                <span className="absolute -left-[22px] top-1.5 w-3 h-3 rounded-full bg-amber-500 ring-4 ring-stone-900" />
                <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <span className="text-xs font-mono font-bold text-amber-400">
                      {item.timeContext}
                    </span>
                    <p className="text-xs sm:text-sm text-stone-200 leading-relaxed">
                      {item.event}
                    </p>
                  </div>
                  {!isReadOnlyDemo && (
                    <button
                      type="button"
                      onClick={() => handleDeleteTimeline(item.id)}
                      className="p-1 rounded text-stone-500 hover:text-red-400 transition shrink-0"
                      title="Eliminar hito"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
