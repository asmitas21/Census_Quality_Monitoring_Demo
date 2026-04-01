import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { useWorkspaceHost, ucExploreUrl } from "../hooks/useWorkspaceHost";

interface MetricDetail {
  name: string;
  current_value: number;
  benchmark: number;
  trend: { date: string; value: number }[];
  by_state: { state: string; value: number; delta: number }[];
  anomalies: { geography: string; value: number; expected: number; severity: string }[];
}

export default function MetricDrilldown() {
  const host = useWorkspaceHost();
  const { metricName } = useParams<{ metricName: string }>();
  const [data, setData] = useState<MetricDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!metricName) return;
    
    // Generate mock detailed data for the metric
    const mockData: MetricDetail = {
      name: decodeURIComponent(metricName),
      current_value: 65.5,
      benchmark: 67.0,
      trend: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toLocaleDateString(),
        value: 60 + Math.random() * 10,
      })),
      by_state: [
        { state: "California", value: 68.2, delta: 1.2 },
        { state: "Texas", value: 62.1, delta: -4.9 },
        { state: "Florida", value: 64.8, delta: -2.2 },
        { state: "New York", value: 71.3, delta: 4.3 },
        { state: "Pennsylvania", value: 66.5, delta: -0.5 },
        { state: "Illinois", value: 63.8, delta: -3.2 },
        { state: "Ohio", value: 67.2, delta: 0.2 },
        { state: "Georgia", value: 59.4, delta: -7.6 },
        { state: "North Carolina", value: 61.2, delta: -5.8 },
        { state: "Michigan", value: 65.9, delta: -1.1 },
      ],
      anomalies: [
        { geography: "Puerto Rico", value: 35.8, expected: 67.0, severity: "high" },
        { geography: "Maricopa County, AZ", value: 52.3, expected: 65.0, severity: "high" },
        { geography: "Harris County, TX", value: 55.1, expected: 64.0, severity: "medium" },
        { geography: "Miami-Dade, FL", value: 58.2, expected: 66.0, severity: "medium" },
      ],
    };
    
    setData(mockData);
    setLoading(false);
  }, [metricName]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-10 h-10 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="p-2 hover:bg-white/10 rounded-lg transition">
          <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{data.name}</h1>
          <p className="text-sm text-census-gray-500">Detailed metric analysis</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
          <p className="text-xs text-census-gray-500 uppercase">Current Value</p>
          <p className="text-3xl font-bold text-white mt-1">{data.current_value}%</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
          <p className="text-xs text-census-gray-500 uppercase">Benchmark</p>
          <p className="text-3xl font-bold text-white mt-1">{data.benchmark}%</p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
          <p className="text-xs text-census-gray-500 uppercase">Gap</p>
          <p className="text-3xl font-bold text-red-400 mt-1">
            {(data.current_value - data.benchmark).toFixed(1)}%
          </p>
        </div>
        <div className="p-4 bg-slate-800/50 rounded-xl border border-white/5">
          <p className="text-xs text-census-gray-500 uppercase">Anomalies</p>
          <p className="text-3xl font-bold text-orange-400 mt-1">{data.anomalies.length}</p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">30-Day Trend</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[50, 80]} />
              <Tooltip
                contentStyle={{
                  background: "#1e293b",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "8px",
                }}
              />
              <defs>
                <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f94d3c" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#f94d3c" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="value"
                stroke="#f94d3c"
                fill="url(#trendGradient)"
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* State Breakdown and Anomalies */}
      <div className="grid grid-cols-2 gap-6">
        {/* By State */}
        <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Breakdown by State</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_state} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} domain={[50, 80]} />
                <YAxis
                  dataKey="state"
                  type="category"
                  width={100}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1e293b",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "8px",
                  }}
                />
                <Bar
                  dataKey="value"
                  fill="#f94d3c"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Anomalies */}
        <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Detected Anomalies</h3>
          <div className="space-y-3">
            {data.anomalies.map((a, i) => (
              <div
                key={i}
                className={`p-4 rounded-lg ${
                  a.severity === "high"
                    ? "bg-red-500/10 border border-red-500/20"
                    : "bg-orange-500/10 border border-orange-500/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{a.geography}</p>
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      a.severity === "high" ? "bg-red-500 text-white" : "bg-orange-500 text-white"
                    }`}
                  >
                    {a.severity.toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-sm">
                  <span className="text-white/80">
                    Actual: <strong className="text-white">{a.value}%</strong>
                  </span>
                  <span className="text-white/60">vs Expected: {a.expected}%</span>
                  <span className="text-red-400">
                    Gap: {(a.value - a.expected).toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Unity Catalog Link */}
      <div className="flex items-center justify-between text-sm p-4 bg-slate-800/50 rounded-xl border border-white/5">
        <div className="flex items-center gap-2 text-census-gray-500">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
          </svg>
          <span>Data sourced from census_operations_demo.operations.county_response_rates</span>
        </div>
        <a
          href={ucExploreUrl(host, "census_operations_demo/operations/county_response_rates")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary-400 hover:text-primary-300 flex items-center gap-1"
        >
          View in Unity Catalog
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>
    </div>
  );
}
