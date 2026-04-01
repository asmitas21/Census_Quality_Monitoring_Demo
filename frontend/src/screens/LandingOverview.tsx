import { useEffect, useState, useCallback, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import GenieSearch from "../components/GenieSearch";
import { KPICard } from "../components/KPICard";
import { ResponseHistogram } from "../components/ResponseHistogram";
import { FactorExplorer } from "../components/FactorExplorer";
import { MiniNationalMap } from "../components/MiniNationalMap";
import { CountyExplorer } from "../components/CountyExplorer";
import { CountyFilterBar } from "../components/CountyFilterBar";
import { get } from "../api/client";
import { useFilterStore } from "../store/filters";

type KPI = {
  name: string;
  value: number;
  benchmark: number;
  delta_pct: number;
  unit: string;
  lower_is_better: boolean;
  trend: string;
  sparkline: number[];
  description?: string;
};
type Anomaly = { 
  id: string; 
  kpi: string; 
  geography: string; 
  geography_id?: string;
  delta_pct: number; 
  severity: string;
  value?: number;
  benchmark?: number;
};
type Hotspot = { geography_id: string; geography: string; delta_pct: number; kpi: string; level: string; value?: number; benchmark?: number };
type QualityBand = { band: string; pct: number; color: string; description: string };
type HighRiskCounty = {
  county_fips: string;
  county_name: string;
  state_abbr: string;
  risk_score: number;
  top_factor: string;
  top_factor_weight: number;
  score_delta: number;
  is_trending: boolean;
  crrall: number | null;
  score_updated_at: string;
};
type SnapshotOverview = {
  kpis: KPI[];
  top_anomalies: Anomaly[];
  hotspots: Hotspot[];
  quality_bands: { bands: QualityBand[]; total_records: number };
  last_refreshed: string;
  kpi_group: string;
  ai_summary?: string;
  data_source?: string;
  national_benchmarks?: Record<string, number>;
};

type Filters = {
  state: string | null;
  risk_factor: string | null;
  crrall_min: number | null;
  crrall_max: number | null;
  trending_only: boolean;
};

export default function LandingOverview() {
  const [data, setData] = useState<SnapshotOverview | null>(null);
  const [highRiskCounties, setHighRiskCounties] = useState<HighRiskCounty[]>([]);
  const [countiesLoading, setCountiesLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    state: null,
    risk_factor: null,
    crrall_min: null,
    crrall_max: null,
    trending_only: false,
  });
  const [selectedBucket, setSelectedBucket] = useState<{ min: number; max: number } | null>(null);
  const highRiskRef = useRef<HTMLDivElement>(null);
  
  const { timeWindow, kpiGroup, benchmarkSet, geography } = useFilterStore();
  const navigate = useNavigate();

  useEffect(() => {
    setData(null);
    const params: Record<string, string> = { time_window: timeWindow, kpi_group: kpiGroup || "response_rate", benchmark_set: benchmarkSet };
    if (geography) params.geography = geography;
    get<SnapshotOverview>("/snapshot/overview", params).then(setData);
  }, [timeWindow, kpiGroup, benchmarkSet, geography]);

  const fetchFilteredCounties = useCallback(() => {
    setCountiesLoading(true);

    // When a histogram bucket is selected, fetch ALL counties in that CRRALL range
    if (selectedBucket) {
      const params: Record<string, string> = {
        crrall_min: String(selectedBucket.min),
        crrall_max: String(selectedBucket.max),
        limit: "30",
      };
      get<{ counties: HighRiskCounty[] }>("/snapshot/counties-by-range", params)
        .then((res) => setHighRiskCounties(res.counties || []))
        .catch(() => setHighRiskCounties([]))
        .finally(() => setCountiesLoading(false));
      return;
    }

    // Otherwise use the high-risk filter
    const params: Record<string, string> = { 
      min_risk_score: "0.75", 
      limit: "12" 
    };
    if (filters.state) params.state = filters.state;
    if (filters.risk_factor) params.risk_factor = filters.risk_factor;
    if (filters.crrall_min !== null) params.crrall_min = String(filters.crrall_min);
    if (filters.crrall_max !== null) params.crrall_max = String(filters.crrall_max);
    if (filters.trending_only) params.trending_only = "true";
    
    get<{ counties: HighRiskCounty[] }>("/snapshot/high-risk-counties-filtered", params)
      .then((res) => setHighRiskCounties(res.counties || []))
      .catch(() => setHighRiskCounties([]))
      .finally(() => setCountiesLoading(false));
  }, [filters, selectedBucket]);

  useEffect(() => {
    fetchFilteredCounties();
  }, [fetchFilteredCounties]);

  const handleBucketClick = (min: number, max: number) => {
    if (selectedBucket && selectedBucket.min === min && selectedBucket.max === max) {
      setSelectedBucket(null);
      setFilters((f) => ({ ...f, crrall_min: null, crrall_max: null }));
    } else {
      setSelectedBucket({ min, max });
      setFilters((f) => ({ ...f, crrall_min: min, crrall_max: max }));
    }
    setTimeout(() => {
      highRiskRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const handleFilterChange = (newFilters: Filters) => {
    setFilters(newFilters);
    if (newFilters.crrall_min !== filters.crrall_min || newFilters.crrall_max !== filters.crrall_max) {
      setSelectedBucket(
        newFilters.crrall_min !== null && newFilters.crrall_max !== null
          ? { min: newFilters.crrall_min, max: newFilters.crrall_max }
          : null
      );
    }
  };

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-slate-800/50 rounded-2xl animate-pulse" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-32 bg-slate-800/50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  const kpiGroupLabels: Record<string, string> = { 
    quality: "Data Quality", 
    response_rate: "Response Rates", 
    coverage: "Coverage", 
    operations: "Operations" 
  };


  return (
    <div className="space-y-6">
      {/* Hero Section with Genie Search */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-800 via-slate-850 to-slate-900 border border-white/5 p-6 lg:p-8">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyek0zNiAxNHYySDE0di0yaDIyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        
        <div className="relative">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <div className="px-3 py-1 bg-primary-500/30 border border-primary-500/40 rounded-full">
                  <span className="text-xs font-medium text-white">
                    {kpiGroupLabels[data.kpi_group] || data.kpi_group}
                  </span>
                </div>
                <span className="text-xs text-census-gray-500">
                  Updated {new Date(data.last_refreshed).toLocaleTimeString()}
                </span>
              </div>
              
              <h1 className="text-3xl lg:text-4xl font-bold text-white mb-2">
                Census Operations Command Center
              </h1>
              <p className="text-white/75 max-w-xl">
                Real-time operational intelligence for the 2030 Decennial Census. 
                Powered by live Census Bureau data with AI-driven insights.
              </p>

              <div className="flex flex-wrap gap-4 mt-6">
                <div className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <span className="text-2xl font-bold text-blue-400">51</span>
                  <span className="text-xs text-blue-400">States<br/>Tracked</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                  <span className="text-2xl font-bold text-green-400">3,208</span>
                  <span className="text-xs text-green-400">Counties<br/>Monitored</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                  <span className="text-2xl font-bold text-purple-400">202</span>
                  <span className="text-xs text-purple-400">Census<br/>Tracts</span>
                </div>
              </div>
            </div>

            <div className="lg:w-[480px]">
              <div className="mb-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Ask Census Intelligence
                </h3>
                <p className="text-xs text-census-gray-500 mt-1">
                  Query your data in plain English using Databricks Genie
                </p>
              </div>
              <GenieSearch />
            </div>
          </div>
        </div>
      </div>

      {/* KPI Section Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Key Performance Indicators
        </h2>
        <p className="text-xs text-census-gray-500">Click any metric for details, or info icon for lineage</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {data.kpis.map((kpi) => (
          <KPICard
            key={kpi.name}
            name={kpi.name}
            value={kpi.value}
            benchmark={kpi.benchmark}
            delta_pct={kpi.delta_pct}
            unit={kpi.unit}
            lower_is_better={kpi.lower_is_better}
            sparkline={kpi.sparkline}
          />
        ))}
      </div>

      {/* Section 1: Response Rate Distribution Histogram */}
      <ResponseHistogram 
        onBucketClick={handleBucketClick} 
        selectedBucket={selectedBucket}
      />

      {/* Section 2: Correlation Scatterplots */}
      <FactorExplorer />

      {/* Section 3: Mini National Map */}
      <MiniNationalMap />

      {/* Section 4: County Explorer */}
      <CountyExplorer />

      {/* Filter Bar */}
      <div ref={highRiskRef} className="flex items-center justify-between scroll-mt-4">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {selectedBucket ? `Counties (${selectedBucket.min}-${selectedBucket.max}% CRRALL)` : "High-Risk Counties"}
          {countiesLoading && (
            <span className="flex items-center gap-2 ml-2">
              <svg className="w-4 h-4 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-primary-400">Querying Unity Catalog...</span>
            </span>
          )}
        </h2>
        <span className="text-xs text-census-gray-500 flex items-center gap-1">
          <span className="px-2 py-0.5 bg-slate-800 rounded text-census-gray-400">Model Serving</span>
          risk_score &gt; 0.75
        </span>
      </div>

      <CountyFilterBar filters={filters} onFilterChange={handleFilterChange} />
      
      {countiesLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-4 rounded-xl bg-slate-800/50 border border-white/5 animate-pulse">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-32 bg-slate-700 rounded" />
                <div className="h-6 w-12 bg-slate-700 rounded ml-auto" />
              </div>
              <div className="h-4 w-24 bg-slate-700 rounded mb-2" />
              <div className="h-3 w-full bg-slate-700 rounded mb-3" />
              <div className="h-8 w-full bg-slate-700 rounded" />
            </div>
          ))}
        </div>
      ) : highRiskCounties.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {highRiskCounties.map((county) => (
            <div
              key={county.county_fips}
              className={`p-4 rounded-xl transition-all hover:scale-[1.01] ${
                county.risk_score > 0.85 
                  ? 'bg-gradient-to-br from-red-500/20 to-red-600/10 border border-red-500/30' 
                  : 'bg-gradient-to-br from-orange-500/20 to-orange-600/10 border border-orange-500/30'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold text-white text-sm">{county.county_name}</h4>
                  <p className="text-xs text-census-gray-400">{county.state_abbr}</p>
                </div>
                <div className={`px-2 py-1 rounded-lg text-sm font-bold ${
                  county.risk_score > 0.85 
                    ? 'bg-red-500/30 text-red-300' 
                    : 'bg-orange-500/30 text-orange-300'
                }`}>
                  {(county.risk_score * 100).toFixed(0)}%
                </div>
              </div>

              {county.crrall !== null && (
                <p className="text-xs text-census-gray-400 mb-2">
                  Self-Response: <span className="text-white font-medium">{county.crrall.toFixed(1)}%</span>
                </p>
              )}

              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 bg-slate-800/80 rounded text-xs text-census-gray-300">
                  {county.top_factor}
                </span>
                {county.is_trending && (
                  <span className="px-2 py-0.5 bg-orange-500/20 border border-orange-500/30 rounded text-xs text-orange-400 flex items-center gap-1">
                    <span>↑</span> Trending
                  </span>
                )}
              </div>

              <button
                onClick={() => navigate(`/investigate?county_fips=${county.county_fips}`)}
                className="w-full py-2 px-4 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition flex items-center justify-center gap-2"
              >
                Investigate
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 rounded-xl bg-slate-800/30 border border-white/5 text-center">
          <svg className="w-12 h-12 text-census-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-white/60 text-sm">
            {selectedBucket
              ? `No high-risk counties in the ${selectedBucket.min}-${selectedBucket.max}% response rate range`
              : filters.state || filters.risk_factor || filters.trending_only
                ? "No counties match the selected filters"
                : "No high-risk counties detected (risk_score > 0.75)"}
          </p>
          {(selectedBucket || filters.state || filters.risk_factor || filters.crrall_min !== null || filters.trending_only) && (
            <button
              onClick={() => {
                setSelectedBucket(null);
                setFilters({
                  state: null,
                  risk_factor: null,
                  crrall_min: null,
                  crrall_max: null,
                  trending_only: false,
                });
              }}
              className="mt-3 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Footer Info */}
      <div className="flex items-center justify-between text-xs text-census-gray-600 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4">
          <span>Data: 2020 Decennial Census + ACS 5-Year Estimates</span>
          <span>•</span>
          <span className="text-green-500">Unity Catalog Governed</span>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/metrics" className="text-primary-400 hover:text-primary-300">
            View Metric Lineage →
          </Link>
        </div>
      </div>
    </div>
  );
}
