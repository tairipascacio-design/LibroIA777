import React, { useState } from "react";
import {
  X,
  Printer,
  Download,
  Copy,
  Check,
  FileText,
  BookOpen,
  Lock,
  Loader2,
  FileCode2,
} from "lucide-react";
import { BillingStatus, Book, PaywallReason } from "../types";
import { exportBookAsDocx, exportBookAsEpub } from "../utils/exporters";

interface ExportModalProps {
  currentBook: Book;
  onClose: () => void;
  billingStatus: BillingStatus | null;
  onTriggerPaywall: (reason: PaywallReason) => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  currentBook,
  onClose,
  billingStatus,
  onTriggerPaywall,
}) => {
  const [copied, setCopied] = useState(false);
  const [exportingType, setExportingType] = useState<string | null>(null);

  const isPro = Boolean(billingStatus?.isPro);

  const totalWords = currentBook.chapters.reduce(
    (sum, c) => sum + c.content.split(/\s+/).filter(Boolean).length,
    0
  );

  const getFullManuscriptText = () => {
    let full = `# ${currentBook.title}\n`;
    if (currentBook.subtitle) full += `## ${currentBook.subtitle}\n`;
    if (currentBook.author) full += `Por: ${currentBook.author}\n\n`;
    full += `Género: ${currentBook.genre}\n`;
    full += `Sinopsis: ${currentBook.synopsis}\n\n---\n\n`;

    currentBook.chapters.forEach((ch, idx) => {
      full += `### ${ch.title || `Capítulo ${idx + 1}`}\n\n`;
      full += `${ch.content}\n\n* * *\n\n`;
    });

    return full;
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFullManuscriptText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const text = getFullManuscriptText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentBook.title.replace(/\s+/g, "_")}_Manuscrito.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportEpub = async () => {
    if (!isPro) {
      onTriggerPaywall("export");
      return;
    }
    setExportingType("epub");
    try {
      await exportBookAsEpub(currentBook);
    } finally {
      setExportingType(null);
    }
  };

  const handleExportDocx = async () => {
    if (!isPro) {
      onTriggerPaywall("export");
      return;
    }
    setExportingType("docx");
    try {
      await exportBookAsDocx(currentBook);
    } finally {
      setExportingType(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-2xl w-full p-5 sm:p-6 space-y-5 shadow-2xl relative text-stone-200 my-6 max-h-[92vh] overflow-y-auto">
        {/* Header (wrapping cleanly, never clipped on mobile) */}
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-800">
          <div className="flex items-start gap-2.5 min-w-0">
            <BookOpen className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold font-display-book text-stone-100 leading-snug break-words">
                Exportar Manuscrito — {currentBook.title}
              </h2>
              <p className="text-xs text-stone-400 font-mono tabular-nums mt-0.5">
                {currentBook.chapters.length} capítulos ·{" "}
                {totalWords.toLocaleString()} palabras
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition shrink-0"
            aria-label="Cerrar exportación"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Pro Formats + Preview Formats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* EPUB Real for Amazon KDP / Kindle */}
          <button
            type="button"
            onClick={handleExportEpub}
            disabled={exportingType === "epub"}
            className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-amber-500/15 to-rose-500/10 hover:from-amber-500/25 hover:to-rose-500/20 border border-amber-400/40 transition text-left relative"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-stone-950 flex items-center justify-center shrink-0">
              {exportingType === "epub" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Download className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-white">
                  eBook (.EPUB)
                </span>
                {!isPro && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400 text-stone-950 shrink-0">
                    <Lock className="w-3 h-3" />
                    Pro
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-300 mt-1">
                Archivo oficial listo para Amazon KDP, Kindle y Apple Books.
              </p>
            </div>
          </button>

          {/* DOCX Word */}
          <button
            type="button"
            onClick={handleExportDocx}
            disabled={exportingType === "docx"}
            className="flex items-start gap-3 p-4 rounded-2xl bg-gradient-to-br from-cyan-500/15 to-violet-500/10 hover:from-cyan-500/25 hover:to-violet-500/20 border border-cyan-400/35 transition text-left relative"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-400 text-stone-950 flex items-center justify-center shrink-0">
              {exportingType === "docx" ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <FileCode2 className="w-5 h-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-sm text-white">
                  Microsoft Word (.DOCX)
                </span>
                {!isPro && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-amber-400 text-stone-950 shrink-0">
                    <Lock className="w-3 h-3" />
                    Pro
                  </span>
                )}
              </div>
              <p className="text-[11px] text-stone-300 mt-1">
                Documento editable con portada y saltos de capítulo.
              </p>
            </div>
          </button>

          {/* Print / PDF */}
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-start gap-3 p-4 rounded-2xl bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center shrink-0">
              <Printer className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm text-stone-100 block">
                Imprimir / PDF
              </span>
              <p className="text-[11px] text-stone-400 mt-1">
                {isPro
                  ? "Edición limpia lista para imprimir o guardar en PDF."
                  : "Vista previa gratuita con marca de agua discreta."}
              </p>
            </div>
          </button>

          {/* TXT */}
          <button
            type="button"
            onClick={handleDownloadTxt}
            className="flex items-start gap-3 p-4 rounded-2xl bg-stone-950/70 hover:bg-stone-800 border border-stone-800 hover:border-amber-500/40 transition text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-stone-800 text-stone-200 flex items-center justify-center shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="font-bold text-sm text-stone-100 block">
                Texto Plano (.TXT)
              </span>
              <p className="text-[11px] text-stone-400 mt-1">
                Respaldo universal ligero con todos los capítulos ordenados.
              </p>
            </div>
          </button>
        </div>

        {/* Copy to clipboard bar */}
        <div className="p-4 rounded-2xl bg-stone-950 border border-stone-800 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs min-w-0">
            <span className="font-semibold text-stone-200 block">
              Copiar manuscrito al portapapeles
            </span>
            <span className="text-stone-400 tabular-nums">
              {currentBook.chapters.length} capítulos ·{" "}
              {totalWords.toLocaleString()} palabras
            </span>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs flex items-center gap-1.5 transition border border-stone-700 shrink-0"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">¡Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-amber-400" />
                <span>Copiar texto</span>
              </>
            )}
          </button>
        </div>

        {/* Print Preview Hidden Container */}
        <div className="hidden print:block font-book text-black">
          {!isPro && (
            <p className="text-center text-xs text-gray-500 uppercase tracking-widest mb-4 border-b pb-2">
              Vista previa gratuita — Voz a Libro
            </p>
          )}
          <h1 className="text-3xl font-bold text-center mb-2">
            {currentBook.title}
          </h1>
          {currentBook.subtitle && (
            <h2 className="text-xl text-center text-gray-700 mb-4">
              {currentBook.subtitle}
            </h2>
          )}
          {currentBook.author && (
            <p className="text-center italic mb-12">Por: {currentBook.author}</p>
          )}

          {currentBook.chapters.map((ch, idx) => (
            <div key={ch.id} className="print-page mt-8">
              <h3 className="text-2xl font-bold mb-4 border-b pb-2">
                {ch.title || `Capítulo ${idx + 1}`}
              </h3>
              {ch.content.split("\n\n").map((p, pIdx) => (
                <p key={pIdx} className="mb-4 text-left indent-8 text-base">
                  {p}
                </p>
              ))}
              {!isPro && (
                <p className="mt-8 text-[10px] text-gray-400 text-right">
                  Generado con Voz a Libro (Edición Gratuita)
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
