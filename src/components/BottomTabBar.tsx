import React from "react";
import { Mic, Layers, BookOpen, Users } from "lucide-react";

export type AppTab = "dictation" | "editor" | "reader" | "characters";

interface BottomTabBarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
}

const TABS: Array<{
  id: AppTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dictation", label: "Dictar", icon: Mic },
  { id: "editor", label: "Capítulos", icon: Layers },
  { id: "reader", label: "Leer", icon: BookOpen },
  { id: "characters", label: "Reparto", icon: Users },
];

export const BottomTabBar: React.FC<BottomTabBarProps> = ({
  activeTab,
  setActiveTab,
}) => {
  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 inset-x-0 z-30 bg-stone-950/95 backdrop-blur-md border-t border-white/10 no-print"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="max-w-xl mx-auto grid grid-cols-4 h-16 px-2">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-1 rounded-xl mx-0.5 my-1 transition ${
                isActive
                  ? "text-amber-300 bg-amber-500/10 font-bold"
                  : "text-stone-400 hover:text-stone-200 font-medium"
              }`}
            >
              <Icon
                className={`w-5 h-5 ${isActive ? "text-amber-400" : "text-stone-400"}`}
              />
              <span className="text-[11px] leading-none whitespace-nowrap">
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
