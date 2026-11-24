import React, { useState } from "react";
import {
  Mic,
  MicOff,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Lightbulb,
  History,
  FileText,
  Volume2,
  CheckCircle2,
  AlertCircle,
  Clock,
  BookOpen,
  PlusCircle,
  Lock,
} from "lucide-react";
import {
  BillingStatus,
  Book,
  OrganizeResult,
  PaywallReason,
} from "../types";
import { useSpeechRecognition } from "../hooks/useSpeechRecognition";
import {
  organizeDictationRequest,
  getApiBaseUrl,
  PaywallError,
  buildAuthHeaders,
} from "../utils/apiClient";

interface DictationStudioProps {
  currentBook: Book;
  hasPersonalBook: boolean;
  onOpenNewBook: () => void;
  onApplyOrganizeResult: (result: OrganizeResult, rawText: string) => void;
  onSelectChapter: (chapterId: string) => void;
  selectedChapterId?: string;
  setSelectedChapterId: (id: string) => void;
  billingStatus: BillingStatus | null;
  onBillingUpdated: (status: BillingStatus) => void;
  onTriggerPaywall: (reason: PaywallReason) => void;
}

export const DictationStudio: React.FC<DictationStudioProps> = ({
  currentBook,
  hasPersonalBook,
  onOpenNewBook,
  onApplyOrganizeResult,
  selectedChapterId,
  setSelectedChapterId,
  billingStatus,
  onBillingUpdated,
  onTriggerPaywall,
}) => {
  const [dictationMode, setDictationMode] = useState<
    "auto_chronology" | "current_chapter" | "create_chapter" | "dialogue"
  >("auto_chronology");

  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [continuationPrompts, setContinuationPrompts] = useState<string[]>([
    "¿Qué detalle de aquel lugar o momento recuerdas con más claridad?",
    "¿Qué pasó justo antes o inmediatamente después de esa escena?",
    "¿Quién más estaba ahí y qué dijo o hizo en ese instante?",
    "¿Cómo te sentiste o qué pensamiento se te cruzó por la cabeza?",
  ]);
  const [isLoadingPrompts, setIsLoadingPrompts] = useState(false);
  const [manualText, setManualText] = useState("");
  const [lastResult, setLastResult] = useState<OrganizeResult | null>(null);
  const [subView, setSubView] = useState<"dictate" | "history">("dictate");

  const {
    isListening,
    transcript,
    interimTranscript,
    audioLevel,
    startListening,
    stopListening,
    resetTranscript,
    setManualTranscript,
  } = useSpeechRecognition({
    lang: "es-MX",
    onError: (err) => setErrorMessage(err),
  });

  const combinedText = transcript
    ? transcript + (interimTranscript ? " " + interimTranscript : "")
    : manualText;

  const isPro = Boolean(billingStatus?.isPro);
  const totalBookWords = currentBook.chapters.reduce(
    (sum, ch) => sum + ch.content.split(/\s+/).filter(Boolean).length,
    0
  );

  const handleRefreshPrompts = async () => {
    if (isLoadingPrompts || currentBook.chapters.length === 0) return;
    try {
      setIsLoadingPrompts(true);
      const headers = await buildAuthHeaders();
      const res = await fetch(`${getApiBaseUrl()}/api/continuation-prompts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          book: currentBook,
          currentChapterId: selectedChapterId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.prompts) && data.prompts.length > 0) {
          setContinuationPrompts(data.prompts);
        }
      }
    } catch (err) {
      console.warn("Could not load continuation prompts", err);
    } finally {
      setIsLoadingPrompts(false);
    }
  };

  const handleProcessDictation = async () => {
    const textToProcess = combinedText.trim();
    if (!textToProcess) {
      setErrorMessage("Por favor dicta o escribe algo primero.");
      return;
    }

    if (currentBook.isDemo) {
      onOpenNewBook();
      return;
    }

    if (!isPro && totalBookWords >= 1500) {
      onTriggerPaywall("words");
      return;
    }

    if (
      !isPro &&
      dictationMode === "create_chapter" &&
      currentBook.chapters.length >= 2
    ) {
      onTriggerPaywall("chapters");
      return;
    }

    if (isListening) {
      stopListening();
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const result = await organizeDictationRequest(
        textToProcess,
        currentBook,
        dictationMode,
        selectedChapterId
      );
      if (result.billingStatus) {
        onBillingUpdated(result.billingStatus);
      }
      setLastResult(result);
      onApplyOrganizeResult(result, textToProcess);
      resetTranscript();
      setManualText("");
    } catch (err: any) {
      if (err instanceof PaywallError) {
        if (err.billingStatus) {
          onBillingUpdated(err.billingStatus);
        }
        onTriggerPaywall("ai");
        return;
      }
      console.error("Error processing dictation:", err);
      setErrorMessage(
        err?.message || "Ocurrió un error al acomodar el dictado en el libro."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplySampleDictation = (sample: string) => {
    resetTranscript();
    setManualText(sample);
  };

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 py-3 sm:py-5 space-y-4">
      {/* First-time Welcome Banner: Auto-hides once user creates their first personal book */}
      {!hasPersonalBook && (
        <div className="relative overflow-hidden rounded-2xl p-4 sm:p-5 border border-white/10 bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-violet-500/15 backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                Tus palabras exactas, ordenadas en un libro real
              </h1>
              <p className="text-xs text-stone-200 leading-relaxed max-w-2xl">
                Explora la muestra en la pestaña <strong>Leer</strong> o crea tu
                propio libro para dictar sin reescrituras artificiales.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenNewBook}
              className="shrink-0 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 shadow-md transition whitespace-nowrap"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Crear Mi Primer Libro</span>
            </button>
          </div>
        </div>
      )}

      {/* Compact Study / History Toggle + Quota Line */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="bg-stone-900/90 p-1 rounded-xl border border-white/10 inline-flex text-xs font-bold">
          <button
            type="button"
            onClick={() => setSubView("dictate")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition ${
              subView === "dictate"
                ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Estudio</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView("history")}
            className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition tabular-nums ${
              subView === "history"
                ? "bg-gradient-to-r from-amber-500 to-rose-500 text-white shadow-sm"
                : "text-stone-300 hover:text-white"
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Historial ({currentBook.dictationHistory?.length || 0})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-stone-300 tabular-nums">
          {currentBook.isDemo ? (
            <button
              type="button"
              onClick={onOpenNewBook}
              className="text-amber-300 hover:text-amber-200 font-semibold underline"
            >
              Libro de muestra (solo lectura) · Crea el tuyo
            </button>
          ) : !isPro ? (
            <button
              type="button"
              onClick={() => onTriggerPaywall("ai")}
              className="flex items-center gap-1.5 text-amber-300 hover:text-amber-200 font-semibold"
            >
              <Lock className="w-3 h-3" />
              <span>
                {billingStatus?.aiRemaining ?? 3} de {billingStatus?.aiLimit ?? 3}{" "}
                acomodos IA gratis
              </span>
            </button>
          ) : (
            <span className="text-emerald-300 font-semibold">
              Plan Pro · Acomodos y palabras ilimitadas
            </span>
          )}
        </div>
      </div>

      {subView === "dictate" ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5">
          {/* Main Voice Studio Column */}
          <div className="lg:col-span-2 space-y-3.5">
            {/* Compact 2x2 Mode Chips Grid above Mic */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDictationMode("auto_chronology")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  dictationMode === "auto_chronology"
                    ? "bg-amber-500/20 border-amber-400 text-white font-bold shadow-sm"
                    : "bg-stone-900/80 border-white/10 text-stone-300 hover:bg-stone-800"
                }`}
              >
                <RefreshCw className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-xs leading-tight">Acomodo Cronológico</span>
              </button>

              <button
                type="button"
                onClick={() => setDictationMode("current_chapter")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  dictationMode === "current_chapter"
                    ? "bg-rose-500/20 border-rose-400 text-white font-bold shadow-sm"
                    : "bg-stone-900/80 border-white/10 text-stone-300 hover:bg-stone-800"
                }`}
              >
                <BookOpen className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-xs leading-tight">
                  Añadir al Capítulo Actual
                </span>
              </button>

              <button
                type="button"
                onClick={() => setDictationMode("create_chapter")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  dictationMode === "create_chapter"
                    ? "bg-violet-500/20 border-violet-400 text-white font-bold shadow-sm"
                    : "bg-stone-900/80 border-white/10 text-stone-300 hover:bg-stone-800"
                }`}
              >
                <Sparkles className="w-4 h-4 text-violet-400 shrink-0" />
                <span className="text-xs leading-tight">Crear Nuevo Capítulo</span>
              </button>

              <button
                type="button"
                onClick={() => setDictationMode("dialogue")}
                className={`min-h-[44px] px-3 py-2 rounded-xl border text-left transition flex items-center gap-2 ${
                  dictationMode === "dialogue"
                    ? "bg-cyan-500/20 border-cyan-400 text-white font-bold shadow-sm"
                    : "bg-stone-900/80 border-white/10 text-stone-300 hover:bg-stone-800"
                }`}
              >
                <Volume2 className="w-4 h-4 text-cyan-400 shrink-0" />
                <span className="text-xs leading-tight">
                  Conversación y Diálogo
                </span>
              </button>
            </div>

            {dictationMode === "current_chapter" && (
              <div className="bg-stone-900/80 border border-white/10 rounded-xl px-3 py-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-stone-300 font-medium">
                  Capítulo destino:
                </span>
                <select
                  value={selectedChapterId || currentBook.chapters[0]?.id || ""}
                  onChange={(e) => setSelectedChapterId(e.target.value)}
                  className="flex-1 min-w-0 bg-stone-800 text-stone-100 text-xs rounded-lg px-2.5 py-1.5 border border-white/15 focus:outline-none focus:ring-2 focus:ring-rose-500 font-semibold"
                >
                  {currentBook.chapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Immediately Visible Mic + Textarea Card (Zero scroll above the fold) */}
            <div className="bg-stone-900/90 border border-white/10 rounded-3xl p-4 sm:p-5 space-y-4 shadow-2xl relative overflow-hidden">
              {isListening && (
                <div className="absolute inset-x-0 top-0 h-1.5 bg-stone-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 transition-all duration-75"
                    style={{ width: `${Math.max(10, audioLevel)}%` }}
                  />
                </div>
              )}

              {/* Mic Button + Live Status */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="relative shrink-0">
                  {isListening && (
                    <div className="absolute -inset-3 rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-violet-500 animate-ping opacity-40 pointer-events-none" />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (isListening) stopListening();
                      else startListening();
                    }}
                    disabled={isProcessing}
                    className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center transition-all shadow-xl focus:outline-none ${
                      isListening
                        ? "bg-gradient-to-br from-rose-600 to-red-600 text-white scale-105 ring-4 ring-rose-400/40"
                        : "bg-gradient-to-tr from-amber-500 via-rose-500 to-violet-600 hover:from-amber-400 hover:via-rose-400 hover:to-violet-500 text-white hover:scale-105 active:scale-95"
                    } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {isListening ? (
                      <>
                        <MicOff className="w-7 h-7 animate-bounce" />
                        <span className="text-[10px] uppercase font-extrabold mt-1 tracking-wider">
                          Pausar
                        </span>
                      </>
                    ) : (
                      <>
                        <Mic className="w-7 h-7" />
                        <span className="text-[10px] uppercase font-extrabold mt-1 tracking-wider">
                          Dictar Voz
                        </span>
                      </>
                    )}
                  </button>
                </div>

                <div className="flex-1 text-center sm:text-left space-y-1">
                  <p className="text-sm sm:text-base font-bold text-white">
                    {isListening
                      ? "Escuchando en vivo... habla con libertad"
                      : combinedText
                      ? "Dictado listo para acomodar en el libro"
                      : "Presiona Dictar Voz y comienza a hablar"}
                  </p>
                  <p className="text-xs text-stone-300">
                    {currentBook.isDemo
                      ? "Estás viendo la muestra de solo lectura. Crea tu primer libro para guardar tus dictados."
                      : "Tus palabras exactas se conservan intactas; solo se ordenan y puntúan."}
                  </p>
                </div>
              </div>

              {/* Dictation Textbox */}
              <div className="space-y-1.5 text-left">
                <div className="flex items-center justify-between text-xs text-stone-300">
                  <span className="flex items-center gap-1.5 font-bold text-amber-300">
                    <FileText className="w-3.5 h-3.5 text-amber-400" />
                    Lo que has dictado:
                  </span>
                  {combinedText && (
                    <button
                      type="button"
                      onClick={() => {
                        resetTranscript();
                        setManualText("");
                      }}
                      className="text-stone-400 hover:text-rose-400 text-xs font-semibold transition"
                    >
                      Borrar texto
                    </button>
                  )}
                </div>

                <textarea
                  value={combinedText}
                  onChange={(e) => {
                    setManualText(e.target.value);
                    setManualTranscript(e.target.value);
                  }}
                  placeholder="Aquí aparecerán tus palabras exactas mientras hablas. También puedes escribir o pegar texto aquí..."
                  rows={4}
                  className="w-full bg-stone-950/90 border border-white/10 rounded-2xl p-3.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-400 leading-relaxed"
                />

                {interimTranscript && (
                  <div className="text-xs text-amber-300 italic flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 rounded-xl border border-amber-500/20">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>Detectando: "{interimTranscript}"</span>
                  </div>
                )}
              </div>

              {/* Submit Button Row */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                <span className="text-xs text-stone-400 tabular-nums">
                  {combinedText
                    ? `${combinedText.split(/\s+/).filter(Boolean).length} palabras capturadas`
                    : "Listo para capturar tus ideas"}
                </span>

                <button
                  type="button"
                  onClick={handleProcessDictation}
                  disabled={isProcessing || (!combinedText.trim() && !currentBook.isDemo)}
                  className={`w-full sm:w-auto px-6 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg transition ${
                    currentBook.isDemo
                      ? "bg-gradient-to-r from-amber-400 to-rose-500 text-stone-950"
                      : isProcessing || !combinedText.trim()
                      ? "bg-stone-800 text-stone-500 cursor-not-allowed border border-white/5"
                      : "bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 hover:from-amber-300 hover:via-rose-400 hover:to-violet-400 text-stone-950 font-black"
                  }`}
                >
                  {currentBook.isDemo ? (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      <span>Crear Mi Libro para Dictar</span>
                    </>
                  ) : isProcessing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Acomodando en el libro...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Acomodar en el Libro</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Quick Try Examples */}
            <div className="bg-stone-900/75 border border-white/10 rounded-2xl p-4 space-y-2.5">
              <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
                Probar ejemplo rápido (dictado al revés):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  type="button"
                  onClick={() =>
                    handleApplySampleDictation(
                      "Fíjate que al final descubrieron la carta secreta en el desván, pero espera, antes de eso, cuando él era un niño de ocho años, su abuelo siempre le advertía que nunca abriera el cajón de roble del sótano."
                    )
                  }
                  className="text-left p-3 rounded-xl bg-stone-950/70 hover:bg-stone-800 border border-white/5 text-stone-200 transition"
                >
                  <span className="font-bold text-amber-300 block mb-0.5">
                    Final primero + recuerdo anterior
                  </span>
                  <span className="text-stone-400 line-clamp-2">
                    "Al final descubrieron la carta secreta... pero antes cuando era niño..."
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleApplySampleDictation(
                      "El forastero empapado golpeó la puerta gritando que el río se había desbordado. Aunque dos horas antes, cuando el reloj se paró a las cinco y diecisiete, Don Valerio ya sentía que algo venía."
                    )
                  }
                  className="text-left p-3 rounded-xl bg-stone-950/70 hover:bg-stone-800 border border-white/5 text-stone-200 transition"
                >
                  <span className="font-bold text-rose-300 block mb-0.5">
                    Escena con presagio anterior
                  </span>
                  <span className="text-stone-400 line-clamp-2">
                    "El forastero golpeó la puerta... aunque dos horas antes..."
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Side Panel: Prompts & Last Placement */}
          <div className="space-y-4">
            {lastResult && (
              <div className="bg-amber-500/10 border border-amber-400/35 rounded-2xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-amber-300 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Último acomodo</span>
                </div>
                <p className="text-xs text-stone-200 leading-relaxed">
                  {lastResult.analysisSummary}
                </p>
              </div>
            )}

            <div className="bg-stone-900/90 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-amber-300">
                  Preguntas para inspirarte
                </span>
                <button
                  type="button"
                  onClick={handleRefreshPrompts}
                  disabled={isLoadingPrompts}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-amber-300 border border-white/10 transition disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${isLoadingPrompts ? "animate-spin" : ""}`}
                  />
                  <span>Nuevas</span>
                </button>
              </div>

              <div className="space-y-2">
                {continuationPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      resetTranscript();
                      setManualText(
                        (prev) =>
                          (prev ? prev + " " : "") +
                          `En cuanto a ${prompt.toLowerCase()}: `
                      );
                    }}
                    className="w-full text-left p-2.5 rounded-xl bg-stone-950/70 hover:bg-stone-800 border border-white/5 text-xs text-stone-200 transition flex items-start gap-2"
                  >
                    <span className="w-5 h-5 rounded-full bg-amber-400 text-stone-950 font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* History View */
        <div className="bg-stone-900/90 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              Historial de dictados
            </h2>
            <span className="text-xs text-stone-400 tabular-nums">
              {currentBook.dictationHistory?.length || 0} sesiones
            </span>
          </div>

          {currentBook.dictationHistory &&
          currentBook.dictationHistory.length > 0 ? (
            <div className="space-y-3">
              {currentBook.dictationHistory.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-xl bg-stone-950/80 border border-white/10 space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-400">
                    <span className="flex items-center gap-1.5 font-bold text-amber-300">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(item.timestamp).toLocaleString("es-MX", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                    <span className="text-stone-300 font-semibold">
                      {item.mode}
                    </span>
                  </div>
                  <p className="text-xs text-stone-200 bg-stone-900 p-3 rounded-lg">
                    "{item.rawText}"
                  </p>
                  <p className="text-xs text-emerald-300">{item.explanation}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center py-10 text-stone-400 text-sm">
              Aún no hay dictados registrados en este libro.
            </p>
          )}
        </div>
      )}
    </div>
  );
};
