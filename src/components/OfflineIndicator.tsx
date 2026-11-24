import React from "react";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-500 px-4 py-2 text-xs font-bold text-stone-950 shadow-xl border border-white/20">
      <WifiOff className="w-4 h-4 animate-pulse" />
      <span>Modo sin conexión — Tus capítulos guardados siguen disponibles</span>
    </div>
  );
};
