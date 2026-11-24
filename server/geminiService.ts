import { GoogleGenAI, Type } from "@google/genai";

// Ensure process.env.GEMINI_API_KEY is available
const apiKey = process.env.GEMINI_API_KEY || "";

export const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

export interface BookChapter {
  id: string;
  order: number;
  title: string;
  summary?: string;
  content: string;
}

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
}

export interface TimelineEvent {
  id: string;
  timeContext: string;
  event: string;
  chapterId?: string;
}

export interface BookContext {
  id: string;
  title: string;
  subtitle?: string;
  author: string;
  genre: string;
  tone: string;
  synopsis?: string;
  chapters: BookChapter[];
  characters: Character[];
  timeline: TimelineEvent[];
}

export interface PlacementResult {
  action: "append" | "insert" | "create_chapter" | "update_chapter";
  targetChapterId?: string;
  newChapterTitle?: string;
  newChapterOrder?: number;
  polishedText: string;
  placementExplanation: string;
  chronologicalContext: string;
}

export interface OrganizeDictationResponse {
  analysisSummary: string;
  placements: PlacementResult[];
  newCharacters?: Array<{ name: string; role: string; description: string }>;
  newTimelineEvents?: Array<{ timeContext: string; event: string }>;
  suggestedTitle?: string;
  suggestedSynopsis?: string;
}

function isRetryableModelError(err: any): boolean {
  const msg = String(err?.message || err || "");
  return (
    err?.status === 429 ||
    err?.status === 503 ||
    err?.status === 500 ||
    err?.status === 404 ||
    msg.includes("429") ||
    msg.includes("503") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.toLowerCase().includes("quota")
  );
}

const FREE_TIER_MODELS = ["gemini-3.1-flash-lite", "gemini-4-hydrogen"] as const;

async function generateWithFreeFallback(
  contents: string,
  config: Record<string, any>
) {
  let lastErr: any;
  for (const model of FREE_TIER_MODELS) {
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config,
      });
    } catch (err: any) {
      lastErr = err;
      if (!isRetryableModelError(err)) {
        throw err;
      }
      console.warn(`Model ${model} unavailable/limited, trying fallback...`, err?.status || err?.message);
    }
  }
  throw lastErr;
}

function formatGeminiError(err: any): Error & { statusCode?: number } {
  const msg = String(err?.message || err || "");
  if (
    err?.status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota")
  ) {
    const e: Error & { statusCode?: number } = new Error(
      "Se alcanzó temporalmente el límite gratuito de solicitudes por minuto/día de Gemini. Espera un momento e intenta de nuevo."
    );
    e.statusCode = 429;
    return e;
  }
  if (err?.status === 503 || msg.includes("503") || msg.includes("UNAVAILABLE")) {
    const e: Error & { statusCode?: number } = new Error(
      "Los servidores de Gemini están saturados en este instante. Intenta de nuevo en unos segundos."
    );
    e.statusCode = 503;
    return e;
  }
  if (msg.includes("API_KEY_INVALID") || msg.includes("PERMISSION_DENIED") || err?.status === 403) {
    const e: Error & { statusCode?: number } = new Error(
      "La clave de Gemini API no es válida o no tiene permisos. Revísala en Settings > Secrets."
    );
    e.statusCode = 403;
    return e;
  }
  return new Error(msg || "Error al comunicarse con Gemini.");
}

export async function organizeDictationWithGemini(
  rawDictation: string,
  book: BookContext,
  mode: string = "auto_chronology",
  currentChapterId?: string
): Promise<OrganizeDictationResponse> {
  if (!rawDictation.trim()) {
    throw new Error("El dictado está vacío.");
  }

  const existingChaptersBrief = book.chapters.map((ch, idx) => ({
    id: ch.id,
    order: ch.order || idx + 1,
    title: ch.title,
    summary: ch.summary || ch.content.slice(0, 180) + "...",
    previewEnd: ch.content.slice(-250),
  }));

  const systemInstruction = `Eres un organizador y compilador literario de alta precisión para un autor que dicta su libro por voz.

REGLA DE ORO DEL AUTOR (MÁXIMA PRIORIDAD):
¡NO REESCRIBAS NI CAMBIES LAS PALABRAS DEL AUTOR!
El autor ha indicado expresamente: "No quiero que reescriba lo que yo dicto, simplemente que lo acomode conforme va".
- Debes respetar y mantener SUS PALABRAS EXACTAS, su voz natural, sus frases y su forma de expresarse.
- NO inventes adjetivos, metáforas ni sustituyas su vocabulario por lenguaje ficticio o rimbombante.
- Lo único que debes hacer a nivel de texto es colocar la puntuación básica (puntos, comas, mayúsculas y saltos de párrafo legibles) y ordenar las oraciones para que se lean de forma natural.

TU LABOR PRINCIPAL ES EL ACOMODO Y LA ESTRUCTURA:
1. Comprender la secuencia de los hechos: Si el autor dictó ideas desordenadas o "al revés" (por ejemplo, contó primero lo que pasó al final y luego lo que pasó antes), debes DESENREDAR la cronología y ACOMODAR los fragmentos en el orden temporal y narrativo correcto.
2. Ubicar cada fragmento en el libro:
   - Si pertenece a un capítulo ya existente (por ejemplo, un recuerdo que va en el capítulo 1 o una escena que continúa el capítulo 2), colócalo en 'targetChapterId' con la acción 'append' (si continúa) o 'insert' (si cronológicamente va antes de lo que ya estaba escrito).
   - Si amerita un nuevo capítulo (porque es una nueva etapa, un nuevo día o un nuevo tema), usa 'create_chapter' con un título representativo.
3. 'polishedText' DEBE SER EL TEXTO DEL AUTOR CON SUS MISMAS PALABRAS, debidamente ordenado y estructurado.
4. Explica con claridad y simpatía en 'analysisSummary' cómo ordenaste y acomodaste sus palabras ("Noté que mencionaste primero X y luego Y; he colocado primero Y porque ocurrió antes y lo ubiqué en el Capítulo...").
5. Extrae los personajes y hechos clave que el autor mencionó.`;

  const prompt = JSON.stringify({
    dictationToProcess: rawDictation,
    selectedMode: mode,
    focusedChapterId: currentChapterId,
    currentBook: {
      title: book.title,
      genre: book.genre,
      tone: book.tone,
      synopsis: book.synopsis,
      knownCharacters: book.characters,
      existingChapters: existingChaptersBrief,
      knownTimeline: book.timeline,
    },
    instruction:
      "Acomoda las oraciones y párrafos del autor en el orden cronológico y lógico correcto sin cambiar sus palabras.",
  });

  const config = {
    systemInstruction: systemInstruction,
    responseMimeType: "application/json",
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        analysisSummary: {
          type: Type.STRING,
          description:
            "Explicación cálida y clara al autor de cómo se interpretó su dictado, cómo se acomodó cronológicamente y qué decisiones literarias se tomaron.",
        },
        suggestedTitle: {
          type: Type.STRING,
          description: "Título del libro sugerido o refinado si aplica.",
        },
        suggestedSynopsis: {
          type: Type.STRING,
          description: "Sinopsis actualizada del libro basada en los nuevos hechos.",
        },
        placements: {
          type: Type.ARRAY,
          description: "Lista de ubicaciones donde se acomoda el texto pulido.",
          items: {
            type: Type.OBJECT,
            properties: {
              action: {
                type: Type.STRING,
                description:
                  "create_chapter (nuevo capítulo), append (al final del capítulo), insert (insertar cronológicamente al inicio o en el cuerpo), o update_chapter",
              },
              targetChapterId: {
                type: Type.STRING,
                description: "ID del capítulo existente donde encaja, o vacío si es create_chapter",
              },
              newChapterTitle: {
                type: Type.STRING,
                description: "Título del nuevo capítulo si action es create_chapter",
              },
              newChapterOrder: {
                type: Type.INTEGER,
                description: "Posición numérica del nuevo capítulo en el índice general",
              },
              polishedText: {
                type: Type.STRING,
                description:
                  "Texto final con las mismas palabras del autor debidamente puntuado y ordenado.",
              },
              placementExplanation: {
                type: Type.STRING,
                description:
                  "Justificación de por qué este fragmento va aquí cronológica o dramáticamente.",
              },
              chronologicalContext: {
                type: Type.STRING,
                description: "Ubicación temporal de la escena (ej: '5 años antes del viaje', 'La noche anterior', 'Desenlace').",
              },
            },
            required: [
              "action",
              "polishedText",
              "placementExplanation",
              "chronologicalContext",
            ],
          },
        },
        newCharacters: {
          type: Type.ARRAY,
          description: "Nuevos personajes detectados en el dictado.",
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              role: { type: Type.STRING },
              description: { type: Type.STRING },
            },
            required: ["name", "role", "description"],
          },
        },
        newTimelineEvents: {
          type: Type.ARRAY,
          description: "Hitos cronológicos detectados para mantener coherencia temporal.",
          items: {
            type: Type.OBJECT,
            properties: {
              timeContext: { type: Type.STRING },
              event: { type: Type.STRING },
            },
            required: ["timeContext", "event"],
          },
        },
      },
      required: ["analysisSummary", "placements"],
    },
  };

  let response;
  try {
    response = await generateWithFreeFallback(prompt, config);
  } catch (err: any) {
    throw formatGeminiError(err);
  }

  const text = response.text || "{}";
  try {
    return JSON.parse(text) as OrganizeDictationResponse;
  } catch (err) {
    console.error("Error parsing Gemini response:", text, err);
    throw new Error("No se pudo procesar la respuesta del modelo.");
  }
}

export async function refineChapterWithGemini(
  content: string,
  bookGenre: string,
  instruction: string
): Promise<string> {
  const contents = `Capítulo original:\n${content}\n\nInstrucción de refinamiento:\n${instruction}\n\nGénero del libro: ${bookGenre}`;
  const config = {
    systemInstruction:
      "Eres un corrector de estilo y editor literario de prestigio. Ajusta el capítulo según la instrucción, devolviendo únicamente el texto del capítulo sin metatexto ni comentarios.",
  };

  try {
    const response = await generateWithFreeFallback(contents, config);
    return response.text || content;
  } catch (err: any) {
    throw formatGeminiError(err);
  }
}

export const DEFAULT_CONTINUATION_PROMPTS = [
  "¿Qué detalle de aquel lugar o momento recuerdas con más claridad?",
  "¿Qué pasó justo antes o inmediatamente después de esa escena?",
  "¿Quién más estaba ahí y qué dijo o hizo en ese instante?",
  "¿Cómo te sentiste o qué pensamiento se te cruzó por la cabeza?",
];

export async function generateContinuationPrompts(
  book: BookContext,
  currentChapterId?: string
): Promise<string[]> {
  const currentChapter = book.chapters.find((c) => c.id === currentChapterId) || book.chapters[0];
  const lastExcerpt = currentChapter?.content?.slice(-600) || book.synopsis || "";

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite",
      contents: `Libro: "${book.title}" (${book.genre})\nÚltimo fragmento escrito:\n"${lastExcerpt}"`,
      config: {
        systemInstruction:
          "Eres un editor que entrevista al autor para ayudarlo a seguir dictando su libro. Devuelve un arreglo JSON con exactamente 4 preguntas disparadoras inspiradoras, intrigantes o detalles sensoriales que el autor pueda responder con su voz para el siguiente fragmento.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    });

    const parsed = JSON.parse(response.text || "[]");
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    return DEFAULT_CONTINUATION_PROMPTS;
  } catch (err: any) {
    console.warn("Using default continuation prompts (Gemini unavailable/quota):", err?.status || err?.message);
    return DEFAULT_CONTINUATION_PROMPTS;
  }
}

