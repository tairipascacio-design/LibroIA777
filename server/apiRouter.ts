import { Request, Response } from "express";
import fs from "fs";
import path from "path";
import {
  organizeDictationWithGemini,
  refineChapterWithGemini,
  generateContinuationPrompts,
} from "./geminiService";
import {
  checkAndConsumeAiQuota,
  createCheckoutSessionForRequest,
  createPortalSessionForRequest,
  getBillingStatusForRequest,
  processVerifiedWebhook,
  toggleDemoPlanForRequest,
} from "./billingService";

const APK_FILE_PATH = path.resolve(
  process.cwd(),
  "android-dist",
  "VozALibro.apk"
);

export async function handleOrganizeDictation(req: Request, res: Response) {
  try {
    const { dictation, book, mode, currentChapterId } = req.body;
    if (!dictation || typeof dictation !== "string") {
      res.status(400).json({ error: "Se requiere el texto del dictado." });
      return;
    }
    if (!book) {
      res.status(400).json({ error: "Se requiere el contexto del libro." });
      return;
    }

    const quota = await checkAndConsumeAiQuota(req);
    if (!quota.allowed) {
      res.status(402).json({
        error:
          "Alcanzaste los 3 acomodos gratuitos con IA. Pasa a Plan Pro para continuar sin límites.",
        code: "PAYWALL_REQUIRED",
        billingStatus: quota.status,
      });
      return;
    }

    const result = await organizeDictationWithGemini(
      dictation,
      book,
      mode || "auto_chronology",
      currentChapterId
    );
    res.json({ ...result, billingStatus: quota.status });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    console.warn("Dictation API notice:", status, error?.message);
    res.status(status).json({
      error: error?.message || "Error procesando el dictado con Gemini.",
    });
  }
}

export async function handleRefineChapter(req: Request, res: Response) {
  try {
    const { content, bookGenre, instruction } = req.body;
    if (!content) {
      res.status(400).json({ error: "Contenido del capítulo requerido." });
      return;
    }

    const quota = await checkAndConsumeAiQuota(req);
    if (!quota.allowed) {
      res.status(402).json({
        error:
          "Alcanzaste los 3 acomodos gratuitos con IA. Pasa a Plan Pro para pulir y organizar capítulos ilimitados.",
        code: "PAYWALL_REQUIRED",
        billingStatus: quota.status,
      });
      return;
    }

    const refined = await refineChapterWithGemini(
      content,
      bookGenre || "Novela",
      instruction || "Mejorar estilo literario y riqueza descriptiva"
    );
    res.json({ refinedText: refined, billingStatus: quota.status });
  } catch (error: any) {
    const status = error?.statusCode || 500;
    console.warn("Refine API notice:", status, error?.message);
    res.status(status).json({
      error: error?.message || "Error al refinar capítulo.",
    });
  }
}

export async function handleContinuationPrompts(req: Request, res: Response) {
  try {
    const { book, currentChapterId } = req.body;
    if (!book) {
      res.status(400).json({ error: "Contexto del libro requerido." });
      return;
    }
    const prompts = await generateContinuationPrompts(book, currentChapterId);
    res.json({ prompts });
  } catch (error: any) {
    console.warn("Continuation prompts fallback:", error?.message);
    res.json({
      prompts: [
        "¿Qué detalle de aquel lugar o momento recuerdas con más claridad?",
        "¿Qué pasó justo antes o inmediatamente después de esa escena?",
        "¿Quién más estaba ahí y qué dijo o hizo en ese instante?",
        "¿Cómo te sentiste o qué pensamiento se te cruzó por la cabeza?",
      ],
    });
  }
}

export async function handleBillingStatus(req: Request, res: Response) {
  try {
    const status = await getBillingStatusForRequest(req);
    res.json(status);
  } catch (error: any) {
    res.status(500).json({
      error: error?.message || "Error consultando estado de suscripción.",
    });
  }
}

export async function handleBillingCheckout(req: Request, res: Response) {
  try {
    const cycle = req.body?.cycle === "annual" ? "annual" : "monthly";
    const result = await createCheckoutSessionForRequest(req, cycle);
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode || 500).json({
      error: error?.message || "Error iniciando checkout.",
    });
  }
}

export async function handleBillingPortal(req: Request, res: Response) {
  try {
    const result = await createPortalSessionForRequest(req);
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode || 500).json({
      error: error?.message || "Error abriendo portal de suscripción.",
    });
  }
}

export async function handleBillingDemoToggle(req: Request, res: Response) {
  try {
    const plan = req.body?.plan === "pro" ? "pro" : "free";
    const status = await toggleDemoPlanForRequest(req, plan);
    res.json(status);
  } catch (error: any) {
    res.status(error?.statusCode || 500).json({
      error: error?.message || "No se pudo cambiar el estado del plan de prueba.",
    });
  }
}

export async function handleBillingWebhook(req: Request, res: Response) {
  try {
    const rawBody =
      typeof (req as any).rawBody === "string"
        ? (req as any).rawBody
        : JSON.stringify(req.body || {});
    const result = processVerifiedWebhook(
      rawBody,
      req.headers as Record<string, string | string[] | undefined>
    );
    res.json(result);
  } catch (error: any) {
    res.status(error?.statusCode || 400).json({
      error: error?.message || "Error procesando webhook de pago.",
    });
  }
}

export function handleApkInfo(_req: Request, res: Response) {
  try {
    if (fs.existsSync(APK_FILE_PATH)) {
      const stat = fs.statSync(APK_FILE_PATH);
      res.json({
        ready: true,
        fileName: "VozALibro.apk",
        packageName: "com.vozalibro.app",
        version: "1.0.0",
        sizeBytes: stat.size,
      });
      return;
    }
  } catch {
    // ignore
  }
  res.json({
    ready: false,
    fileName: "VozALibro.apk",
    packageName: "com.vozalibro.app",
    version: "1.0.0",
    sizeBytes: 0,
  });
}

export function handleApkBase64(_req: Request, res: Response) {
  if (!fs.existsSync(APK_FILE_PATH)) {
    res.status(404).json({
      error: "El archivo VozALibro.apk aún no se ha compilado en el servidor.",
    });
    return;
  }

  try {
    const buf = fs.readFileSync(APK_FILE_PATH);
    res.setHeader("Cache-Control", "no-store");
    res.json({
      ready: true,
      fileName: "VozALibro.apk",
      packageName: "com.vozalibro.app",
      version: "1.0.0",
      sizeBytes: buf.length,
      base64: buf.toString("base64"),
    });
  } catch {
    res.status(500).json({ error: "Error leyendo el archivo APK." });
  }
}

export function handleDownloadApk(req: Request, res: Response) {
  if (!fs.existsSync(APK_FILE_PATH)) {
    res.status(404).json({
      error: "El archivo VozALibro.apk aún no se ha compilado en el servidor.",
    });
    return;
  }

  const stat = fs.statSync(APK_FILE_PATH);
  res.setHeader("Content-Type", "application/vnd.android.package-archive");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="VozALibro.apk"'
  );
  res.setHeader("Content-Length", String(stat.size));
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "HEAD") {
    res.statusCode = 200;
    res.end();
    return;
  }

  const stream = fs.createReadStream(APK_FILE_PATH);
  stream.on("error", () => {
    if (!res.headersSent) {
      res.status(500).json({ error: "Error leyendo el archivo APK." });
    }
  });
  stream.pipe(res);
}

export function handleDownloadAndroidScript(_req: Request, res: Response) {
  const scriptContent = `#!/bin/bash
# Script oficial para compilar el APK nativo de Voz a Libro con Capacitor + Android Studio
echo "1. Instalando Capacitor para Android..."
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Voz a Libro" "com.vozalibro.app" --web-dir=dist
npm run build
npx cap add android
npx cap sync android
npx cap open android
`;

  res.setHeader("Content-Type", "text/x-shellscript; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    'attachment; filename="compilar-apk-android.sh"'
  );
  res.end(scriptContent);
}
