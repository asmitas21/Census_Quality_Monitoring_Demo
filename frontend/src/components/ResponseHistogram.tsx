import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { get } from "../api/client";

type Bucket = {
  range: string;
  min: number;
  max: number;
  count: number;
  severity: string;
};

type HistogramData = {
  buckets: Bucket[];
  total_counties: number;
  national_benchmark: number;
  actual_national_avg: number;
  lineage: string[];
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: "#ef4444",
  severe: "#f97316",
  moderate: "#eab308",
  good: "#22c55e",
};

type Props = {
  onBucketClick?: (min: number, max: number) => void;
  selectedBucket?: { min: number; max: number } | null;
};

export function ResponseHistogram({ onBucketClick, selectedBucket }: Props) {
  const [data, setData] = useState<HistogramData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get<HistogramData>("/snapshot/histogram")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
        <div className="h-8 w-64 bg-slate-700 rounded animate-pulse mb-4" />
        <div className="h-64 bg-slate-700/50 rounded animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const chartData = data.buckets.map((b) => ({
    ...b,
    name: b.range,
    isSelected: selectedBucket && b.min === selectedBucket.min && b.max === selectedBucket.max,
  }));

  const benchmarkBucketIndex = data.buckets.findIndex(
    (b) => b.min <= data.national_benchmark && b.max > data.national_benchmark
  );
  const avgBucketIndex = data.buckets.findIndex(
    (b) => b.min <= data.actual_national_avg && b.max > data.actual_national_avg
  );

  return (
    <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            County Response Rate Distribution
          </h3>
          <p className="text-xs text-census-gray-500 mt-1">
            Click a bar to filter high-risk counties below
          </p>
          {selectedBucket && (
            <button
              onClick={() => onBucketClick && onBucketClick(selectedBucket.min, selectedBucket.max)}
              className="mt-2 px-3 py-1 bg-primary-500/20 hover:bg-primary-500/30 text-primary-400 text-xs rounded-lg flex items-center gap-2 transition"
            >
              <span>Filtering: {selectedBucket.min}-{selectedBucket.max}%</span>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="px-2 py-1 bg-slate-700/50 rounded text-xs text-census-gray-400">
            {data.total_counties.toLocaleString()} counties
          </span>
          <span className="px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded">
            Unity Catalog
          </span>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={{ stroke: "#475569" }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              tickLine={false}
              axisLine={false}
              label={{ value: "Counties", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                background: "#1e293b",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "8px",
                fontSize: 12,
              }}
              formatter={(value: number) => [`${value} counties`, "Count"]}
              labelFormatter={(label: string) => `${label} response rate`}
            />
            <ReferenceLine
              x={chartData[benchmarkBucketIndex]?.name}
              stroke="#3b82f6"
              strokeDasharray="5 5"
              strokeWidth={2}
              label={{
                value: "67% benchmark",
                position: "top",
                fill: "#3b82f6",
                fontSize: 10,
              }}
            />
            {avgBucketIndex !== benchmarkBucketIndex && (
              <ReferenceLine
                x={chartData[avgBucketIndex]?.name}
                stroke="#a855f7"
                strokeDasharray="3 3"
                strokeWidth={2}
                label={{
                  value: `${data.actual_national_avg}% avg`,
                  position: "top",
                  fill: "#a855f7",
                  fontSize: 10,
                }}
              />
            )}
            <Bar
              dataKey="count"
              radius={[4, 4, 0, 0]}
              cursor="pointer"
              onClick={(barData: Record<string, unknown>) => {
                if (onBucketClick && barData && typeof barData.min === 'number' && typeof barData.max === 'number') {
                  onBucketClick(barData.min, barData.max);
                }
              }}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={SEVERITY_COLORS[entry.severity] || "#64748b"}
                  opacity={entry.isSelected ? 1 : 0.8}
                  stroke={entry.isSelected ? "#fff" : "transparent"}
                  strokeWidth={entry.isSelected ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: SEVERITY_COLORS.critical }} />
            <span className="text-census-gray-400">&lt;40% Critical</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: SEVERITY_COLORS.severe }} />
            <span className="text-census-gray-400">40-55% Severe</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: SEVERITY_COLORS.moderate }} />
            <span className="text-census-gray-400">55-65% Moderate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: SEVERITY_COLORS.good }} />
            <span className="text-census-gray-400">65%+ Good</span>
          </div>
        </div>
        <p className="text-xs text-census-gray-600">
          Source: {data.lineage[0]?.split(".").pop()}
        </p>
      </div>
    </div>
  );
}
