import React, { useState, useEffect, useRef, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  X,
  Smartphone,
  Download,
  Copy,
  Check,
  CheckCircle2,
  ShieldCheck,
  QrCode,
  Loader2,
  AlertCircle,
  Mic,
  WifiOff,
} from "lucide-react";

interface AndroidApkModalProps {
  onClose: () => void;
}

interface ApkInfo {
  ready: boolean;
  fileName: string;
  packageName: string;
  version: string;
  sizeBytes: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hasZipMagicBytes(bytes: Uint8Array): boolean {
  return bytes.length > 1000 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function triggerBlobDownload(bytes: Uint8Array, fileName: string) {
  const safeBuffer = new Uint8Array(bytes).buffer;
  const blob = new Blob([safeBuffer], {
    type: "application/vnd.android.package-archive",
  });
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}

export const AndroidApkModal: React.FC<AndroidApkModalProps> = ({ onClose }) => {
  const [apkInfo, setApkInfo] = useState<ApkInfo | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [downloadDone, setDownloadDone] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const autoTriggeredRef = useRef(false);

  const currentOrigin =
    typeof window !== "undefined" ? window.location.origin : "";
  const apkDownloadUrl = `${currentOrigin}/api/download-apk`;

  const formatSize = (bytes: number) => {
    if (!bytes) return "Listo";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  const handleDownloadApk = useCallback(async () => {
    setDownloading(true);
    setDownloadError(null);
    setDownloadDone(false);

    const fileName = "VozALibro.apk";

    try {
      // 1. In-memory lazy JS payload (never loses iframe cookies or triggers proxy HTML)
      try {
        const mod = await import("../apkPayload");
        if (mod.APK_BASE64 && mod.APK_BASE64.length > 1000) {
          const bytes = base64ToUint8Array(mod.APK_BASE64);
          if (hasZipMagicBytes(bytes)) {
            triggerBlobDownload(bytes, fileName);
            setDownloadDone(true);
            return;
          }
        }
      } catch {
        // Fall through to authenticated API endpoints
      }

      // 2. Authenticated same-origin JSON base64 endpoint
      try {
        const res = await fetch("/api/apk-base64", {
          credentials: "same-origin",
        });
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          const data = await res.json();
          if (data?.base64) {
            const bytes = base64ToUint8Array(data.base64);
            if (hasZipMagicBytes(bytes)) {
              triggerBlobDownload(bytes, fileName);
              setDownloadDone(true);
              return;
            }
          }
        }
      } catch {
        // Fall through to binary fetch
      }

      // 3. Binary fetch with PK magic-byte validation
      const binRes = await fetch("/api/download-apk", {
        credentials: "same-origin",
      });
      const binCt = binRes.headers.get("content-type") || "";
      if (!binRes.ok || binCt.includes("text/html")) {
        throw new Error(
          "No se pudo completar la descarga en este marco. Abre el preview en pestaña nueva con 'Authenticate in new window' y vuelve a picar Descargar."
        );
      }

      const arrayBuf = await binRes.arrayBuffer();
      const bytes = new Uint8Array(arrayBuf);
      if (!hasZipMagicBytes(bytes)) {
        throw new Error(
          "El archivo recibido no es un APK válido (posible bloqueo de cookies del navegador)."
        );
      }

      triggerBlobDownload(bytes, fileName);
      setDownloadDone(true);
    } catch (err: any) {
      setDownloadError(
        err?.message ||
          "No se pudo completar la descarga. Intenta abriendo el preview en una pestaña nueva."
      );
    } finally {
      setDownloading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/apk-info", {
          credentials: "same-origin",
        });
        const ct = res.headers.get("content-type") || "";
        if (res.ok && ct.includes("application/json")) {
          const data: ApkInfo = await res.json();
          if (active) {
            setApkInfo(data);
            setLoadingInfo(false);
          }
        }
      } catch {
        // Fallback below
      }

      try {
        const mod = await import("../apkPayload");
        if (active && mod.APK_BASE64) {
          const approxBytes = Math.floor((mod.APK_BASE64.length * 3) / 4);
          setApkInfo((prev) =>
            prev?.ready
              ? prev
              : {
                  ready: true,
                  fileName: "VozALibro.apk",
                  packageName: "com.vozalibro.app",
                  version: "1.0.0",
                  sizeBytes: approxBytes,
                }
          );
        }
      } catch {
        // ignore
      } finally {
        if (active) setLoadingInfo(false);
      }
    })();

    if (!autoTriggeredRef.current) {
      autoTriggeredRef.current = true;
      void handleDownloadApk();
    }

    return () => {
      active = false;
    };
  }, [handleDownloadApk]);

  const handleCopyUrl = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(apkDownloadUrl);
        setCopiedUrl(true);
        setTimeout(() => setCopiedUrl(false), 2500);
        return;
      }
    } catch {
      // fallback
    }
    try {
      if (urlInputRef.current) {
        urlInputRef.current.select();
        urlInputRef.current.setSelectionRange(0, 99999);
        if (document.execCommand("copy")) {
          setCopiedUrl(true);
          setTimeout(() => setCopiedUrl(false), 2500);
        }
      }
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-white/15 rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl relative text-stone-100 my-8">
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-400 via-cyan-500 to-blue-500 flex items-center justify-center text-stone-950 shadow-lg">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                Android Nativo (.APK)
              </span>
              <h2 className="text-xl font-extrabold text-white">
                Descargar VozALibro.apk
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Main Direct APK Download Card */}
        <div className="bg-gradient-to-br from-emerald-500/20 via-cyan-500/10 to-stone-950 border border-emerald-400/40 rounded-2xl p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span className="text-sm font-bold text-white">
                APK Nativo Compilado y Firmado (v{apkInfo?.version || "1.0.0"})
              </span>
            </div>
            <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-stone-950/90 border border-emerald-500/30 text-emerald-300">
              {loadingInfo
                ? "Verificando..."
                : apkInfo?.ready
                ? `${apkInfo.fileName} • ${formatSize(apkInfo.sizeBytes)}`
                : "Listo para descargar"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs text-stone-200">
            <div className="flex items-center gap-2 bg-stone-950/60 rounded-xl px-3 py-2 border border-white/5">
              <Mic className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Micrófono nativo Android SpeechRecognizer integrado</span>
            </div>
            <div className="flex items-center gap-2 bg-stone-950/60 rounded-xl px-3 py-2 border border-white/5">
              <WifiOff className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>Descarga directa en memoria sin redirecciones ni cookies</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownloadApk}
            disabled={downloading}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition disabled:opacity-50"
          >
            {downloading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Descargando VozALibro.apk...</span>
              </>
            ) : (
              <>
                <Download className="w-5 h-5" />
                <span>
                  {downloadDone
                    ? "Volver a descargar VozALibro.apk"
                    : "Descargar VozALibro.apk Ahora"}
                </span>
              </>
            )}
          </button>

          {downloadDone && (
            <div className="flex items-center gap-2 text-xs text-emerald-300 font-semibold bg-emerald-950/50 border border-emerald-500/40 rounded-xl px-3.5 py-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                ¡Descarga iniciada! Revisa tus Descargas y abre{" "}
                <strong>VozALibro.apk</strong> en tu Android para instalarlo.
              </span>
            </div>
          )}

          {downloadError && (
            <div className="flex items-start gap-2 text-xs text-amber-200 bg-amber-950/50 border border-amber-500/40 rounded-xl px-3.5 py-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>{downloadError}</span>
            </div>
          )}
        </div>

        {/* QR Code Section */}
        <div className="bg-stone-950/80 border border-white/10 rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-5">
          <div className="bg-white p-3 rounded-2xl shadow-lg shrink-0">
            <QRCodeSVG
              value={apkDownloadUrl}
              size={128}
              level="M"
              includeMargin={false}
            />
          </div>

          <div className="space-y-2 text-xs flex-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-bold bg-emerald-400 text-stone-950">
                <QrCode className="w-3.5 h-3.5" />
                QR directo al .APK (requiere sesión Google)
              </span>
            </div>

            <p className="text-stone-300 leading-relaxed">
              Si ya estás viendo esto desde tu Android, usa el botón verde de
              arriba para guardar <code>VozALibro.apk</code> directo en tu
              teléfono. Si escaneas este QR desde otro celular sin sesión
              iniciada, Google te pedirá validar tu cuenta antes de bajar el
              archivo.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <input
                ref={urlInputRef}
                type="text"
                readOnly
                value={apkDownloadUrl}
                onClick={(e) => e.currentTarget.select()}
                className="flex-1 bg-stone-900 border border-white/15 rounded-xl px-3 py-2 text-[11px] font-mono text-stone-200 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                type="button"
                onClick={handleCopyUrl}
                className="px-3.5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-emerald-300 font-bold text-xs border border-white/10 flex items-center justify-center gap-1.5 transition shrink-0"
              >
                {copiedUrl ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>¡Copiado!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar URL APK</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
