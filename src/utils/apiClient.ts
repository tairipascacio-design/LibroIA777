import { auth } from "../firebase";
import { BillingStatus, Book, OrganizeResult } from "../types";

const REMOTE_SERVER_FALLBACK =
  "https://ais-pre-saeixb2esdxng552naqiv6-509571624736.us-west2.run.app";

const SESSION_KEY = "voz_a_libro_session_v1";

export class PaywallError extends Error {
  billingStatus?: BillingStatus;
  constructor(message: string, billingStatus?: BillingStatus) {
    super(message);
    this.name = "PaywallError";
    this.billingStatus = billingStatus;
  }
}

export function getClientSessionId(): string {
  if (typeof window === "undefined") return "server-session";
  try {
    let existing = localStorage.getItem(SESSION_KEY);
    if (!existing) {
      existing = `ses-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
      localStorage.setItem(SESSION_KEY, existing);
    }
    return existing;
  } catch {
    return "local-session";
  }
}

export async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-client-session-id": getClientSessionId(),
  };
  try {
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    }
  } catch {
    // fallback to anonymous session header
  }
  return headers;
}

export function isRunningInsideApk(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.location.hostname === "appassets.androidplatform.net" ||
    !!(window as any).AndroidBridge?.isNativeAndroid?.()
  );
}

export function getApiBaseUrl(): string {
  if (isRunningInsideApk()) {
    return localStorage.getItem("voz_a_libro_api_url") || REMOTE_SERVER_FALLBACK;
  }
  return "";
}

function organizeDictationLocally(
  rawDictation: string,
  book: Book,
  mode: string,
  currentChapterId?: string
): OrganizeResult {
  const clean = rawDictation.trim();
  const sentences = clean
    .split(/(?<=[.!?])\s+|(?:\s*,\s*pero\s+antes\s+|\s*,\s*aunque\s+antes\s+)/i)
    .map((s) => s.trim())
    .filter(Boolean);

  const pastMarkers =
    /\b(antes|niñ[oa]|infancia|hace años|primero|al principio|en aquel entonces|tiempo atrás|dos horas antes|ayer)\b/i;
  const futureMarkers =
    /\b(al final|después|luego|finalmente|entonces|terminó|descubrieron|al cabo)\b/i;

  const earlierParts: string[] = [];
  const middleParts: string[] = [];
  const laterParts: string[] = [];

  for (const s of sentences) {
    if (pastMarkers.test(s)) {
      earlierParts.push(s.charAt(0).toUpperCase() + s.slice(1));
    } else if (futureMarkers.test(s)) {
      laterParts.push(s.charAt(0).toUpperCase() + s.slice(1));
    } else {
      middleParts.push(s.charAt(0).toUpperCase() + s.slice(1));
    }
  }

  const orderedText = [...earlierParts, ...middleParts, ...laterParts]
    .map((s) => (/[.!?]$/.test(s) ? s : `${s}.`))
    .join(" ");

  const targetChapter =
    book.chapters.find((c) => c.id === currentChapterId) || book.chapters[0];

  if (mode === "create_chapter" || !targetChapter) {
    const nextOrder = book.chapters.length + 1;
    return {
      analysisSummary:
        "Acomodado en modo local manteniendo tus palabras exactas en orden cronológico.",
      placements: [
        {
          action: "create_chapter",
          newChapterTitle: `Capítulo ${nextOrder}: Nueva Escena`,
          newChapterOrder: nextOrder,
          polishedText: orderedText,
          placementExplanation:
            "Se creó un nuevo capítulo con tus palabras exactas ordenadas cronológicamente.",
          chronologicalContext: "Nueva etapa del relato",
        },
      ],
    };
  }

  const shouldInsertBefore = earlierParts.length > 0 && laterParts.length === 0;

  return {
    analysisSummary:
      earlierParts.length > 0 && laterParts.length > 0
        ? "Detecté hechos anteriores mezclados con hechos posteriores y los ordené cronológicamente manteniendo tus palabras exactas."
        : "Tus palabras exactas se acomodaron con puntuación clara en el capítulo correspondiente.",
    placements: [
      {
        action: shouldInsertBefore ? "insert" : "append",
        targetChapterId: targetChapter.id,
        polishedText: orderedText,
        placementExplanation: shouldInsertBefore
          ? `Se ubicó antes en "${targetChapter.title}" por referencia a un momento anterior.`
          : `Se añadió a "${targetChapter.title}" respetando tus palabras exactas.`,
        chronologicalContext: shouldInsertBefore ? "Evento previo" : "Continuación",
      },
    ],
  };
}

export async function organizeDictationRequest(
  rawDictation: string,
  book: Book,
  mode: string,
  currentChapterId?: string
): Promise<OrganizeResult> {
  const base = getApiBaseUrl();
  const headers = await buildAuthHeaders();
  try {
    const response = await fetch(`${base}/api/organize-dictation`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        dictation: rawDictation,
        book,
        mode,
        currentChapterId,
      }),
    });

    const contentType = response.headers.get("content-type") || "";
    const payload = contentType.includes("application/json")
      ? await response.json()
      : null;

    if (response.status === 402 || payload?.code === "PAYWALL_REQUIRED") {
      throw new PaywallError(
        payload?.error ||
          "Alcanzaste los 3 usos gratuitos de acomodo inteligente. Pasa a Pro para uso ilimitado.",
        payload?.billingStatus
      );
    }

    if (!response.ok || !payload) {
      if (isRunningInsideApk()) {
        return organizeDictationLocally(rawDictation, book, mode, currentChapterId);
      }
      throw new Error(payload?.error || "Error al acomodar el dictado");
    }

    return payload as OrganizeResult;
  } catch (err: any) {
    if (err instanceof PaywallError) {
      throw err;
    }
    if (isRunningInsideApk()) {
      return organizeDictationLocally(rawDictation, book, mode, currentChapterId);
    }
    throw err;
  }
}

export async function refineChapterRequest(
  content: string,
  bookGenre: string,
  instruction: string
): Promise<{ refinedText: string; billingStatus?: BillingStatus }> {
  const base = getApiBaseUrl();
  const headers = await buildAuthHeaders();
  const res = await fetch(`${base}/api/refine-chapter`, {
    method: "POST",
    headers,
    body: JSON.stringify({ content, bookGenre, instruction }),
  });

  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : null;

  if (res.status === 402 || data?.code === "PAYWALL_REQUIRED") {
    throw new PaywallError(
      data?.error ||
        "Alcanzaste los 3 usos gratuitos de IA. Pasa a Plan Pro para continuar.",
      data?.billingStatus
    );
  }

  if (!res.ok || !data) {
    throw new Error(
      data?.error || "No se pudo conectar con el servidor en este momento."
    );
  }

  return data;
}

export async function fetchBillingStatus(): Promise<BillingStatus> {
  const base = getApiBaseUrl();
  const headers = await buildAuthHeaders();
  const res = await fetch(`${base}/api/billing/status`, {
    method: "GET",
    headers,
  });
  if (!res.ok) {
    throw new Error("No se pudo consultar el plan actual");
  }
  return res.json();
}

export async function createCheckoutSession(
  cycle: "monthly" | "annual"
): Promise<{
  configured: boolean;
  provider: "stripe" | "lemonsqueezy" | "demo";
  url?: string;
  message?: string;
}> {
  const base = getApiBaseUrl();
  const headers = await buildAuthHeaders();
  const res = await fetch(`${base}/api/billing/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({ cycle }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Error iniciando el proceso de pago");
  }
  return data;
}

export async function requestBillingPortal(): Promise<{
  configured: boolean;
  url?: string;
  message?: string;
}> {
  const base = getApiBaseUrl();
  const headers = await buildAuthHeaders();
  const res = await fetch(`${base}/api/billing/portal`, {
    method: "POST",
    headers,
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "Error abriendo portal de suscripción");
  }
  return data;
}

export async function toggleDemoProPlan(
  plan: "free" | "pro"
): Promise<BillingStatus> {
  const base = getApiBaseUrl();
  const headers = await buildAuthHeaders();
  const res = await fetch(`${base}/api/billing/demo-toggle`, {
    method: "POST",
    headers,
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.error || "No se pudo actualizar el plan");
  }
  return data;
}
