import { useState } from "react";
import { useLocation } from "react-router-dom";
import { DrillDownMap } from "../components/DrillDownMap";
import { FactorExplorer } from "../components/FactorExplorer";

type Tab = "map" | "explorer";

export default function GeographyMap() {
  const location = useLocation();
  const initialState = (location.state as { selectedState?: string } | null)?.selectedState;
  const [activeTab, setActiveTab] = useState<Tab>("map");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">Geographic Analysis</h1>
        <p className="text-census-gray-500 text-sm mt-1">
          State, county, and tract-level exploration · Demographic layers · Factor correlation
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-white/10">
        <TabButton label="Demographic Map" icon="◉" active={activeTab === "map"} onClick={() => setActiveTab("map")} />
        <TabButton label="Factor Explorer" icon="⊞" active={activeTab === "explorer"} onClick={() => setActiveTab("explorer")} />
      </div>

      {activeTab === "map" && (
        <DrillDownMap
          compact={false}
          showSidebar={true}
          initialStateFips={initialState}
        />
      )}

      {activeTab === "explorer" && (
        <div className="space-y-4">
          <div className="bg-slate-800/30 rounded-lg border border-white/5 px-4 py-3 text-xs text-census-gray-400">
            <span className="text-white font-medium">How to use: </span>
            Select any two demographic factors as X and Y axes. Each dot is a U.S. county, colored by AI risk score.
            The blue dashed line is the linear trend. The Pearson r-value measures correlation strength.
          </div>
          <FactorExplorer />
        </div>
      )}
    </div>
  );
}

function TabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all ${
        active
          ? "border-primary-500 text-white"
          : "border-transparent text-census-gray-400 hover:text-census-gray-200 hover:border-white/20"
      }`}
    >
      <span className="text-xs">{icon}</span>
      {label}
    </button>
  );
}
