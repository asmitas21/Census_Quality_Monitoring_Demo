import { useEffect, useState, useMemo } from "react";
import { get } from "../api/client";
import { useWorkspaceHost, dashboardUrl } from "../hooks/useWorkspaceHost";

type Tier = { label: string; max: number; color: string };
type InputCol = { col: string; label: string; weight: string; source: string };
type TopCounty = { county_name: string; state_abbr: string; metric_value: string };

type DistStats = {
  min: string | null;
  max: string | null;
  p25: string | null;
  p75: string | null;
};

type DocLink = {
  label: string;
  url: string;
};

type CompositeMetric = {
  name: string;
  alias: string;
  yaml_measure: string;
  why: string;
  headline: string;
  high_count: number;
  doc_link: DocLink | null;
  uc_columns: string[];
  inputs: InputCol[];
  color: string;
  tiers: Tier[];
  live_value: string | null;
  source_table: string;
  dist: DistStats;
  top_counties: TopCounty[];
};

type CompositeResponse = {
  metrics: CompositeMetric[];
  total_counties: string | null;
  total_states: string | null;
  counties_below_60pct: string | null;
  source_table: string;
  source_table_url: string;
  workspace_host: string;
  all_states: string[];
  version: number;
  version_label: string;
  version_description: string;
  version_vintage: string;
  available_versions: { version: number; label: string; description: string; vintage: string }[];
};

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; dot: string; badge: string; bar: string }> = {
  red:    { bg: "bg-red-500/8",    text: "text-red-400",    border: "border-red-500/25",    dot: "bg-red-400",    badge: "bg-red-500/15 text-red-300",    bar: "bg-red-400" },
  blue:   { bg: "bg-blue-500/8",   text: "text-blue-400",   border: "border-blue-500/25",   dot: "bg-blue-400",   badge: "bg-blue-500/15 text-blue-300",   bar: "bg-blue-400" },
  purple: { bg: "bg-purple-500/8", text: "text-purple-400", border: "border-purple-500/25", dot: "bg-purple-400", badge: "bg-purple-500/15 text-purple-300", bar: "bg-purple-400" },
  orange: { bg: "bg-orange-500/8", text: "text-orange-400", border: "border-orange-500/25", dot: "bg-orange-400", badge: "bg-orange-500/15 text-orange-300", bar: "bg-orange-400" },
  green:  { bg: "bg-green-500/8",  text: "text-green-400",  border: "border-green-500/25",  dot: "bg-green-400",  badge: "bg-green-500/15 text-green-300",  bar: "bg-green-400" },
};

const TIER_COLORS: Record<string, string> = {
  green:  "text-green-400",
  yellow: "text-yellow-400",
  orange: "text-orange-400",
  red:    "text-red-400",
};

function getTier(value: number, tiers: Tier[]): Tier {
  for (const t of tiers) {
    if (value <= t.max) return t;
  }
  return tiers[tiers.length - 1];
}

function barPct(value: number, max: number): number {
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export default function MetricViews() {
  const host = useWorkspaceHost();
  const [compositeData, setCompositeData] = useState<CompositeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedComposite, setExpandedComposite] = useState<string | null>(null);
  const [stateFilter, setStateFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    get<CompositeResponse>("/snapshot/composite-metrics")
      .then(setCompositeData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const states = useMemo(() => compositeData?.all_states ?? [], [compositeData]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!compositeData || compositeData.metrics.length === 0) return null;

  return (
    <div className="space-y-5">
      {/* Header — buttons only, no title or subtitle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* State filter */}
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary-400"
          >
            <option value="">All States</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="text-xs text-census-gray-500">
            {compositeData.total_counties && (
              <>{Number(compositeData.total_counties).toLocaleString()} counties</>
            )}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={dashboardUrl(host, "01f122fc869c12ab815025dd13ffbf45") + "#composite_metrics"}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-white/8 hover:bg-white/12 text-white border border-white/15 rounded-lg text-sm font-medium transition flex items-center gap-2"
          >
            <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View in AI/BI Dashboard
          </a>
        </div>
      </div>

      {/* Composite metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {compositeData.metrics.map((metric) => {
          const c = COLOR_MAP[metric.color] || COLOR_MAP.blue;
          const isOpen = expandedComposite === metric.name;
          const numVal = metric.live_value !== null && metric.live_value !== undefined
            ? parseFloat(metric.live_value)
            : null;
          const tier = numVal !== null && metric.tiers ? getTier(numVal, metric.tiers) : null;
          const distMin = metric.dist?.min !== null ? parseFloat(metric.dist?.min ?? "0") : null;
          const distMax = metric.dist?.max !== null ? parseFloat(metric.dist?.max ?? "100") : null;

          const filteredCounties = stateFilter
            ? metric.top_counties.filter((county) => county.state_abbr === stateFilter)
            : metric.top_counties;

          const docLink = metric.doc_link;

          return (
            <div key={metric.name} className={`rounded-xl border ${c.border} ${c.bg} p-5 flex flex-col gap-3`}>

              {/* ── HEADER: name + headline ── */}
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${c.dot} flex-shrink-0`} />
                  <h3 className="text-sm font-semibold text-white">{metric.name}</h3>
                </div>
                <p className={`text-sm leading-snug ${metric.high_count > 0 ? "text-white/90" : "text-census-gray-400"}`}>
                  {metric.headline}
                </p>
              </div>

              {/* ── WHY ── */}
              <p className="text-xs text-census-gray-400 leading-relaxed">
                {metric.why}
                {docLink && (
                  <>
                    {" "}
                    <a
                      href={docLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400/80 hover:text-blue-300 underline underline-offset-2 transition"
                    >
                      {docLink.label} ↗
                    </a>
                  </>
                )}
              </p>

              {/* ── WHERE: top affected counties (filtered by state) ── */}
              <div>
                <p className="text-[10px] text-census-gray-500 uppercase tracking-wide font-medium mb-1.5">
                  Most affected counties{stateFilter ? ` in ${stateFilter}` : ""}
                </p>
                {filteredCounties.length > 0 ? (
                  <div className="space-y-0.5">
                    {filteredCounties.map((county, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] px-2 py-1.5 bg-white/3 rounded">
                        <span className="text-census-gray-600 w-4 text-right">{i + 1}.</span>
                        <span className="text-white font-medium truncate">{county.county_name}, {county.state_abbr}</span>
                        <span className={`ml-auto flex-shrink-0 font-mono font-semibold ${c.text}`}>
                          {parseFloat(county.metric_value).toFixed(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-census-gray-600 italic px-2 py-1.5">
                    No counties flagged in {stateFilter} for this metric
                  </p>
                )}
              </div>

              {/* ── UC LINEAGE FOOTER ── */}
              <div className="flex items-center gap-1.5 pt-2 border-t border-white/5 text-[10px] text-census-gray-600">
                <span>Source:</span>
                <span className="text-blue-400/70 font-mono">
                  {metric.source_table?.replace("census_operations_demo.", "") || "operations.root_cause_join"}
                </span>
                <span>→</span>
                <span className="font-mono text-census-gray-500 truncate">
                  {(metric.uc_columns || []).join(", ")}
                </span>
              </div>

              {/* ── TECHNICAL DETAIL (collapsed) ── */}
              <button
                onClick={() => setExpandedComposite(isOpen ? null : metric.name)}
                className="text-[10px] text-census-gray-600 hover:text-census-gray-400 flex items-center gap-1 transition"
              >
                <svg className={`w-3 h-3 transition-transform ${isOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                {isOpen ? "Hide" : "Show"} technical detail
              </button>

              {isOpen && (
                <div className="space-y-3 pt-1 text-[11px]">
                  {/* Tier thresholds */}
                  {metric.tiers && tier && (
                    <div className="flex gap-1">
                      {metric.tiers.map((t) => (
                        <span key={t.label} className={`px-2 py-0.5 rounded text-[10px] ${
                          tier?.label === t.label ? `${TIER_COLORS[t.color]} bg-white/10 border border-white/15` : "text-census-gray-700 bg-white/3"
                        }`}>{t.label} ≤{t.max}</span>
                      ))}
                    </div>
                  )}
                  {/* Distribution bar: min → Avg → max */}
                  {numVal !== null && distMin !== null && distMax !== null && (
                    <div>
                      <div className="flex items-center justify-between text-[10px] text-census-gray-600 mb-1">
                        <span>min {distMin.toFixed(1)}</span>
                        <span className={`font-semibold ${c.text}`}>Avg {numVal.toFixed(1)}</span>
                        <span>max {distMax.toFixed(1)}</span>
                      </div>
                      <div className="relative h-3 rounded-full bg-white/5">
                        <div className={`absolute top-0 h-full w-0.5 ${c.bar}`}
                          style={{ left: `${barPct(numVal, distMax)}%` }} />
                        <div className="absolute -top-0.5 text-[8px] font-bold text-white"
                          style={{ left: `${Math.max(0, Math.min(90, barPct(numVal, distMax) - 2))}%` }}>
                          ▼
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Input columns */}
                  {metric.inputs && metric.inputs.length > 0 && (
                    <div className="space-y-1">
                      {metric.inputs.map((inp) => (
                        <div key={inp.col} className="flex items-center gap-2">
                          <code className="font-mono text-blue-400 bg-blue-500/8 px-1 py-0.5 rounded text-[10px]">{inp.col}</code>
                          <span className="text-census-gray-400 truncate">{inp.label}</span>
                          {inp.weight !== "—" && <span className={`ml-auto px-1 py-0.5 rounded text-[10px] font-mono ${c.badge}`}>{inp.weight}</span>}
                          <span className="text-census-gray-600 text-[10px]">{inp.source}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* YAML */}
                  <pre className="text-[10px] font-mono bg-slate-950 border border-white/5 rounded px-3 py-2 text-green-300/70 whitespace-pre overflow-x-auto">
{metric.yaml_measure}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
