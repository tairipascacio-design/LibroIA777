import React from "react";
import {
  Plus,
  Settings,
  Download,
  Crown,
  ChevronDown,
  Lock,
} from "lucide-react";
import { BillingStatus, Book } from "../types";

interface HeaderProps {
  currentBook: Book;
  allBooks: Book[];
  onSelectBook: (bookId: string) => void;
  onNewBook: () => void;
  onOpenSettings: () => void;
  onOpenExport: () => void;
  onOpenPaywall: () => void;
  billingStatus: BillingStatus | null;
  totalWords: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentBook,
  allBooks,
  onSelectBook,
  onNewBook,
  onOpenSettings,
  onOpenExport,
  onOpenPaywall,
  billingStatus,
  totalWords,
}) => {
  const isPro = Boolean(billingStatus?.isPro);

  return (
    <header className="sticky top-0 z-30 h-14 bg-stone-950/90 backdrop-blur-md text-stone-100 border-b border-white/10 no-print">
      <div className="max-w-5xl mx-auto h-full px-3 sm:px-5 flex items-center justify-between gap-2">
        {/* Left: Compact Book Selector + New Book Button */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="relative min-w-0 max-w-[230px] sm:max-w-xs flex-1">
            <select
              aria-label="Seleccionar libro actual"
              value={currentBook.id}
              onChange={(e) => onSelectBook(e.target.value)}
              className="w-full appearance-none bg-stone-900 hover:bg-stone-800 text-stone-100 text-sm font-semibold rounded-xl pl-3 pr-8 py-2 border border-white/10 focus:outline-none focus:ring-2 focus:ring-amber-400/60 cursor-pointer truncate"
            >
              {allBooks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title || "Sin título"}
                  {b.isDemo ? " (Muestra)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown className="w-4 h-4 text-stone-400 pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2" />
          </div>

          <button
            type="button"
            onClick={onNewBook}
            title="Crear nuevo libro"
            aria-label="Crear nuevo libro"
            className="w-10 h-10 shrink-0 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 border border-white/10 flex items-center justify-center transition"
          >
            <Plus className="w-4 h-4" />
          </button>

          <span className="hidden md:inline-block text-xs text-stone-400 font-mono tabular-nums pl-2 whitespace-nowrap">
            {currentBook.chapters.length} cap · {totalWords.toLocaleString()} pal
          </span>
        </div>

        {/* Right: Plan Pill/CTA, Export, Settings */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isPro ? (
            <button
              type="button"
              onClick={onOpenSettings}
              className="h-10 px-2.5 sm:px-3 rounded-xl bg-amber-400/15 border border-amber-400/40 text-amber-300 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap hover:bg-amber-400/25 transition"
              title="Plan Pro activo"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>Pro</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenPaywall}
              className="h-10 px-2.5 sm:px-3 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-stone-950 text-xs font-extrabold flex items-center gap-1.5 whitespace-nowrap shadow-sm transition"
            >
              <Lock className="w-3.5 h-3.5 shrink-0" />
              <span>Pasar a Pro</span>
            </button>
          )}

          <button
            type="button"
            onClick={onOpenExport}
            title="Exportar libro (PDF, ePub, Word)"
            aria-label="Exportar libro"
            className="h-10 px-2.5 sm:px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-white/10 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition"
          >
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="hidden sm:inline">Exportar</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            title="Ajustes, temas, cuenta y APK"
            aria-label="Abrir ajustes"
            className="w-10 h-10 rounded-xl bg-stone-900 hover:bg-stone-800 text-stone-200 border border-white/10 flex items-center justify-center transition"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
