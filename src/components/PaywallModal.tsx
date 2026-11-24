import React, { useState } from "react";
import { User } from "firebase/auth";
import {
  X,
  Crown,
  Check,
  Sparkles,
  Loader2,
  LogIn,
  ShieldCheck,
} from "lucide-react";
import { BillingStatus, PaywallReason } from "../types";
import { createCheckoutSession, toggleDemoProPlan } from "../utils/apiClient";

interface PaywallModalProps {
  reason: PaywallReason;
  onClose: () => void;
  user: User | null;
  onGoogleSignIn: () => Promise<void>;
  billingStatus: BillingStatus | null;
  onRefreshBilling: () => Promise<void>;
}

const REASON_COPY: Record<PaywallReason, { title: string; subtitle: string }> = {
  books: {
    title: "Desbloquea Libros Ilimitados",
    subtitle:
      "El Plan Gratis incluye 1 libro personal (más la muestra). Pasa a Pro para crear todas tus obras sin límite.",
  },
  chapters: {
    title: "Continúa sin límite de capítulos",
    subtitle:
      "Alcanzaste los 2 capítulos incluidos en el Plan Gratis. Desbloquea capítulos y palabras ilimitadas.",
  },
  words: {
    title: "Superaste las 1,500 palabras gratuitas",
    subtitle:
      "Tu historia ya tomó forma. Pasa a Plan Pro para seguir dictando y escribiendo libros completos.",
  },
  ai: {
    title: "Agotaste los 3 acomodos de prueba con IA",
    subtitle:
      "Desbloquea Acomodo Cronológico, Diálogos con raya y Pulido Literario ilimitados.",
  },
  characters: {
    title: "Amplía tu reparto de personajes",
    subtitle:
      "El Plan Gratis permite hasta 3 personajes por libro. Pasa a Pro para repartos y líneas temporales ilimitadas.",
  },
  audiobook: {
    title: "Escucha tu libro completo en audio",
    subtitle:
      "El Plan Gratis incluye muestra de voz en el Capítulo 1. Con Pro escuchas todos tus capítulos sin límite.",
  },
  export: {
    title: "Exportación Profesional para Kindle y Word",
    subtitle:
      "Descarga tu manuscrito en .EPUB real (Amazon KDP / Kindle), Word (.DOCX) e impresión limpia sin marca de agua.",
  },
  general: {
    title: "Publica tu libro completo con Voz a Libro Pro",
    subtitle:
      "Convierte tu voz en un manuscrito profesional listo para Amazon KDP, Word e imprenta.",
  },
};

export const PaywallModal: React.FC<PaywallModalProps> = ({
  reason,
  onClose,
  user,
  onGoogleSignIn,
  billingStatus,
  onRefreshBilling,
}) => {
  const [cycle, setCycle] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const copy = REASON_COPY[reason] || REASON_COPY.general;

  const handleCheckout = async () => {
    setNotice(null);
    if (!user) {
      setLoading(true);
      try {
        await onGoogleSignIn();
      } catch (err: any) {
        setNotice(err?.message || "Inicia sesión con Google para continuar.");
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    setLoading(true);
    try {
      const res = await createCheckoutSession(cycle);
      if (res.configured && res.url) {
        window.location.href = res.url;
        return;
      }
      setNotice(
        res.message ||
          "Pasarela pendiente de configurar. Puedes probar el desbloqueo Pro en modo demo abajo."
      );
    } catch (err: any) {
      setNotice(err?.message || "No se pudo abrir el checkout.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoUnlock = async () => {
    setLoading(true);
    setNotice(null);
    try {
      await toggleDemoProPlan("pro");
      await onRefreshBilling();
      onClose();
    } catch (err: any) {
      setNotice(err?.message || "No se pudo activar el modo de prueba Pro.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-stone-900 border border-amber-400/30 rounded-3xl max-w-xl w-full p-5 sm:p-6 space-y-5 shadow-2xl text-stone-100 my-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-400 via-rose-500 to-violet-500 flex items-center justify-center text-stone-950 shrink-0 shadow-lg">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300">
                Voz a Libro Pro
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                {copy.title}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 flex items-center justify-center shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-sm text-stone-300 leading-relaxed">
          {copy.subtitle}
        </p>

        {/* Billing Cycle Selector */}
        <div className="grid grid-cols-2 gap-2.5 bg-stone-950 p-1.5 rounded-2xl border border-white/10">
          <button
            type="button"
            onClick={() => setCycle("monthly")}
            className={`p-3 rounded-xl text-left transition ${
              cycle === "monthly"
                ? "bg-stone-800 border border-amber-400/50 text-white"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <span className="text-xs font-bold block">Plan Mensual</span>
            <span className="text-lg font-black text-amber-300 tabular-nums">
              $9.99 <span className="text-xs font-normal text-stone-400">USD/mes</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setCycle("annual")}
            className={`p-3 rounded-xl text-left transition relative ${
              cycle === "annual"
                ? "bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-400 text-white"
                : "text-stone-400 hover:text-stone-200"
            }`}
          >
            <span className="text-[10px] font-extrabold uppercase bg-emerald-400 text-stone-950 px-2 py-0.5 rounded-md absolute -top-2 right-2">
              Ahorra 34%
            </span>
            <span className="text-xs font-bold block">Plan Anual</span>
            <span className="text-lg font-black text-amber-300 tabular-nums">
              $79 <span className="text-xs font-normal text-stone-400">USD/año</span>
            </span>
          </button>
        </div>

        {/* Comparison Highlights */}
        <div className="bg-stone-950/90 border border-white/10 rounded-2xl p-4 space-y-2.5 text-xs">
          {[
            "Libros, capítulos y palabras 100% ilimitados",
            "Acomodo Cronológico, Diálogos y Pulido IA sin límites",
            "Exportación profesional .EPUB (Amazon KDP / Kindle), .DOCX (Word) y PDF limpio",
            "Personajes, línea temporal y audiolibro completo en todos los capítulos",
            "Respaldo automático en la nube y cancelación en 1 clic",
          ].map((feat, i) => (
            <div key={i} className="flex items-start gap-2 text-stone-200">
              <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>{feat}</span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="space-y-2.5">
          <button
            type="button"
            onClick={handleCheckout}
            disabled={loading}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-400 via-rose-500 to-violet-500 hover:from-amber-300 hover:via-rose-400 hover:to-violet-400 text-stone-950 font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-rose-500/25 transition disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : !user ? (
              <LogIn className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span>
              {!user
                ? "Iniciar con Google y Pasar a Pro"
                : cycle === "annual"
                ? "Pasar a Pro ($79 USD/año)"
                : "Pasar a Pro ($9.99 USD/mes)"}
            </span>
          </button>

          {billingStatus?.gatewayProvider === "demo" && (
            <button
              type="button"
              onClick={handleDemoUnlock}
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-amber-300 border border-amber-400/30 text-xs font-bold transition"
            >
              Activar Pro en Modo Prueba Local (sin pasarela configurada aún)
            </button>
          )}
        </div>

        {notice && (
          <div className="text-xs text-amber-200 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3.5 py-2.5">
            {notice}
          </div>
        )}

        <div className="flex items-center justify-center gap-1.5 text-[11px] text-stone-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Pago seguro · Cancela en cualquier momento desde Ajustes</span>
        </div>
      </div>
    </div>
  );
};
