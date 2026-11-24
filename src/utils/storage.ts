import { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../firebase";
import { Book } from "../types";

const STORAGE_KEY_BOOKS = "voz_a_libro_books_v1";
const STORAGE_KEY_CURRENT_ID = "voz_a_libro_active_id_v1";

export const DEFAULT_SAMPLE_BOOK: Book = {
  id: "demo-relojero-v1",
  title: "El Secreto del Viejo Relojero",
  subtitle: "Libro de muestra (solo lectura)",
  author: "Edición de Demostración",
  genre: "Misterio y Suspenso",
  tone: "Fiel a mis palabras (solo puntuación y orden)",
  synopsis:
    "En una pequeña villa enclavada en las montañas, un relojero guarda en sus máquinas mecanismos que miden los recuerdos olvidados de quienes las habitan.",
  isDemo: true,
  createdAt: "2025-01-01T12:00:00.000Z",
  updatedAt: "2025-01-01T12:00:00.000Z",
  chapters: [
    {
      id: "ch-demo-1",
      order: 1,
      title: "Capítulo I: El Taller de las Horas Muertas",
      summary: "Introducción al taller entre péndulos y engranajes de bronce.",
      content: `El polvo danzaba en los haces de luz dorada que atravesaban los ventanales del viejo taller. En aquel rincón olvidado del mundo, el tiempo no transcurría como en el resto de la villa; allí, cada segundo quedaba atrapado en el tintineo metálico de trescientos relojes que latían al unísono, como corazones mecánicos en un pecho de madera y latón.

Don Valerio jamás miraba las agujas de las paredes para saber la hora. Le bastaba escuchar el rumor sordo del péndulo de pie que custodiaba la entrada. Sin embargo, aquella tarde de noviembre, una anomalía quebró la cadencia: el gran reloj astronómico de la chimenea se detuvo exactamente a las cinco y diecisiete minutos.

—No puede ser —susurró el anciano, ajustándose las lupas de relojero sobre los ojos cansados—. Ese engranaje fue forjado para no detenerse jamás, a menos que alguien haya tocado la cuerda equivocada.`,
      createdAt: "2025-01-01T12:00:00.000Z",
      updatedAt: "2025-01-01T12:00:00.000Z",
    },
    {
      id: "ch-demo-2",
      order: 2,
      title: "Capítulo II: La Llave de Madera de Olivo",
      summary: "Aparición de la carta escondida y el misterio de la llave.",
      content: `Bajo el suelo entarimado, en un compartimento que solo cedía tras presionar tres clavos alineados, reposaba una caja de olivo pulido. Durante más de cuarenta años, Valerio se había negado a rozar su cerradura. Creía, con la superstición propia de los hombres que viven entre autómatas, que abrirla desencadenaría una marea de memorias imposibles de contener.

La carta que acompañaba a la llave estaba escrita con una caligrafía temblorosa, casi infantil. «Si has llegado a leer esto», decía la primera línea, «es porque las campanas de San Jerónimo han dejado de sonar y el río ha vuelto a cambiar su cauce».

Afuera, la bruma comenzaba a devorar las colinas, y los pasos apresurados de un forastero resonaron sobre el empedrado húmedo de la calle Mayor.`,
      createdAt: "2025-01-01T12:00:00.000Z",
      updatedAt: "2025-01-01T12:00:00.000Z",
    },
  ],
  characters: [
    {
      id: "char-demo-1",
      name: "Don Valerio",
      role: "Protagonista / Maestro Relojero",
      description:
        "Anciano sabio, meticuloso, guardián del tiempo y de secretos antiguos de la villa.",
    },
    {
      id: "char-demo-2",
      name: "El Forastero del Río",
      role: "Mensajero misterioso",
      description:
        "Hombre cubierto con un abrigo oscuro que llega a la villa tras detenerse el reloj astronómico.",
    },
  ],
  timeline: [
    {
      id: "tl-demo-1",
      timeContext: "Cuarenta años antes",
      event: "Se forja el gran reloj astronómico y se oculta la caja de olivo.",
      chapterId: "ch-demo-2",
    },
    {
      id: "tl-demo-2",
      timeContext: "Noviembre, 5:17 PM",
      event: "El reloj astronómico se detiene misteriosamente en el taller.",
      chapterId: "ch-demo-1",
    },
  ],
  dictationHistory: [
    {
      id: "log-demo-1",
      timestamp: "2025-01-01T12:00:00.000Z",
      rawText:
        "Fíjate que al final descubrieron la carta secreta, pero espera, antes de eso el reloj se detuvo a las cinco y diecisiete...",
      mode: "Acomodo Cronológico",
      explanation:
        "Se mantuvieron las palabras exactas: el reloj detenido se ubicó en el Capítulo I y el hallazgo de la carta en el Capítulo II.",
      placementsCount: 2,
    },
  ],
};

function sanitizeBook(rawBook: Book): Book {
  const cleanedCharacters = (rawBook.characters || []).filter(
    (c) => c?.name?.trim() && c.name.trim().toLowerCase() !== "w"
  );
  const isLegacySample = rawBook.id === "sample-book-1";
  return {
    ...rawBook,
    isDemo: rawBook.isDemo ?? isLegacySample,
    author:
      isLegacySample && rawBook.author === "Tairí Pascacio"
        ? "Edición de Demostración"
        : rawBook.author || "",
    characters: cleanedCharacters,
  };
}

export function loadBooksFromStorage(): Book[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_BOOKS);
    if (!raw) {
      saveBooksToStorage([DEFAULT_SAMPLE_BOOK]);
      return [DEFAULT_SAMPLE_BOOK];
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const cleaned = parsed.map(sanitizeBook);
      return cleaned;
    }
    return [DEFAULT_SAMPLE_BOOK];
  } catch (e) {
    console.error("Error reading books from localStorage:", e);
    return [DEFAULT_SAMPLE_BOOK];
  }
}

export function saveBooksToStorage(books: Book[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_BOOKS, JSON.stringify(books));
  } catch (e) {
    console.error("Error saving books to localStorage:", e);
  }
}

export function loadActiveBookId(): string {
  try {
    return localStorage.getItem(STORAGE_KEY_CURRENT_ID) || DEFAULT_SAMPLE_BOOK.id;
  } catch {
    return DEFAULT_SAMPLE_BOOK.id;
  }
}

export function saveActiveBookId(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY_CURRENT_ID, id);
  } catch (e) {
    console.error("Error saving active book ID:", e);
  }
}

function safeFirestoreId(id: string): string {
  const clean = id.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 128);
  return clean || `book-${Date.now()}`;
}

function toIso(val: unknown, fallback: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === "string" && val.length > 0) return val;
  return fallback;
}

function buildBookCloudPayload(userId: string, book: Book) {
  const safeId = safeFirestoreId(book.id);
  const basePayload: Record<string, any> = {
    id: safeId,
    ownerId: userId,
    title: (book.title || "Libro sin título").slice(0, 200),
    author: (book.author || "").slice(0, 120),
    genre: (book.genre || "Novela de Ficción").slice(0, 80),
    tone: (book.tone || "Fiel a mis palabras (solo puntuación y orden)").slice(0, 100),
    synopsis: (book.synopsis || "").slice(0, 2000),
    chapters: (book.chapters || []).slice(0, 100),
    characters: (book.characters || []).slice(0, 100),
    timeline: (book.timeline || []).slice(0, 200),
    dictationHistory: (book.dictationHistory || []).slice(0, 200),
  };
  if (book.subtitle && book.subtitle.trim()) {
    basePayload.subtitle = book.subtitle.trim().slice(0, 200);
  }
  if (typeof book.isDemo === "boolean") {
    basePayload.isDemo = book.isDemo;
  }
  return { safeId, basePayload };
}

export async function ensureUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  try {
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: (user.email || "").slice(0, 320),
        displayName: (user.displayName || "").slice(0, 120),
        photoURL: (user.photoURL || "").slice(0, 500),
        plan: "free",
        aiOrganizeCount: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(userRef, {
        displayName: (user.displayName || "").slice(0, 120),
        photoURL: (user.photoURL || "").slice(0, 500),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export function subscribeUserBooks(
  userId: string,
  onBooks: (books: Book[]) => void
): () => void {
  const collectionPath = `users/${userId}/books`;
  const q = query(
    collection(db, "users", userId, "books"),
    where("ownerId", "==", userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const cloudBooks: Book[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        const now = new Date().toISOString();
        return sanitizeBook({
          id: data.id || d.id,
          title: data.title || "Libro sin título",
          subtitle: data.subtitle,
          author: data.author || "",
          genre: data.genre || "Novela de Ficción",
          tone: data.tone || "Fiel a mis palabras (solo puntuación y orden)",
          synopsis: data.synopsis || "",
          chapters: Array.isArray(data.chapters) ? data.chapters : [],
          characters: Array.isArray(data.characters) ? data.characters : [],
          timeline: Array.isArray(data.timeline) ? data.timeline : [],
          dictationHistory: Array.isArray(data.dictationHistory)
            ? data.dictationHistory
            : [],
          isDemo: Boolean(data.isDemo),
          createdAt: toIso(data.createdAt, now),
          updatedAt: toIso(data.updatedAt, now),
        });
      });

      // Keep personal books sorted by most recently updated, demo book last
      cloudBooks.sort((a, b) => {
        if (Boolean(a.isDemo) !== Boolean(b.isDemo)) {
          return a.isDemo ? 1 : -1;
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });

      onBooks(cloudBooks);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, collectionPath);
    }
  );
}

export async function saveBookToCloud(
  userId: string,
  book: Book
): Promise<void> {
  if (book.isDemo) return; // Demo book stays local read-only
  const { safeId, basePayload } = buildBookCloudPayload(userId, book);
  const path = `users/${userId}/books/${safeId}`;

  try {
    const ref = doc(db, "users", userId, "books", safeId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      await setDoc(ref, {
        ...basePayload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      const updatePayload: Record<string, any> = {
        title: basePayload.title,
        author: basePayload.author,
        genre: basePayload.genre,
        tone: basePayload.tone,
        synopsis: basePayload.synopsis,
        chapters: basePayload.chapters,
        characters: basePayload.characters,
        timeline: basePayload.timeline,
        dictationHistory: basePayload.dictationHistory,
        updatedAt: serverTimestamp(),
      };
      if (basePayload.subtitle !== undefined) {
        updatePayload.subtitle = basePayload.subtitle;
      }
      if (basePayload.isDemo !== undefined) {
        updatePayload.isDemo = basePayload.isDemo;
      }
      await updateDoc(ref, updatePayload);
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteBookFromCloud(
  userId: string,
  bookId: string
): Promise<void> {
  const safeId = safeFirestoreId(bookId);
  const path = `users/${userId}/books/${safeId}`;
  try {
    await deleteDoc(doc(db, "users", userId, "books", safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}
