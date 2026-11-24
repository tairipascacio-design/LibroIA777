import React, { useState } from "react";
import {
  Sparkles,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  ArrowUp,
  ArrowDown,
  Wand2,
  FileText,
  Clock,
  Mic,
  Lock,
} from "lucide-react";
import {
  BillingStatus,
  Book,
  BookChapter,
  PaywallReason,
} from "../types";
import { PaywallError, refineChapterRequest } from "../utils/apiClient";

interface ChapterEditorProps {
  currentBook: Book;
  onUpdateChapter: (chapterId: string, updated: Partial<BookChapter>) => void;
  onAddChapter: () => void;
  onDeleteChapter: (chapterId: string) => void;
  onReorderChapter: (chapterId: string, direction: "up" | "down") => void;
  selectedChapterId?: string;
  setSelectedChapterId: (id: string) => void;
  onGoToDictation: (chapterId: string) => void;
  onOpenNewBook: () => void;
  billingStatus: BillingStatus | null;
  onBillingUpdated: (status: BillingStatus) => void;
  onTriggerPaywall: (reason: PaywallReason) => void;
}

export const ChapterEditor: React.FC<ChapterEditorProps> = ({
  currentBook,
  onUpdateChapter,
  onAddChapter,
  onDeleteChapter,
  onReorderChapter,
  selectedChapterId,
  setSelectedChapterId,
  onGoToDictation,
  onOpenNewBook,
  billingStatus,
  onBillingUpdated,
  onTriggerPaywall,
}) => {
  const activeChapter =
    currentBook.chapters.find((c) => c.id === selectedChapterId) ||
    currentBook.chapters[0];

  const [isPolishing, setIsPolishing] = useState(false);
  const [polishInstruction, setPolishInstruction] = useState(
    "Corregir únicamente puntuación y orden de párrafos manteniendo las palabras exactas del autor"
  );
  const [polishedPreview, setPolishedPreview] = useState<string | null>(null);
  const [polishError, setPolishError] = useState<string | null>(null);

  const isPro = Boolean(billingStatus?.isPro);
  const isReadOnlyDemo = Boolean(currentBook.isDemo);

  const wordCount = activeChapter?.content
    ? activeChapter.content.split(/\s+/).filter(Boolean).length
    : 0;
  const readingTimeMin = Math.max(1, Math.ceil(wordCount / 200));

  const handleRefineWithAI = async () => {
    if (!activeChapter?.content.trim()) return;
    if (isReadOnlyDemo) {
      onOpenNewBook();
      return;
    }
    setIsPolishing(true);
    setPolishedPreview(null);
    setPolishError(null);
    try {
      const data = await refineChapterRequest(
        activeChapter.content,
        currentBook.genre,
        polishInstruction
      );
      if (data.billingStatus) {
        onBillingUpdated(data.billingStatus);
      }
      setPolishedPreview(data.refinedText);
    } catch (err: any) {
      if (err instanceof PaywallError) {
        if (err.billingStatus) onBillingUpdated(err.billingStatus);
        onTriggerPaywall("ai");
        return;
      }
      console.error(err);
      setPolishError(
        err?.message || "No se pudo acomodar el capítulo en este momento."
      );
    } finally {
      setIsPolishing(false);
    }
  };

  const handleApplyPolished = () => {
    if (polishedPreview && activeChapter && !isReadOnlyDemo) {
      onUpdateChapter(activeChapter.id, { content: polishedPreview });
      setPolishedPreview(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4">
      {isReadOnlyDemo && (
        <div className="bg-amber-500/10 border border-amber-400/30 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="text-amber-200">
            Libro de demostración (solo lectura). Crea tu propio libro para
            editar, dictar y añadir capítulos.
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        {/* Chapters Sidebar */}
        <div className="lg:col-span-1 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800 gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-400 tabular-nums">
              Capítulos ({currentBook.chapters.length}
              {!isPro && !isReadOnlyDemo ? " / 2 gratis" : ""})
            </h3>
            <button
              type="button"
              onClick={() => {
                if (isReadOnlyDemo) {
                  onOpenNewBook();
                  return;
                }
                if (!isPro && currentBook.chapters.length >= 2) {
                  onTriggerPaywall("chapters");
                  return;
                }
                onAddChapter();
              }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-stone-950 font-bold transition shadow-md whitespace-nowrap"
            >
              {!isPro && !isReadOnlyDemo && currentBook.chapters.length >= 2 ? (
                <Lock className="w-3.5 h-3.5" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>Nuevo</span>
            </button>
          </div>

          <div className="space-y-2 max-h-[320px] lg:max-h-[600px] overflow-y-auto pr-1">
            {currentBook.chapters.map((ch, idx) => {
              const isSelected = ch.id === activeChapter?.id;
              return (
                <div
                  key={ch.id}
                  onClick={() => setSelectedChapterId(ch.id)}
                  className={`group p-3.5 rounded-2xl border text-left cursor-pointer transition flex flex-col justify-between ${
                    isSelected
                      ? "bg-gradient-to-br from-amber-500/20 via-rose-500/20 to-transparent border-amber-400/80 ring-2 ring-amber-400/30 text-white shadow-md"
                      : "bg-stone-900/80 border-white/10 text-stone-300 hover:bg-stone-850 hover:border-white/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-semibold text-xs leading-snug break-words min-w-0">
                      {ch.title || `Capítulo ${idx + 1}`}
                    </span>
                    {!isReadOnlyDemo && (
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorderChapter(ch.id, "up");
                          }}
                          disabled={idx === 0}
                          className="p-1 hover:text-amber-400 disabled:opacity-30"
                          title="Subir"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onReorderChapter(ch.id, "down");
                          }}
                          disabled={idx === currentBook.chapters.length - 1}
                          className="p-1 hover:text-amber-400 disabled:opacity-30"
                          title="Bajar"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-stone-500 mt-2 font-mono tabular-nums">
                    <span>
                      {ch.content.split(/\s+/).filter(Boolean).length} palabras
                    </span>
                    <span>Cap. {idx + 1}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chapter Prose Editor Area */}
        <div className="lg:col-span-3 space-y-4 min-w-0">
          {activeChapter ? (
            <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-6 space-y-4">
              {/* Chapter Title & Quick Actions (full wrapping, never truncated) */}
              <div className="flex flex-col gap-3 pb-3 border-b border-stone-800">
                <input
                  type="text"
                  readOnly={isReadOnlyDemo}
                  value={activeChapter.title}
                  onChange={(e) =>
                    onUpdateChapter(activeChapter.id, { title: e.target.value })
                  }
                  placeholder="Título del Capítulo..."
                  className="w-full min-w-0 bg-transparent text-base sm:text-xl font-bold font-display-book text-stone-100 focus:outline-none focus:border-b focus:border-amber-500 py-1"
                />

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onGoToDictation(activeChapter.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold border border-stone-700 transition whitespace-nowrap"
                  >
                    <Mic className="w-3.5 h-3.5 text-amber-400" />
                    <span>Dictarle a este capítulo</span>
                  </button>

                  {!isReadOnlyDemo && currentBook.chapters.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteChapter(activeChapter.id)}
                      className="flex items-center gap-1 px-3 py-2 rounded-xl bg-stone-800 hover:bg-red-950/60 text-stone-400 hover:text-red-400 border border-stone-700 text-xs transition"
                      title="Eliminar este capítulo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Eliminar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* AI Polishing Bar (responsive full-width select so option text never clips) */}
              <div className="bg-stone-950/80 border border-white/10 rounded-2xl p-3.5 space-y-2.5">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <Wand2 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  Ajustar y dar formato al capítulo
                </span>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <select
                    value={polishInstruction}
                    onChange={(e) => setPolishInstruction(e.target.value)}
                    className="w-full sm:flex-1 min-w-0 bg-stone-800 text-stone-200 text-xs rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400 font-medium"
                  >
                    <option value="Corregir únicamente puntuación y orden de párrafos manteniendo las palabras exactas del autor">
                      Fiel a mis palabras: solo puntuación y párrafos
                    </option>
                    <option value="Ajustar y estructurar diálogos con guiones largos (—) sin cambiar el vocabulario">
                      Formatear diálogos con raya literaria (—)
                    </option>
                    <option value="Corrección de ortografía y puntuación básica sin alterar la voz">
                      Corrección ortográfica limpia
                    </option>
                    <option value="Enriquecer descripciones y ritmo literario conservando la voz del autor">
                      Enriquecer ritmo y sensorialidad
                    </option>
                  </select>

                  <button
                    type="button"
                    onClick={handleRefineWithAI}
                    disabled={isPolishing || !activeChapter.content.trim()}
                    className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-stone-950 font-bold text-xs transition disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shrink-0 whitespace-nowrap"
                  >
                    {isPolishing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Ajustando...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Acomodar</span>
                      </>
                    )}
                  </button>
                </div>

                {polishError && (
                  <div className="p-3 bg-rose-950/60 border border-rose-500/40 rounded-lg text-xs text-rose-200">
                    {polishError}
                  </div>
                )}

                {polishedPreview && (
                  <div className="p-3 bg-stone-900 rounded-lg border border-amber-500/40 space-y-2 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-amber-300 font-semibold">
                      <span>Vista previa de versión pulida</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleApplyPolished}
                          className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" />
                          <span>Aplicar cambios</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setPolishedPreview(null)}
                          className="px-2 py-1 text-stone-400 hover:text-stone-200"
                        >
                          Descartar
                        </button>
                      </div>
                    </div>
                    <div className="max-h-36 overflow-y-auto font-book text-stone-300 leading-relaxed bg-stone-950 p-2 rounded">
                      {polishedPreview}
                    </div>
                  </div>
                )}
              </div>

              {/* Chapter Body Textarea */}
              <textarea
                readOnly={isReadOnlyDemo}
                value={activeChapter.content}
                onChange={(e) =>
                  onUpdateChapter(activeChapter.id, {
                    content: e.target.value,
                  })
                }
                rows={15}
                placeholder="Escribe o edita el texto del capítulo aquí..."
                className="w-full bg-stone-950 border border-stone-800 rounded-xl p-4 text-sm font-book leading-relaxed text-stone-200 placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />

              {/* Bottom Stats */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400 pt-2 border-t border-stone-800 font-mono tabular-nums">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    {wordCount.toLocaleString()} palabras
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-400" />~
                    {readingTimeMin} min lectura
                  </span>
                </div>
                <span>
                  Edición:{" "}
                  {new Date(activeChapter.updatedAt).toLocaleTimeString(
                    "es-MX",
                    {
                      hour: "2-digit",
                      minute: "2-digit",
                    }
                  )}
                </span>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-stone-500">
              Selecciona o crea un capítulo para editar.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
