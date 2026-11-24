import React, { useState } from "react";
import { User } from "firebase/auth";
import {
  X,
  LogIn,
  LogOut,
  Cloud,
  Crown,
  CreditCard,
  Palette,
  BookOpen,
  Smartphone,
  HelpCircle,
  ChevronDown,
  Loader2,
  ExternalLink,
  CheckCircle2,
} from "lucide-react";
import {
  AppVibrantTheme,
  BillingStatus,
  BookPaperTheme,
  PaywallReason,
} from "../types";
import { requestBillingPortal, toggleDemoProPlan } from "../utils/apiClient";

interface SettingsModalProps {
  onClose: () => void;
  user: User | null;
  authLoading: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  billingStatus: BillingStatus | null;
  onRefreshBilling: () => Promise<void>;
  onOpenPaywall: (reason?: PaywallReason) => void;
  vibrantTheme: AppVibrantTheme;
  setVibrantTheme: (theme: AppVibrantTheme) => void;
  paperTheme: BookPaperTheme;
  setPaperTheme: (theme: BookPaperTheme) => void;
  fontSize: number;
  setFontSize: React.Dispatch<React.SetStateAction<number>>;
  onOpenAndroidApk: () => void;
}

const FAQ_ITEMS = [
  {
    q: "¿Cómo activo el micrófono en mi celular?",
    a: "Pulsa 'Dictar Voz' y acepta el permiso de micrófono en tu navegador (Chrome o Safari). En la app Android (.APK), el reconocimiento nativo funciona incluso con la pantalla encendida sin límites de navegador.",
  },
  {
    q: "¿Cómo exporto mi libro para Amazon KDP o Kindle?",
    a: "Pulsa el botón Exportar arriba a la derecha y elige 'eBook (.EPUB)' para subir directo a Amazon KDP/Apple Books, o 'Word (.DOCX)' para edición final y maquetación.",
  },
  {
    q: "¿Cambian mis palabras al acomodar el dictado?",
    a: "No. Con el estilo 'Fiel a mis palabras' el sistema respeta tu vocabulario exacto y solo agrega puntuación, párrafos y el orden cronológico correcto.",
  },
  {
    q: "¿Cómo respaldo mis libros en la nube?",
    a: "Al iniciar sesión con Google en 1 clic, todos tus libros, capítulos, personajes y línea temporal se sincronizan automáticamente en la nube por tu cuenta.",
  },
  {
    q: "¿Cómo cancelo mi suscripción o descargo facturas?",
    a: "Dentro de este menú de Ajustes pulsa 'Gestionar suscripción y facturas'. Se abrirá tu portal automático para cambiar tarjeta, bajar recibos o cancelar en 1 clic sin escribir a nadie.",
  },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  user,
  authLoading,
  onGoogleSignIn,
  onSignOut,
  billingStatus,
  onRefreshBilling,
  onOpenPaywall,
  vibrantTheme,
  setVibrantTheme,
  paperTheme,
  setPaperTheme,
  fontSize,
  setFontSize,
  onOpenAndroidApk,
}) => {
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(0);
  const [portalMsg, setPortalMsg] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const isPro = Boolean(billingStatus?.isPro);

  const handleOpenPortal = async () => {
    setPortalLoading(true);
    setPortalMsg(null);
    try {
      const res = await requestBillingPortal();
      if (res.configured && res.url) {
        window.open(res.url, "_blank", "noopener,noreferrer");
      } else {
        setPortalMsg(
          res.message ||
            "El portal de facturas estará disponible al conectar tu pasarela de pago."
        );
      }
    } catch (err: any) {
      setPortalMsg(err?.message || "No se pudo abrir el portal en este momento.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleDemoToggle = async () => {
    setPortalLoading(true);
    setPortalMsg(null);
    try {
      await toggleDemoProPlan(isPro ? "free" : "pro");
      await onRefreshBilling();
    } catch (err: any) {
      setPortalMsg(err?.message || "No se pudo cambiar el estado.");
    } finally {
      setPortalLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-white/15 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl text-stone-100 my-6 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10">
          <div>
            <h2 className="text-lg font-bold text-white">Ajustes del Estudio</h2>
            <p className="text-xs text-stone-400">
              Cuenta, suscripción, apariencia, app Android y ayuda
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition"
            aria-label="Cerrar ajustes"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Cuenta & Respaldo en la Nube */}
        <section className="bg-stone-950/80 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
              <Cloud className="w-4 h-4 text-amber-400" />
              Cuenta y Respaldo en la Nube
            </span>
            {user && (
              <span className="text-[11px] text-emerald-300 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Sincronizado
              </span>
            )}
          </div>

          {user ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || "Usuario"}
                    className="w-10 h-10 rounded-full border border-white/20 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 font-bold flex items-center justify-center shrink-0">
                    {(user.displayName || user.email || "U")[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">
                    {user.displayName || "Autor conectado"}
                  </p>
                  <p className="text-xs text-stone-400 truncate">{user.email}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="px-3 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-xs font-semibold text-stone-200 flex items-center gap-1.5 transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Salir</span>
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-xs text-stone-300 leading-relaxed">
                Inicia sesión con Google en 1 clic para guardar tus libros en la
                nube y no perder nada si borras la caché o cambias de dispositivo.
              </p>
              <button
                type="button"
                onClick={onGoogleSignIn}
                disabled={authLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-stone-100 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-md disabled:opacity-50"
              >
                {authLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogIn className="w-4 h-4" />
                )}
                <span>Continuar con Google en 1 clic</span>
              </button>
            </div>
          )}
        </section>

        {/* 2. Suscripción y Facturas */}
        <section className="bg-stone-950/80 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-300 flex items-center gap-1.5">
              <Crown className="w-4 h-4 text-amber-400" />
              Suscripción y Cuota IA
            </span>
            <span
              className={`text-xs font-bold px-2.5 py-0.5 rounded-lg tabular-nums ${
                isPro
                  ? "bg-amber-400/20 text-amber-300 border border-amber-400/30"
                  : "bg-stone-800 text-stone-300 border border-white/10"
              }`}
            >
              {isPro
                ? "Plan Pro Ilimitado"
                : `Plan Gratis · ${billingStatus?.aiUses ?? 0}/${
                    billingStatus?.aiLimit ?? 3
                  } usos IA`}
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            {!isPro && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenPaywall("general");
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-400 to-rose-500 hover:from-amber-300 hover:to-rose-400 text-stone-950 font-extrabold text-xs flex items-center justify-center gap-1.5 transition"
              >
                <Crown className="w-4 h-4" />
                <span>Pasar a Plan Pro</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenPortal}
              disabled={portalLoading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-100 border border-white/10 font-semibold text-xs flex items-center justify-center gap-1.5 transition"
            >
              {portalLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CreditCard className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>Gestionar suscripción y facturas</span>
              <ExternalLink className="w-3 h-3 opacity-60" />
            </button>
          </div>

          {billingStatus?.gatewayProvider === "demo" && (
            <div className="pt-1 flex items-center justify-between gap-2 text-[11px] text-stone-400 border-t border-white/5">
              <span>Pasarela externa aún sin llaves (modo prueba local):</span>
              <button
                type="button"
                onClick={handleDemoToggle}
                disabled={portalLoading}
                className="text-amber-300 hover:text-amber-200 font-bold underline"
              >
                {isPro ? "Volver a Gratis" : "Probar Pro ahora"}
              </button>
            </div>
          )}

          {portalMsg && (
            <p className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              {portalMsg}
            </p>
          )}
        </section>

        {/* 3. Temas de Color, Papel y Tamaño de Letra */}
        <section className="bg-stone-950/80 border border-white/10 rounded-2xl p-4 space-y-4">
          <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
            <Palette className="w-4 h-4 text-cyan-400" />
            Apariencia del Estudio y Papel
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <span className="text-xs text-stone-300 font-medium block">
                Ambiente de la aplicación
              </span>
              <div className="flex items-center gap-2">
                {(
                  [
                    {
                      id: "sunset",
                      label: "Atardecer",
                      bg: "linear-gradient(135deg, #ff5e62, #ff9966)",
                    },
                    {
                      id: "fiesta",
                      label: "Fiesta",
                      bg: "linear-gradient(135deg, #f43f5e, #fbbf24)",
                    },
                    {
                      id: "ocean",
                      label: "Océano",
                      bg: "linear-gradient(135deg, #06b6d4, #10b981)",
                    },
                    {
                      id: "violet",
                      label: "Aurora",
                      bg: "linear-gradient(135deg, #8b5cf6, #ec4899)",
                    },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setVibrantTheme(t.id)}
                    title={t.label}
                    className={`w-9 h-9 rounded-full transition-transform ${
                      vibrantTheme === t.id
                        ? "ring-2 ring-white scale-110"
                        : "opacity-65 hover:opacity-100"
                    }`}
                    style={{ background: t.bg }}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-xs text-stone-300 font-medium block">
                Papel de lectura
              </span>
              <div className="flex items-center gap-2">
                {(
                  [
                    { id: "classic", label: "Crema Dorada", color: "#fffdf2" },
                    { id: "peach", label: "Melocotón", color: "#fff5eb" },
                    { id: "mint", label: "Menta Fresca", color: "#f0fdf4" },
                    { id: "lavender", label: "Lavanda", color: "#faf5ff" },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPaperTheme(p.id)}
                    title={p.label}
                    className={`w-9 h-9 rounded-full border transition-transform ${
                      paperTheme === p.id
                        ? "ring-2 ring-amber-400 scale-110 border-amber-400"
                        : "border-white/25 opacity-75 hover:opacity-100"
                    }`}
                    style={{ backgroundColor: p.color }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <span className="text-xs text-stone-300 flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-amber-400" />
              Tamaño de letra al leer
            </span>
            <div className="flex items-center bg-stone-900 rounded-xl border border-white/10 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.max(14, s - 1))}
                className="px-3 py-1.5 text-stone-300 hover:text-white font-bold"
              >
                A-
              </button>
              <span className="text-amber-300 font-mono tabular-nums px-2">
                {fontSize}px
              </span>
              <button
                type="button"
                onClick={() => setFontSize((s) => Math.min(26, s + 1))}
                className="px-3 py-1.5 text-stone-300 hover:text-white font-bold"
              >
                A+
              </button>
            </div>
          </div>
        </section>

        {/* 4. App Android (.APK) */}
        <section className="bg-stone-950/80 border border-emerald-500/25 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                App Android (.APK Nativo)
              </h3>
              <p className="text-xs text-stone-400">
                Descarga el instalador con dictado nativo en tu teléfono.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAndroidApk();
            }}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 text-stone-950 font-extrabold text-xs whitespace-nowrap transition"
          >
            Descargar APK
          </button>
        </section>

        {/* 5. Mini FAQ de Autoservicio */}
        <section className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-stone-300 flex items-center gap-1.5">
            <HelpCircle className="w-4 h-4 text-amber-400" />
            Ayuda Rápida (Preguntas Frecuentes)
          </span>

          <div className="space-y-1.5">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaqIdx === idx;
              return (
                <div
                  key={idx}
                  className="bg-stone-950/70 border border-white/10 rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIdx(isOpen ? null : idx)}
                    className="w-full px-3.5 py-2.5 text-left text-xs font-semibold text-stone-200 flex items-center justify-between gap-2 hover:bg-white/5 transition"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-4 h-4 text-stone-400 shrink-0 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-3.5 pb-3 text-xs text-stone-400 leading-relaxed border-t border-white/5 pt-2">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
};
