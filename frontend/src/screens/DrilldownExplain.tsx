import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  BarChart, Bar, Cell,
  PieChart, Pie,
} from "recharts";
import Card from "../components/Card";
import SeverityBadge from "../components/SeverityBadge";
import Skeleton from "../components/Skeleton";
import Button from "../components/Button";
import AiChat from "../components/AiChat";
import { get, post } from "../api/client";

type TrendPoint = { period: string; value: number; benchmark: number };
type Contributor = { geography: string; contribution_pct: number; delta_pct: number };
type CollectionMode = { mode: string; value: number; benchmark: number; delta_pct: number; count: number };
type QualityBand = { band: string; pct: number; color: string; description: string };
type DemographicItem = { category: string; value: number; benchmark: number; delta_pct: number };

type Drilldown = {
  anomaly_id: string;
  kpi: string;
  geography: string;
  severity: string;
  delta_pct: number;
  persistence_weeks: number;
  trend: TrendPoint[];
  top_contributors: Contributor[];
  distribution: string;
  collection_modes: CollectionMode[];
  quality_bands: { bands: QualityBand[]; total_records: number };
};

type GeographyChild = { id: string; name: string; level: string };

export default function DrilldownExplain() {
  const [params] = useSearchParams();
  const anomalyId = params.get("anomaly_id") || "a1";
  const [data, setData] = useState<Drilldown | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [demographics, setDemographics] = useState<DemographicItem[] | null>(null);
  const [demoDimension, setDemoDimension] = useState("age_group");
  const [geoChildren, setGeoChildren] = useState<GeographyChild[]>([]);
  const [geoLevel, setGeoLevel] = useState("state");
  const [geoParent, setGeoParent] = useState<string | null>(null);
  const [geoBreadcrumb, setGeoBreadcrumb] = useState<{ id: string | null; name: string; level: string }[]>([
    { id: null, name: "All States", level: "state" },
  ]);

  useEffect(() => {
    setData(null);
    setAiExplanation(null);
    get<Drilldown>("/drilldown", { anomaly_id: anomalyId }).then(setData);
  }, [anomalyId]);

  useEffect(() => {
    const p: Record<string, string> = { level: geoLevel };
    if (geoParent) p.parent_id = geoParent;
    get<{ children: GeographyChild[] }>("/drilldown/geography", p).then((r) => setGeoChildren(r.children));
  }, [geoLevel, geoParent]);

  useEffect(() => {
    if (data) {
      get<{ items: DemographicItem[] }>("/drilldown/demographics", {
        kpi_name: data.kpi,
        dimension: demoDimension,
      }).then((r) => setDemographics(r.items));
    }
  }, [data, demoDimension]);

  const handleAiExplain = async () => {
    setAiLoading(true);
    try {
      const res = await post<{ explanation: string }>("/ai/explain", { anomaly_id: anomalyId });
      setAiExplanation(res.explanation);
    } catch {
      setAiExplanation("Unable to generate AI explanation. Please try again.");
    }
    setAiLoading(false);
  };

  const handleGeoClick = (child: GeographyChild) => {
    const nextLevels: Record<string, string> = { state: "county", county: "tract", tract: "block_group" };
    const next = nextLevels[child.level];
    if (next) {
      setGeoParent(child.id);
      setGeoLevel(next);
      setGeoBreadcrumb((prev) => [...prev, { id: child.id, name: child.name, level: next }]);
    }
  };

  const handleBreadcrumbClick = (index: number) => {
    const crumb = geoBreadcrumb[index];
    setGeoParent(crumb.id);
    setGeoLevel(crumb.level);
    setGeoBreadcrumb(geoBreadcrumb.slice(0, index + 1));
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <Skeleton variant="text" rows={2} />
        <Skeleton variant="chart" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton variant="chart" />
          <Skeleton variant="card" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with anomaly context */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-census-gray-800">Drilldown & Explainability</h1>
          <div className="flex items-center gap-3 mt-2">
            <SeverityBadge severity={data.severity as "high" | "medium" | "low"} />
            <span className="text-sm text-census-gray-600">
              <strong>{data.kpi}</strong> in {data.geography}
            </span>
            <span className="text-sm text-census-gray-500">
              {data.delta_pct > 0 ? "+" : ""}{data.delta_pct}% &middot; {data.persistence_weeks}w persistence
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleAiExplain} disabled={aiLoading} className="text-sm">
            {aiLoading ? "Analyzing..." : "AI Explain"}
          </Button>
          <Link to="/anomalies">
            <Button variant="ghost" className="text-sm">&larr; Back to anomalies</Button>
          </Link>
        </div>
      </div>

      {/* AI Explanation panel */}
      {aiExplanation && (
        <Card className="border-l-4 border-l-census-blue bg-census-blue/[0.02]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-base">&#9883;</span>
            <h3 className="font-semibold text-census-gray-800 text-sm">AI Analysis</h3>
          </div>
          <div className="text-sm text-census-gray-700 whitespace-pre-wrap leading-relaxed">{aiExplanation}</div>
        </Card>
      )}

      {/* Trend chart with benchmark line */}
      <Card title={`Trend — ${data.kpi}`}>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
              <XAxis dataKey="period" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12 }} />
              <ReferenceLine
                y={data.trend[0]?.benchmark}
                stroke="#9e9e9e"
                strokeDasharray="5 5"
                label={{ value: "Benchmark", position: "right", fontSize: 10, fill: "#757575" }}
              />
              <Line type="monotone" dataKey="value" stroke="#002e5d" strokeWidth={2} dot={{ r: 3, fill: "#002e5d" }} name="Value" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top contributors bar chart */}
        <Card title="Top Contributing Sub-Areas">
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.top_contributors.slice(0, 5)} layout="vertical" margin={{ left: 10, right: 30 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} unit="%" />
                <YAxis dataKey="geography" type="category" tick={{ fontSize: 10 }} width={130} />
                <Tooltip formatter={(v: number) => [`${v}%`, "Contribution"]} contentStyle={{ fontSize: 12 }} />
                <Bar dataKey="contribution_pct" radius={[0, 4, 4, 0]}>
                  {data.top_contributors.slice(0, 5).map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#b71c1c" : i === 1 ? "#e65100" : "#002e5d"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Collection mode breakdown */}
        <Card title="Collection Mode Breakdown">
          <div className="space-y-2">
            {data.collection_modes.map((m) => {
              const width = Math.min(100, Math.max(5, (m.value / (m.benchmark * 1.3)) * 100));
              const isAbove = m.delta_pct > 0;
              return (
                <div key={m.mode}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="font-medium text-census-gray-700">{m.mode}</span>
                    <span className={isAbove ? "text-severity-ok" : "text-severity-high"}>
                      {m.value} ({m.delta_pct > 0 ? "+" : ""}{m.delta_pct}%)
                    </span>
                  </div>
                  <div className="w-full bg-census-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${isAbove ? "bg-severity-ok" : "bg-census-blue"}`}
                      style={{ width: `${width}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-census-gray-400">{m.count.toLocaleString()} responses</p>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demographics breakdown */}
        <Card title="Demographic Breakdown">
          <div className="flex gap-2 mb-4">
            {["age_group", "sex", "race", "tenure"].map((dim) => (
              <button
                key={dim}
                onClick={() => setDemoDimension(dim)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition ${
                  demoDimension === dim
                    ? "bg-census-blue text-white"
                    : "bg-census-gray-200 text-census-gray-600 hover:bg-census-gray-300"
                }`}
              >
                {dim.replace("_", " ")}
              </button>
            ))}
          </div>
          {demographics ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={demographics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="category" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <ReferenceLine y={demographics[0]?.benchmark} stroke="#9e9e9e" strokeDasharray="5 5" />
                  <Bar dataKey="value" fill="#004b87" radius={[4, 4, 0, 0]}>
                    {demographics.map((d, i) => (
                      <Cell key={i} fill={d.delta_pct < -10 ? "#b71c1c" : d.delta_pct > 5 ? "#2e7d32" : "#004b87"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <Skeleton variant="chart" />
          )}
        </Card>

        {/* Quality bands for this geography */}
        <Card title="Quality Bands — This Geography">
          <div className="h-40 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.quality_bands.bands}
                  dataKey="pct"
                  nameKey="band"
                  cx="50%"
                  cy="50%"
                  innerRadius={35}
                  outerRadius={60}
                  paddingAngle={2}
                >
                  {data.quality_bands.bands.map((b) => (
                    <Cell key={b.band} fill={b.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v}%`]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-1 mt-2">
            {data.quality_bands.bands.map((b) => (
              <div key={b.band} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: b.color }} />
                  <span className="font-medium">{b.band}</span>
                </div>
                <span>{b.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Geography hierarchy drilldown */}
      <Card title="Geography Hierarchy">
        <div className="flex items-center gap-1 text-xs text-census-gray-500 mb-3">
          {geoBreadcrumb.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <span>&rsaquo;</span>}
              <button
                onClick={() => handleBreadcrumbClick(i)}
                className={`hover:underline ${i === geoBreadcrumb.length - 1 ? "text-census-blue font-medium" : ""}`}
              >
                {crumb.name}
              </button>
            </span>
          ))}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {geoChildren.map((child) => (
            <button
              key={child.id}
              onClick={() => handleGeoClick(child)}
              className="text-left px-3 py-2 rounded border border-census-gray-200 hover:border-census-blue hover:bg-census-blue/5 transition text-sm"
            >
              <span className="font-medium text-census-gray-800">{child.name}</span>
              <span className="block text-xs text-census-gray-500">{child.id}</span>
            </button>
          ))}
          {geoChildren.length === 0 && (
            <p className="text-sm text-census-gray-500 col-span-full">No sub-geographies at this level.</p>
          )}
        </div>
      </Card>

      {/* AI Chat */}
      <AiChat anomalyId={anomalyId} className="max-w-2xl" />
    </div>
  );
}
