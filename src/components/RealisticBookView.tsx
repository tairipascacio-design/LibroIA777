import React, { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Volume2,
  Play,
  Pause,
  RotateCcw,
  List,
  Mic,
  Bookmark,
  Lock,
} from "lucide-react";
import {
  BillingStatus,
  Book,
  BookChapter,
  BookPaperTheme,
  PaywallReason,
} from "../types";
import { useSpeechSynthesis } from "../hooks/useSpeechSynthesis";

interface RealisticBookViewProps {
  currentBook: Book;
  paperTheme: BookPaperTheme;
  fontSize: number;
  onGoToDictationForChapter: (chapterId: string) => void;
  selectedChapterId?: string;
  setSelectedChapterId: (id: string) => void;
  billingStatus: BillingStatus | null;
  onTriggerPaywall: (reason: PaywallReason) => void;
}

export const RealisticBookView: React.FC<RealisticBookViewProps> = ({
  currentBook,
  paperTheme,
  fontSize,
  onGoToDictationForChapter,
  selectedChapterId,
  setSelectedChapterId,
  billingStatus,
  onTriggerPaywall,
}) => {
  const [currentChapterIndex, setCurrentChapterIndex] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [isTwoPageView, setIsTwoPageView] = useState(true);

  const isPro = Boolean(billingStatus?.isPro);

  const {
    isPlaying,
    isPaused,
    voices,
    selectedVoice,
    setSelectedVoice,
    rate,
    setRate,
    speak,
    pause,
    resume,
    stop,
  } = useSpeechSynthesis();

  useEffect(() => {
    if (selectedChapterId) {
      const idx = currentBook.chapters.findIndex(
        (c) => c.id === selectedChapterId
      );
      if (idx !== -1) {
        setCurrentChapterIndex(idx);
      }
    } else if (currentBook.chapters.length > 0) {
      setSelectedChapterId(currentBook.chapters[0].id);
    }
  }, [selectedChapterId, currentBook.chapters]);

  const activeChapter: BookChapter | undefined =
    currentBook.chapters[currentChapterIndex] || currentBook.chapters[0];

  const pages = useMemo(() => {
    if (!activeChapter) return [[""]];
    const paragraphs = activeChapter.content.split("\n\n").filter(Boolean);

    if (paragraphs.length === 0) {
      return [["Aún no hay contenido en este capítulo. ¡Dicta para comenzar!"]];
    }

    const calculatedPages: string[][] = [];
    let currentPage: string[] = [];
    let currentWordCount = 0;
    const wordsPerPage = Math.max(160, Math.floor(400 - (fontSize - 16) * 15));

    paragraphs.forEach((p) => {
      const words = p.split(/\s+/).length;
      if (currentWordCount + words > wordsPerPage && currentPage.length > 0) {
        calculatedPages.push(currentPage);
        currentPage = [p];
        currentWordCount = words;
      } else {
        currentPage.push(p);
        currentWordCount += words;
      }
    });

    if (currentPage.length > 0) {
      calculatedPages.push(currentPage);
    }

    return calculatedPages;
  }, [activeChapter, fontSize]);

  const [pagePairIndex, setPagePairIndex] = useState(0);

  useEffect(() => {
    setPagePairIndex(0);
    stop();
  }, [currentChapterIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") {
        handlePrevPage();
      } else if (e.key === "ArrowRight") {
        handleNextPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pagePairIndex, pages.length, currentChapterIndex]);

  const handleNextPage = () => {
    const step = isTwoPageView ? 2 : 1;
    if (pagePairIndex + step < pages.length) {
      setPagePairIndex((prev) => prev + step);
    } else if (currentChapterIndex < currentBook.chapters.length - 1) {
      const nextIdx = currentChapterIndex + 1;
      setCurrentChapterIndex(nextIdx);
      setSelectedChapterId(currentBook.chapters[nextIdx].id);
    }
  };

  const handlePrevPage = () => {
    const step = isTwoPageView ? 2 : 1;
    if (pagePairIndex - step >= 0) {
      setPagePairIndex((prev) => prev - step);
    } else if (currentChapterIndex > 0) {
      const prevIdx = currentChapterIndex - 1;
      setCurrentChapterIndex(prevIdx);
      setSelectedChapterId(currentBook.chapters[prevIdx].id);
    }
  };

  const leftPageIndex = pagePairIndex;
  const rightPageIndex = isTwoPageView ? pagePairIndex + 1 : null;
  const leftPageContent = pages[leftPageIndex] || [];
  const rightPageContent =
    rightPageIndex !== null ? pages[rightPageIndex] || null : null;

  const isAudiobookLocked = !isPro && currentChapterIndex >= 1;

  const handleTogglePlayback = () => {
    if (isAudiobookLocked) {
      onTriggerPaywall("audiobook");
      return;
    }
    if (isPlaying) {
      pause();
    } else if (isPaused) {
      resume();
    } else if (activeChapter) {
      speak(activeChapter.content);
    }
  };

  const paperThemeClass =
    paperTheme === "classic"
      ? "paper-classic"
      : paperTheme === "peach"
      ? "paper-peach"
      : paperTheme === "mint"
      ? "paper-mint"
      : "paper-lavender";

  return (
    <div className="max-w-6xl mx-auto px-2.5 sm:px-4 py-4 space-y-4">
      {/* Top Reading Toolbar — flexible wrapping, zero selector clipping */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-stone-900 border border-stone-800 rounded-xl px-3.5 py-2.5 text-xs text-stone-300">
        <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setShowToc(!showToc)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition font-medium shrink-0"
          >
            <List className="w-3.5 h-3.5 text-amber-400" />
            <span>Índice</span>
          </button>

          <select
            aria-label="Seleccionar capítulo para leer"
            value={activeChapter?.id || ""}
            onChange={(e) => {
              const idx = currentBook.chapters.findIndex(
                (c) => c.id === e.target.value
              );
              if (idx !== -1) {
                setCurrentChapterIndex(idx);
                setSelectedChapterId(e.target.value);
              }
            }}
            className="flex-1 min-w-0 max-w-full bg-stone-800 text-stone-200 rounded-lg px-2.5 py-1.5 border border-stone-700 focus:outline-none focus:border-amber-500 font-medium truncate"
          >
            {currentBook.chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.title}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setIsTwoPageView(!isTwoPageView)}
            className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-amber-400" />
            <span>{isTwoPageView ? "2 Páginas" : "1 Página"}</span>
          </button>

          {activeChapter && (
            <button
              type="button"
              onClick={() => onGoToDictationForChapter(activeChapter.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold transition shadow-sm whitespace-nowrap"
            >
              <Mic className="w-3.5 h-3.5" />
              <span>Dictar aquí</span>
            </button>
          )}
        </div>
      </div>

      {/* Table of Contents */}
      {showToc && (
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-stone-800">
            <h3 className="font-display-book text-base text-stone-100 font-bold flex items-center gap-2 min-w-0">
              <Bookmark className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">Índice — {currentBook.title}</span>
            </h3>
            <button
              type="button"
              onClick={() => setShowToc(false)}
              className="text-stone-400 hover:text-white text-xs px-2 py-1 rounded hover:bg-stone-800 shrink-0"
            >
              Cerrar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {currentBook.chapters.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => {
                  setCurrentChapterIndex(idx);
                  setSelectedChapterId(ch.id);
                  setShowToc(false);
                }}
                className={`text-left p-3 rounded-xl border transition flex items-start justify-between gap-3 ${
                  idx === currentChapterIndex
                    ? "bg-amber-950/40 border-amber-500/60 text-amber-300"
                    : "bg-stone-950/40 border-stone-800 text-stone-300 hover:bg-stone-800"
                }`}
              >
                <div className="min-w-0">
                  <span className="font-semibold block">{ch.title}</span>
                  <span className="text-[11px] text-stone-400 line-clamp-1 mt-0.5">
                    {ch.summary || ch.content.slice(0, 80) + "..."}
                  </span>
                </div>
                <span className="text-stone-500 font-mono tabular-nums shrink-0">
                  {ch.content.split(/\s+/).filter(Boolean).length} pal
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Realistic Book Spread Container (Kindle typography: left on mobile + hyphens-auto) */}
      <div className="relative select-text" lang="es">
        <div className="rounded-2xl p-1.5 sm:p-5 bg-gradient-to-b from-stone-900 via-stone-950 to-stone-900 shadow-2xl border border-stone-800/80">
          <div
            className={`rounded-xl overflow-hidden grid ${
              isTwoPageView && rightPageContent !== null
                ? "grid-cols-1 md:grid-cols-2"
                : "grid-cols-1"
            } shadow-2xl border border-stone-300/20`}
          >
            {/* Left Page (or Single Page) */}
            <div
              className={`p-5 sm:p-11 transition-colors duration-200 flex flex-col justify-between min-h-[480px] sm:min-h-[600px] ${paperThemeClass} ${
                isTwoPageView && rightPageContent !== null
                  ? "book-gutter-left md:border-r md:border-stone-400/30"
                  : ""
              }`}
            >
              <div className="border-b border-current/15 pb-2 mb-5 flex items-center justify-between gap-2 text-[10px] sm:text-[11px] uppercase tracking-widest opacity-60 font-cinzel">
                <span className="truncate">{currentBook.title}</span>
                <span className="truncate shrink-0">
                  {currentBook.author || ""}
                </span>
              </div>

              <div className="flex-1 font-book leading-relaxed text-left sm:text-justify hyphens-auto space-y-4">
                {pagePairIndex === 0 && (
                  <div className="text-center my-3 space-y-2">
                    <span className="text-xs uppercase tracking-widest text-current/70 font-cinzel block">
                      ❦ ❦ ❦
                    </span>
                    <h2 className="text-xl sm:text-3xl font-display-book font-bold tracking-tight leading-snug">
                      {activeChapter?.title}
                    </h2>
                    <div className="w-16 h-0.5 bg-current/25 mx-auto mt-2" />
                  </div>
                )}

                {leftPageContent.map((paragraph, pIdx) => (
                  <p
                    key={pIdx}
                    style={{ fontSize: `${fontSize}px` }}
                    className={`leading-relaxed ${
                      pagePairIndex === 0 && pIdx === 0
                        ? "book-drop-cap"
                        : "indent-5 sm:indent-8"
                    }`}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              <div className="pt-4 mt-6 border-t border-current/10 flex items-center justify-between text-xs font-mono opacity-50 tabular-nums">
                <span className="truncate">{currentBook.genre}</span>
                <span className="shrink-0">Página {pagePairIndex * 2 + 1}</span>
              </div>
            </div>

            {/* Right Page (Desktop Two Page Mode) */}
            {isTwoPageView && rightPageContent !== null && (
              <div
                className={`p-6 sm:p-11 transition-colors duration-200 flex-col justify-between min-h-[600px] ${paperThemeClass} book-gutter-right hidden md:flex`}
              >
                <div className="border-b border-current/15 pb-2 mb-5 flex items-center justify-between gap-2 text-[11px] uppercase tracking-widest opacity-60 font-cinzel">
                  <span className="truncate">{activeChapter?.title}</span>
                  <span className="truncate shrink-0">{currentBook.title}</span>
                </div>

                <div className="flex-1 font-book leading-relaxed text-justify hyphens-auto space-y-4">
                  {rightPageContent.map((paragraph, pIdx) => (
                    <p
                      key={pIdx}
                      style={{ fontSize: `${fontSize}px` }}
                      className="leading-relaxed indent-8"
                    >
                      {paragraph}
                    </p>
                  ))}
                </div>

                <div className="pt-4 mt-6 border-t border-current/10 flex items-center justify-between text-xs font-mono opacity-50 tabular-nums">
                  <span>Página {pagePairIndex * 2 + 2}</span>
                  <span>Capítulo {currentChapterIndex + 1}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Page Turn Controls */}
        <div className="flex items-center justify-between gap-2 mt-3 px-1">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={pagePairIndex === 0 && currentChapterIndex === 0}
            className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition whitespace-nowrap ${
              pagePairIndex === 0 && currentChapterIndex === 0
                ? "bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed"
                : "bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700"
            }`}
          >
            <ChevronLeft className="w-4 h-4 text-amber-400" />
            <span>Anterior</span>
          </button>

          <span className="text-[11px] sm:text-xs text-stone-400 font-mono tabular-nums text-center">
            Cap. {currentChapterIndex + 1}/{currentBook.chapters.length} · Pág.{" "}
            {pagePairIndex + 1}/{pages.length}
          </span>

          <button
            type="button"
            onClick={handleNextPage}
            disabled={
              pagePairIndex + (isTwoPageView ? 2 : 1) >= pages.length &&
              currentChapterIndex >= currentBook.chapters.length - 1
            }
            className={`flex items-center gap-1 px-3 sm:px-4 py-2 rounded-xl text-xs font-semibold shadow-md transition whitespace-nowrap ${
              pagePairIndex + (isTwoPageView ? 2 : 1) >= pages.length &&
              currentChapterIndex >= currentBook.chapters.length - 1
                ? "bg-stone-900 text-stone-600 border border-stone-800 cursor-not-allowed"
                : "bg-stone-900 hover:bg-stone-800 text-stone-200 border border-stone-700"
            }`}
          >
            <span>Siguiente</span>
            <ChevronRight className="w-4 h-4 text-amber-400" />
          </button>
        </div>
      </div>

      {/* Audiobook Player Dock */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-4 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto min-w-0">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
            <Volume2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400 block">
              Audiolibro Integrado{" "}
              {!isPro && "· Muestra gratis en Cap. 1"}
            </span>
            <p className="text-xs text-stone-200 font-medium truncate">
              {isAudiobookLocked
                ? "Desbloquea Pro para escuchar el libro completo"
                : isPlaying
                ? `Leyendo: ${activeChapter?.title}`
                : isPaused
                ? "Lectura en pausa"
                : `Escuchar ${activeChapter?.title}`}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              const rates = [0.85, 1.0, 1.25];
              const nextIndex = (rates.indexOf(rate) + 1) % rates.length;
              setRate(rates[nextIndex]);
            }}
            className="px-2.5 py-1.5 rounded-lg bg-stone-800 border border-stone-700 text-stone-300 hover:text-white text-xs font-mono font-semibold"
          >
            {rate}x
          </button>

          {voices.length > 0 && (
            <select
              value={selectedVoice?.name || ""}
              onChange={(e) => {
                const voice = voices.find((v) => v.name === e.target.value);
                if (voice) setSelectedVoice(voice);
              }}
              className="bg-stone-800 text-stone-300 text-xs rounded-lg px-2.5 py-1.5 border border-stone-700 focus:outline-none focus:border-amber-500 max-w-[140px] truncate"
            >
              {voices
                .filter((v) => v.lang.startsWith("es") || v.lang.startsWith("en"))
                .map((v) => (
                  <option key={v.name} value={v.name}>
                    {v.name} ({v.lang})
                  </option>
                ))}
            </select>
          )}

          <button
            type="button"
            onClick={handleTogglePlayback}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md transition ${
              isAudiobookLocked
                ? "bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-400/30"
                : "bg-gradient-to-r from-amber-500 to-amber-400 hover:from-amber-400 hover:to-amber-300 text-stone-950"
            }`}
          >
            {isAudiobookLocked ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Desbloquear Audio Pro</span>
              </>
            ) : isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-current" />
                <span>Pausar</span>
              </>
            ) : isPaused ? (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Reanudar</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Reproducir</span>
              </>
            )}
          </button>

          {(isPlaying || isPaused) && (
            <button
              type="button"
              onClick={stop}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 transition"
              title="Detener audio"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
