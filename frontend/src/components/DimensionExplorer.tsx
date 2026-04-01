import { useState, useEffect } from "react";
import { get } from "../api/client";

interface Dimension {
  id: string;
  label: string;
  column: string;
}

interface CrosstabCell {
  dim1_bin: string;
  dim2_bin: string;
  tract_count: number;
  avg_metric: number;
  multiplier: number;
}

interface CrosstabResult {
  dim1: { id: string; label: string; bins: string[] };
  dim2: { id: string; label: string; bins: string[] };
  metric: string;
  overall_average: number;
  data: CrosstabCell[];
  insight: string;
}

export function DimensionExplorer() {
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [dim1, setDim1] = useState("hispanic");
  const [dim2, setDim2] = useState("renter");
  const [metric, setMetric] = useState("pct_children_under_5");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CrosstabResult | null>(null);

  useEffect(() => {
    get<{ dimensions: Dimension[] }>("/journey/dimensions").then((res) => {
      setDimensions(res.dimensions);
    });
  }, []);

  useEffect(() => {
    if (dim1 && dim2) {
      fetchCrosstab();
    }
  }, [dim1, dim2, metric]);

  const fetchCrosstab = async () => {
    setLoading(true);
    try {
      const res = await get<CrosstabResult>(`/journey/crosstab?dim1=${dim1}&dim2=${dim2}&metric=${metric}`);
      setResult(res);
    } catch (err) {
      console.error("Crosstab error:", err);
    }
    setLoading(false);
  };

  const getHeatmapColor = (multiplier: number): string => {
    if (multiplier >= 1.5) return "bg-red-500";
    if (multiplier >= 1.25) return "bg-orange-500";
    if (multiplier >= 1.1) return "bg-yellow-500";
    if (multiplier >= 0.9) return "bg-green-500";
    return "bg-green-600";
  };

  const getTextColor = (multiplier: number): string => {
    return multiplier >= 1.25 ? "text-white" : "text-white";
  };

  // Build heatmap grid
  const buildGrid = () => {
    if (!result || !result.data.length) return null;

    const dim1Bins = result.dim1.bins;
    const dim2Bins = result.dim2.bins;

    return (
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs text-white/60 text-left border-b border-white/10">
                {result.dim1.label} ↓ / {result.dim2.label} →
              </th>
              {dim2Bins.map((bin) => (
                <th key={bin} className="p-2 text-xs text-white/80 text-center border-b border-white/10 min-w-[80px]">
                  {bin}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dim1Bins.map((d1Bin) => (
              <tr key={d1Bin}>
                <td className="p-2 text-xs text-white/80 border-r border-white/10 font-medium">
                  {d1Bin}
                </td>
                {dim2Bins.map((d2Bin) => {
                  const cell = result.data.find(
                    (c) => c.dim1_bin === d1Bin && c.dim2_bin === d2Bin
                  );
                  if (!cell) {
                    return (
                      <td key={d2Bin} className="p-2 text-center bg-slate-800/50 text-white/30 text-xs">
                        -
                      </td>
                    );
                  }
                  return (
                    <td
                      key={d2Bin}
                      className={`p-2 text-center ${getHeatmapColor(cell.multiplier)} ${getTextColor(cell.multiplier)} cursor-pointer hover:opacity-80 transition`}
                      title={`${cell.tract_count} tracts, avg ${cell.avg_metric}%`}
                    >
                      <div className="text-sm font-bold">{cell.multiplier}x</div>
                      <div className="text-xs opacity-80">{cell.avg_metric}%</div>
                      <div className="text-xs opacity-60">{cell.tract_count} tracts</div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-semibold text-white flex items-center gap-2">
            <span className="text-2xl">🔍</span>
            Dimension Explorer
          </h3>
          <p className="text-sm text-white/60 mt-1">
            Discover patterns by crossing any two dimensions
          </p>
        </div>
      </div>

      {/* Dimension Selectors */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div>
          <label className="block text-xs text-white/60 mb-1">Dimension 1 (Rows)</label>
          <select
            value={dim1}
            onChange={(e) => setDim1(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
          >
            {dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">Dimension 2 (Columns)</label>
          <select
            value={dim2}
            onChange={(e) => setDim2(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
          >
            {dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-white/60 mb-1">Metric</label>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500/50"
          >
            <option value="pct_children_under_5">Children Under 5 %</option>
            <option value="pct_hispanic">Hispanic %</option>
            <option value="pct_renter">Renter %</option>
          </select>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <svg className="w-8 h-8 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}

      {/* Heatmap */}
      {!loading && result && (
        <>
          <div className="mb-4">
            {buildGrid()}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mb-4">
            <span className="text-xs text-white/60">Risk Level:</span>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-600"></span>
              <span className="text-xs text-white/60">&lt;0.9x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-green-500"></span>
              <span className="text-xs text-white/60">0.9-1.1x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-yellow-500"></span>
              <span className="text-xs text-white/60">1.1-1.25x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-orange-500"></span>
              <span className="text-xs text-white/60">1.25-1.5x</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-4 h-4 rounded bg-red-500"></span>
              <span className="text-xs text-white/60">&gt;1.5x</span>
            </div>
          </div>

          {/* Insight */}
          <div className="p-4 bg-primary-500/10 border border-primary-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-xl">💡</span>
              <div>
                <p className="text-sm font-medium text-white">AI Insight</p>
                <p className="text-sm text-white/80 mt-1">{result.insight}</p>
              </div>
            </div>
          </div>

          {/* Overall average */}
          <div className="mt-4 text-xs text-white/50">
            Overall average: {result.overall_average}% | Multiplier = cell average ÷ overall average
          </div>
        </>
      )}
    </div>
  );
}
