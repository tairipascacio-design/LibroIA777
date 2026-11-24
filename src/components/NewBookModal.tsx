import React, { useState } from "react";
import { X, BookPlus, Sparkles } from "lucide-react";
import { Book, BookGenre, BookTone } from "../types";

interface NewBookModalProps {
  onClose: () => void;
  onCreateBook: (book: Book) => void;
}

const GENRES: BookGenre[] = [
  "Novela de Ficción",
  "Autobiografía / Memorias",
  "Misterio y Suspenso",
  "Desarrollo Personal / Ensayo",
  "Fantasía / Ciencia Ficción",
  "Crónica / Periodismo",
  "Cuentos y Relatos",
  "Poesía y Prosa Poética",
];

const FORMAT_STYLES: BookTone[] = [
  "Fiel a mis palabras (solo puntuación y orden)",
  "Diálogos con raya literaria (—)",
  "Orden cronológico estricto",
  "Corrección ortográfica ligera",
];

export const NewBookModal: React.FC<NewBookModalProps> = ({
  onClose,
  onCreateBook,
}) => {
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [author, setAuthor] = useState("");
  const [genre, setGenre] = useState<BookGenre>("Novela de Ficción");
  const [tone, setTone] = useState<BookTone>(
    "Fiel a mis palabras (solo puntuación y orden)"
  );
  const [synopsis, setSynopsis] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const now = new Date().toISOString();
    const newBook: Book = {
      id: `book-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || undefined,
      author: author.trim(),
      genre,
      tone,
      synopsis:
        synopsis.trim() ||
        `Obra dictada por voz en género ${genre}, conservando fielmente las palabras del autor.`,
      isDemo: false,
      createdAt: now,
      updatedAt: now,
      chapters: [
        {
          id: `ch-1-${Date.now()}`,
          order: 1,
          title: "Capítulo I: El Comienzo",
          summary: "Inicio del libro y primeros dictados.",
          content: "",
          createdAt: now,
          updatedAt: now,
        },
      ],
      characters: [],
      timeline: [],
      dictationHistory: [],
    };

    onCreateBook(newBook);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-stone-800 rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-5 shadow-2xl relative text-stone-200 my-6">
        <div className="flex items-center justify-between pb-3 border-b border-stone-800">
          <div className="flex items-center gap-2 min-w-0">
            <BookPlus className="w-5 h-5 text-amber-400 shrink-0" />
            <h2 className="text-lg font-bold font-display-book text-stone-100 truncate">
              Crear Nuevo Libro
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="font-semibold text-stone-300 block mb-1">
              Título del libro *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Las Raíces del Viento, Memorias de Mi Vida..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2.5 text-sm text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-300 block mb-1">
                Subtítulo (opcional)
              </label>
              <input
                type="text"
                placeholder="Ej: Una historia real..."
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="font-semibold text-stone-300 block mb-1">
                Nombre del Autor(a)
              </label>
              <input
                type="text"
                placeholder="Tu nombre o seudónimo"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3.5 py-2 text-xs text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-stone-300 block mb-1">
                Género literario
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value as BookGenre)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              >
                {GENRES.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="font-semibold text-stone-300 block mb-1">
                Estilo de formato
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value as BookTone)}
                className="w-full bg-stone-950 border border-stone-800 rounded-xl px-3 py-2 text-xs text-stone-200 focus:outline-none focus:border-amber-500"
              >
                {FORMAT_STYLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold text-stone-300 block mb-1">
              Sinopsis o idea general (opcional)
            </label>
            <textarea
              rows={3}
              placeholder="¿De qué tratará tu libro?"
              value={synopsis}
              onChange={(e) => setSynopsis(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 rounded-xl p-3 text-xs text-stone-200 placeholder-stone-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-stone-400 hover:text-white hover:bg-stone-800 transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim()}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 hover:from-amber-300 hover:via-rose-400 hover:to-violet-400 text-stone-950 font-black transition shadow-lg shadow-rose-500/20 disabled:opacity-40 flex items-center gap-1.5"
            >
              <Sparkles className="w-4 h-4" />
              <span>Comenzar Libro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
