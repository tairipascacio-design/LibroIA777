import React from "react";
import {
  Sparkles,
  Check,
  X,
  BookOpen,
  ArrowRight,
  Clock,
  Users,
  Compass,
  ShieldCheck,
} from "lucide-react";
import { OrganizeResult } from "../types";

interface ReorganizationModalProps {
  result: OrganizeResult;
  rawText: string;
  onClose: () => void;
  onViewChapter: (chapterId?: string) => void;
}

export const ReorganizationModal: React.FC<ReorganizationModalProps> = ({
  result,
  rawText,
  onClose,
  onViewChapter,
}) => {
  const firstTargetChapterId = result.placements[0]?.targetChapterId;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-white/15 rounded-3xl max-w-3xl w-full p-6 sm:p-7 space-y-6 shadow-2xl relative text-stone-100 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Check className="w-3.5 h-3.5" />
                ¡Acomodado en su lugar!
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                Tus palabras exactas respetadas
              </span>
            </div>
            <h2 className="text-xl font-extrabold text-white">
              Estructura Cronológica y Acomodo en el Libro
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* AI Explanation of Chronology & Placement */}
        <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-violet-500/15 border border-amber-400/30 rounded-2xl p-4.5 space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
            <Compass className="w-4 h-4 text-amber-400" />
            ¿Cómo se interpretó y acomodó tu dictado?
          </span>
          <p className="text-xs sm:text-sm text-stone-200 leading-relaxed font-sans">
            {result.analysisSummary}
          </p>
        </div>

        {/* Original Dictation vs Placed text */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300">
            Capítulos actualizados con tus palabras exactas
          </h3>

          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {result.placements.map((p, idx) => (
              <div
                key={idx}
                className="bg-stone-950/80 border border-white/10 rounded-2xl p-4 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
                  <span className="font-bold text-xs text-amber-300 flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4 text-amber-400" />
                    {p.action === "create_chapter"
                      ? `Nuevo Capítulo: ${p.newChapterTitle}`
                      : `Acomodado en: Capítulo`}
                  </span>

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-200 border border-amber-500/20">
                    {p.chronologicalContext}
                  </span>
                </div>

                <p className="text-[11px] text-stone-300 italic">
                  💡 {p.placementExplanation}
                </p>

                <div className="p-3.5 rounded-xl bg-stone-900 border border-white/10 font-book text-stone-100 text-xs sm:text-sm leading-relaxed">
                  {p.polishedText}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Elements discovered */}
        {(result.newCharacters?.length || result.newTimelineEvents?.length) ? (
          <div className="p-3.5 rounded-2xl bg-stone-950/60 border border-white/10 text-xs space-y-2">
            <span className="font-bold text-amber-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              Elementos detectados en tu relato:
            </span>
            <div className="flex flex-wrap gap-2">
              {result.newCharacters?.map((c, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-xl bg-stone-850 text-stone-200 border border-white/10 flex items-center gap-1"
                >
                  <Users className="w-3 h-3 text-amber-400" />
                  {c.name} ({c.role})
                </span>
              ))}
              {result.newTimelineEvents?.map((t, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-xl bg-stone-850 text-stone-200 border border-white/10 flex items-center gap-1"
                >
                  <Clock className="w-3 h-3 text-rose-400" />
                  {t.timeContext}: {t.event}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {/* Footer Actions */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-stone-300 hover:text-white hover:bg-white/10 transition text-xs font-semibold"
          >
            Seguir dictando
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onViewChapter(firstTargetChapterId);
            }}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 hover:from-amber-300 hover:via-rose-400 hover:to-violet-400 text-stone-950 font-black text-xs flex items-center justify-center gap-2 shadow-lg transition"
          >
            <span>Ver cómo quedó en el libro</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
