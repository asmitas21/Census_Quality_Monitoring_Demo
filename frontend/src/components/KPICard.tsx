import { useState } from "react";
import { ResponsiveContainer, AreaChart, Area } from "recharts";
import { useWorkspaceHost } from "../hooks/useWorkspaceHost";

interface KPICardProps {
  name: string;
  value: number;
  benchmark: number;
  delta_pct: number;
  unit: string;
  lower_is_better: boolean;
  sparkline: number[];
  description?: string;
  sourceTable?: string;
  formula?: string;
  lastRefreshed?: string;
}

interface LineageInfo {
  table: string;
  catalog: string;
  schema: string;
  columns: string[];
  formula: string;
  refreshFrequency: string;
}

const METRIC_LINEAGE: Record<string, LineageInfo> = {
  "Self-Response Rate": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall"],
    formula: "AVG(crrall) — % of housing units that submitted a Census form without an enumerator visit (all modes: internet, mail, phone, drop-box). National 2020 target: 67%.",
    refreshFrequency: "Daily during self-response phase",
  },
  "Internet Response": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrint"],
    formula: "AVG(crrint) — % of housing units that responded via internet only. National 2020 avg: ~52%. Gap vs CRRALL = paper/phone respondents.",
    refreshFrequency: "Daily during enumeration",
  },
  "Internet Response Rate": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrint"],
    formula: "AVG(crrint) — % of housing units that responded via internet only.",
    refreshFrequency: "Daily during enumeration",
  },
  "Mail Response": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall", "crrint"],
    formula: "AVG(crrall - crrint) — estimated paper/phone respondents = all-mode rate minus internet rate. Directly drives paper questionnaire print runs and call-center staffing.",
    refreshFrequency: "Daily during enumeration",
  },
  "Mail Response Rate": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall", "crrint"],
    formula: "AVG(crrall - crrint) — all-mode minus internet-only response.",
    refreshFrequency: "Daily during enumeration",
  },
  "NRFU Response Rate": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "% of Non-Response Follow-Up cases resolved after enumerator visit. Benchmark: 93%. Cases remaining after NRFU drive final imputation.",
    refreshFrequency: "Daily during NRFU operations",
  },
  "NRFU Completion Rate": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "% of Non-Response Follow-Up workload completed. Benchmark: 93%.",
    refreshFrequency: "Daily during NRFU operations",
  },
  "Overall Response Rate": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall"],
    formula: "Final combined rate after self-response + NRFU. Target: 94.2%. Remaining non-response goes to imputation, increasing differential undercount risk.",
    refreshFrequency: "Daily",
  },
  "Completeness": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall"],
    formula: "% of returned forms with all required fields populated. Missing fields trigger edit and imputation workflows. Benchmark: 97.5%.",
    refreshFrequency: "Daily",
  },
  "Valid Records": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall"],
    formula: "% of submitted records passing all edit checks. Invalid records require manual review. Benchmark: 99%.",
    refreshFrequency: "Daily",
  },
  "Duplicate Rate": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "% of submitted forms flagged as potential duplicates. High rates inflate population counts before deduplication. Benchmark: <1.2%.",
    refreshFrequency: "Daily",
  },
  "Edit Rate": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["crrall"],
    formula: "% of forms requiring content edits (inconsistent or missing responses). Benchmark: <3.5%.",
    refreshFrequency: "Daily",
  },
  "Item Non-Response": {
    table: "root_cause_join",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["pct_spanish_limited_english"],
    formula: "% of returned forms with at least one unanswered question. Benchmark: <4.8%. Correlated with language barrier (pct_spanish_limited_english).",
    refreshFrequency: "Daily",
  },
  "Workload Completion": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "% of assigned NRFU cases closed by enumerators. Benchmark: 88.5%. Low rates in high-risk counties delay final count.",
    refreshFrequency: "Daily",
  },
  "Enumerator Productivity": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "Cases completed per enumerator per hour. Benchmark: 4.2 cases/hr. Drops in high-barrier counties (broadband gap, undeliverable addresses).",
    refreshFrequency: "Daily",
  },
  "Cost Per Case": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "Total operational cost ÷ resolved NRFU cases. Benchmark: $48.60. Rises sharply in rural/remote counties with high pct_no_broadband.",
    refreshFrequency: "Daily",
  },
  "Contact Attempt Rate": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "% of NRFU cases with at least one enumerator contact attempt logged. Benchmark: 95.1%.",
    refreshFrequency: "Daily",
  },
  "Proxy Rate": {
    table: "anomaly_scores",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["risk_score"],
    formula: "% of NRFU cases resolved via proxy (neighbor/landlord response instead of resident). Benchmark: <11.2%. High proxy rates increase imputation error.",
    refreshFrequency: "Daily",
  },
};

export function KPICard({
  name,
  value,
  benchmark,
  delta_pct,
  unit,
  lower_is_better,
  sparkline,
}: KPICardProps) {
  const host = useWorkspaceHost();
  const [showLineage, setShowLineage] = useState(false);
  
  const isGood = lower_is_better ? delta_pct < 0 : delta_pct > 0;
  const isBad = lower_is_better ? delta_pct > 10 : delta_pct < -10;
  
  const lineage = METRIC_LINEAGE[name] || {
    table: "county_response_rates",
    catalog: "census_operations_demo",
    schema: "operations",
    columns: ["value"],
    formula: "Direct measurement",
    refreshFrequency: "Daily",
  };

  const ucUrl = host ? `${host}/explore/data/${lineage.catalog}/${lineage.schema}/${lineage.table}` : "#";

  return (
    <div className="relative">
      <div
        className={`p-4 rounded-xl bg-slate-800/50 border transition-all hover:bg-slate-800 ${
          isBad ? "border-red-500/30" : isGood ? "border-green-500/30" : "border-white/5"
        }`}
      >
        <div className="flex items-start justify-between">
          <p className="text-xs text-census-gray-500 font-medium uppercase tracking-wide truncate flex-1">
            {name}
          </p>
          <button
            onClick={() => setShowLineage(!showLineage)}
            className="p-1 hover:bg-white/10 rounded transition ml-1"
            title="View data lineage"
          >
            <svg className="w-4 h-4 text-census-gray-500 hover:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-end justify-between mt-2">
          <p className="text-2xl font-bold text-white">
            {unit === "$" ? `$${value}` : `${value}${unit}`}
          </p>
          <span className={`text-sm font-medium px-2 py-0.5 rounded ${
            isGood ? "bg-green-500/20 text-green-400" : 
            isBad ? "bg-red-500/20 text-red-400" : 
            "bg-white/5 text-census-gray-400"
          }`}>
            {delta_pct > 0 ? "+" : ""}{delta_pct}%
          </span>
        </div>
        
        <p className="text-xs text-census-gray-600 mt-1">
          vs {benchmark}{unit} benchmark
        </p>
        
        <div className="mt-3 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkline.map((v, i) => ({ v, i }))}>
              <defs>
                <linearGradient id={`gradient-${name.replace(/\s+/g, "-")}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={isBad ? "#ef4444" : isGood ? "#22c55e" : "#f94d3c"} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={isBad ? "#ef4444" : isGood ? "#22c55e" : "#f94d3c"} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey="v" 
                stroke={isBad ? "#ef4444" : isGood ? "#22c55e" : "#f94d3c"} 
                fill={`url(#gradient-${name.replace(/\s+/g, "-")})`}
                strokeWidth={1.5}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Context Popup */}
      {showLineage && (
        <div className="absolute z-50 top-full left-0 right-0 mt-2 p-4 bg-slate-900 border border-white/10 rounded-xl shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-white">How this is calculated</h4>
            <button onClick={() => setShowLineage(false)} className="text-white/50 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <div className="space-y-3 text-xs">
            <div className="px-3 py-2.5 bg-white/5 rounded-lg border border-white/8">
              <p className="text-white/90 leading-relaxed">{lineage.formula}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <div>
                <p className="text-census-gray-500 mb-1">Source table</p>
                <a href={ucUrl} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-mono transition">
                  {lineage.catalog}.{lineage.schema}.{lineage.table} ↗
                </a>
              </div>
              <div>
                <p className="text-census-gray-500 mb-1">Columns</p>
                <div className="flex flex-wrap gap-1">
                  {lineage.columns.map((col) => (
                    <span key={col} className="px-1.5 py-0.5 bg-blue-500/10 border border-blue-500/20 rounded text-blue-300 font-mono">{col}</span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-census-gray-500 mb-1">Refresh</p>
                <p className="text-white/70">{lineage.refreshFrequency}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
