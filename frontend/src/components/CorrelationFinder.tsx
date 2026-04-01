import { useState, useEffect } from "react";
import { get } from "../api/client";

interface Correlation {
  factor: string;
  label: string;
  correlation: number;
  sample_size: number;
  strength: string;
}

interface CorrelationResult {
  target_metric: string;
  correlations: Correlation[];
  insight: string;
}

export function CorrelationFinder() {
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<CorrelationResult | null>(null);
  const [targetMetric, setTargetMetric] = useState("pct_children_under_5");

  useEffect(() => {
    fetchCorrelations();
  }, [targetMetric]);

  const fetchCorrelations = async () => {
    setLoading(true);
    try {
      const res = await get<CorrelationResult>(`/journey/correlations?target_metric=${targetMetric}`);
      setResult(res);
    } catch (err) {
      console.error("Correlation error:", err);
    }
    setLoading(false);
  };

  const getCorrelationColor = (corr: number): string => {
    const abs = Math.abs(corr);
    if (abs >= 0.7) return "text-red-400";
    if (abs >= 0.4) return "text-orange-400";
    if (abs >= 0.2) return "text-yellow-400";
    return "text-white/50";
  };

  const getBarWidth = (corr: number): string => {
    return `${Math.abs(corr) * 100}%`;
  };

  const getBarColor = (corr: number): string => {
    if (corr > 0) return "bg-red-500";
    return "bg-blue-500";
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Correlation Finder
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Discover which factors correlate most with your target metric
          </p>
        </div>
        <select
          value={targetMetric}
          onChange={(e) => setTargetMetric(e.target.value)}
          className="px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
        >
          <option value="pct_children_under_5">Children Under 5 %</option>
          <option value="pct_hispanic">Hispanic %</option>
          <option value="pct_renter">Renter %</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="w-6 h-6 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : result ? (
        <>
          <div className="space-y-3">
            {result.correlations.map((c) => (
              <div key={c.factor} className="bg-slate-900/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{c.label}</span>
                  <span className={`text-sm font-bold ${getCorrelationColor(c.correlation)}`}>
                    r = {c.correlation > 0 ? "+" : ""}{c.correlation}
                  </span>
                </div>
                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${getBarColor(c.correlation)} rounded-full transition-all`}
                    style={{ width: getBarWidth(c.correlation) }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-white/50">
                    {c.strength} correlation
                  </span>
                  <span className="text-xs text-white/50">
                    n = {c.sample_size.toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Insight */}
          <div className="mt-4 p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-medium text-white">Key Finding</p>
                <p className="text-sm text-white/80 mt-1">{result.insight}</p>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex items-center gap-4 text-xs text-white/50">
            <span>Correlation scale:</span>
            <span className="text-white/50">0.0-0.2 weak</span>
            <span className="text-yellow-400">0.2-0.4 moderate</span>
            <span className="text-orange-400">0.4-0.7 strong</span>
            <span className="text-red-400">0.7+ very strong</span>
          </div>
        </>
      ) : null}
    </div>
  );
}
