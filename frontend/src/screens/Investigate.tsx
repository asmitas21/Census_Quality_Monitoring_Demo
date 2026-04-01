import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { get } from "../api/client";

type CountyInfo = {
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

type RiskScoreData = {
  county_fips: string;
  county_name: string;
  state_abbr: string;
  risk_score: number;
  risk_tier: string;
  trend: string;
  factors: Array<{ name: string; weight: number }>;
  score_updated_at: string;
  score_delta: number;
  lineage: string[];
};

type TractData = {
  tract_fips: string;
  tract_name: string;
  rate_2010: number;
  rate_2020: number;
  delta: number;
};

type TimeTravelData = {
  county_fips: string;
  county_name: string;
  state_abbr: string;
  query_sql: string;
  queried_at: string;
  national_avg_2020: number;
  summary: {
    tract_count: number;
    avg_delta: number;
    min_delta: number;
    max_delta: number;
    severe_decline_count: number;
    moderate_decline_count: number;
    stable_count: number;
    improved_count: number;
  };
  tracts: TractData[];
  lineage: string[];
};

type RootCauseData = {
  root_cause: {
    rank: string;
    response_rate: number;
    internet_rate: number;
    pct_no_broadband: number;
    pct_undeliverable: number;
    pct_limited_english: number;
    pct_renter: number;
  };
  lineage: string[];
};

type MethodologyChunk = {
  id: string;
  source_doc: string;
  section_title: string;
  text: string;
  page?: string;
  relevance_reason?: string;
  relevance_detail?: string;
  volume_url?: string;
};

type MethodologyData = {
  county_fips: string;
  county_name: string;
  queried_at: string;
  chunks: MethodologyChunk[];
  chunk_count: number;
  lineage: string[];
};

export default function Investigate() {
  const [searchParams] = useSearchParams();
  const countyFips = searchParams.get("county_fips");
  
  const [activeTab, setActiveTab] = useState<"trend" | "rootcause" | "methodology">("trend");
  const [countyInfo, setCountyInfo] = useState<CountyInfo | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScoreData | null>(null);
  const [timeTravel, setTimeTravel] = useState<TimeTravelData | null>(null);
  const [rootCause, setRootCause] = useState<RootCauseData | null>(null);
  const [methodology, setMethodology] = useState<MethodologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeTravelLoading, setTimeTravelLoading] = useState(true);
  const [rootCauseLoading, setRootCauseLoading] = useState(true);
  const [methodologyLoading, setMethodologyLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const BENCHMARKS = {
    broadband: 18,
    undeliverable: 8,
    limited_english: 9,
    renter: 33,
  };
  const NATIONAL_AVG_2020 = 67;
  const NATIONAL_INTERNET_RATE = 51.7;

  useEffect(() => {
    if (!countyFips) {
      setLoading(false);
      setTimeTravelLoading(false);
      setRootCauseLoading(false);
      setMethodologyLoading(false);
      return;
    }

    setLoading(true);
    setTimeTravelLoading(true);
    setRootCauseLoading(true);
    setMethodologyLoading(true);
    setError(null);

    Promise.all([
      get<{ counties: CountyInfo[] }>("/snapshot/high-risk-counties", { limit: "100" }),
      get<RiskScoreData>(`/drilldown/risk-score/${countyFips}`),
    ])
      .then(([countiesRes, riskRes]) => {
        const county = countiesRes.counties.find(c => c.county_fips === countyFips);
        if (county) setCountyInfo(county);
        setRiskScore(riskRes);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || "Failed to load county data");
        setLoading(false);
      });

    get<TimeTravelData>(`/drilldown/time-travel/${countyFips}`)
      .then((data) => { setTimeTravel(data); setTimeTravelLoading(false); })
      .catch(() => setTimeTravelLoading(false));

    get<RootCauseData>(`/drilldown/root-cause/${countyFips}`)
      .then((data) => { setRootCause(data); setRootCauseLoading(false); })
      .catch(() => setRootCauseLoading(false));

    get<MethodologyData>(`/drilldown/methodology/${countyFips}`)
      .then((data) => { setMethodology(data); setMethodologyLoading(false); })
      .catch(() => setMethodologyLoading(false));
  }, [countyFips]);

  const getSeverityLabel = (delta: number) => {
    if (delta < -20) return { label: "Severe decline", color: "text-red-400", bg: "bg-red-500/20" };
    if (delta < -10) return { label: "Moderate decline", color: "text-orange-400", bg: "bg-orange-500/20" };
    if (delta < 0) return { label: "Mild decline", color: "text-yellow-400", bg: "bg-yellow-500/20" };
    return { label: "Improved", color: "text-green-400", bg: "bg-green-500/20" };
  };

  const getTractSeverity = (delta: number) => {
    if (delta < -20) return { label: "Severe", color: "text-red-400", bg: "bg-red-500/20" };
    if (delta < -10) return { label: "Moderate", color: "text-orange-400", bg: "bg-orange-500/20" };
    return { label: "Stable", color: "text-census-gray-400", bg: "bg-slate-700" };
  };

  if (!countyFips) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-census-gray-400 hover:text-white transition">← Back to Command Center</Link>
        </div>
        <div className="bg-slate-900/50 border border-white/10 rounded-xl p-12 text-center">
          <svg className="w-16 h-16 mx-auto mb-4 text-census-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
          <h2 className="text-xl font-semibold text-white mb-2">No County Selected</h2>
          <p className="text-census-gray-400">Select a county from the Command Center to investigate.</p>
        </div>
      </div>
    );
  }

  const countyName = riskScore?.county_name || countyInfo?.county_name || `County ${countyFips}`;
  const stateAbbr = riskScore?.state_abbr || countyInfo?.state_abbr || "";

  const tabs = [
    { id: "trend" as const, label: "Response Trend", icon: "📈", capability: "Delta Lake Time Travel" },
    { id: "rootcause" as const, label: "Root Cause", icon: "🔍", capability: "Federated Join" },
    { id: "methodology" as const, label: "Methodology", icon: "📚", capability: "Vector Search RAG" },
  ];

  // Calculate derived values for Tab 1
  const avg2010 = timeTravel?.tracts.length ? timeTravel.tracts.reduce((s, t) => s + t.rate_2010, 0) / timeTravel.tracts.length : 0;
  const avg2020 = timeTravel?.tracts.length ? timeTravel.tracts.reduce((s, t) => s + t.rate_2020, 0) / timeTravel.tracts.length : 0;
  const gapFromNational = avg2020 - NATIONAL_AVG_2020;

  // Find dominant factor for Tab 2 (computed by highest multiplier above benchmark)
  const getDominantFactor = () => {
    if (!rootCause?.root_cause) return null;
    const factors = [
      { key: "broadband", value: rootCause.root_cause.pct_no_broadband, benchmark: BENCHMARKS.broadband, label: "limited broadband access" },
      { key: "undeliverable", value: rootCause.root_cause.pct_undeliverable, benchmark: BENCHMARKS.undeliverable, label: "undeliverable addresses" },
      { key: "limited_english", value: rootCause.root_cause.pct_limited_english, benchmark: BENCHMARKS.limited_english, label: "language barriers" },
      { key: "renter", value: rootCause.root_cause.pct_renter, benchmark: BENCHMARKS.renter, label: "renter households" },
    ];
    const withMultiplier = factors.map(f => ({ ...f, multiplier: f.value / f.benchmark }));
    return withMultiplier.sort((a, b) => b.multiplier - a.multiplier)[0];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link to="/" className="text-census-gray-400 hover:text-white transition">← Back</Link>
        <div className="h-6 w-px bg-white/10" />
        <h1 className="text-2xl font-bold text-white">{countyName}{stateAbbr && `, ${stateAbbr}`}</h1>
        {loading && (
          <svg className="w-5 h-5 animate-spin text-primary-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
      </div>

      {error && <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400">{error}</div>}

      <div className="flex gap-6">
        {/* Left: Tabs Content */}
        <div className="flex-1 space-y-4">
          {/* Tab Navigation */}
          <div className="flex gap-2 p-1 bg-slate-800/50 rounded-xl border border-white/5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-medium transition ${
                  activeTab === tab.id ? "bg-primary-500/20 text-primary-400 border border-primary-500/30" : "text-census-gray-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {activeTab === tab.id && <span className="ml-2 px-2 py-0.5 text-xs bg-primary-500/30 rounded-full">{tab.capability}</span>}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 min-h-[400px]">
            {/* TAB 1: Response Trend */}
            {activeTab === "trend" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Response Trend Analysis</h3>
                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Delta Lake Time Travel</span>
                  </div>
                  {timeTravel && (
                    <div className="flex items-center gap-3 text-xs text-census-gray-400">
                      <span className="px-2 py-1 bg-slate-800 rounded">{timeTravel.summary.tract_count} tract{timeTravel.summary.tract_count !== 1 ? "s" : ""} returned</span>
                      <span>Queried: {new Date(timeTravel.queried_at).toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>

                {timeTravelLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-lg" />)}</div>
                    <div className="h-64 bg-slate-800 rounded-lg" />
                  </div>
                ) : timeTravel ? (
                  <>
                    {/* Stats with context */}
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-census-gray-400 uppercase mb-1">Avg 2010 Rate</p>
                        <p className="text-2xl font-bold text-white">{avg2010.toFixed(1)}%</p>
                        <p className="text-xs text-census-gray-500 mt-1">2010 Census baseline</p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-census-gray-400 uppercase mb-1">Avg 2020 Rate</p>
                        <p className="text-2xl font-bold text-white">{avg2020.toFixed(1)}%</p>
                        <p className={`text-xs mt-1 ${gapFromNational < 0 ? "text-red-400" : "text-green-400"}`}>
                          {Math.abs(gapFromNational).toFixed(1)} pts {gapFromNational < 0 ? "below" : "above"} national avg
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                        <p className="text-xs text-census-gray-400 uppercase mb-1">Avg Delta</p>
                        <p className={`text-2xl font-bold ${getSeverityLabel(timeTravel.summary.avg_delta).color}`}>
                          {timeTravel.summary.avg_delta > 0 ? "+" : ""}{timeTravel.summary.avg_delta.toFixed(1)}%
                        </p>
                        <p className={`text-xs mt-1 ${getSeverityLabel(timeTravel.summary.avg_delta).color}`}>
                          {getSeverityLabel(timeTravel.summary.avg_delta).label}
                        </p>
                      </div>
                      <div className="bg-slate-800/50 rounded-lg p-4 text-center border border-census-gray-700">
                        <p className="text-xs text-census-gray-400 uppercase mb-1">National Avg 2020</p>
                        <p className="text-2xl font-bold text-census-gray-300">{NATIONAL_AVG_2020}%</p>
                        <p className="text-xs text-census-gray-500 mt-1">2020 benchmark</p>
                      </div>
                    </div>

                    {/* Dynamic Summary Sentence */}
                    <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <p className="text-sm text-white leading-relaxed">
                        <strong>{countyName}</strong>'s average response rate fell{" "}
                        <span className="text-red-400 font-semibold">{Math.abs(timeTravel.summary.avg_delta).toFixed(1)} points</span>{" "}
                        between 2010 and 2020, landing{" "}
                        <span className="text-red-400 font-semibold">{Math.abs(gapFromNational).toFixed(1)} points below</span>{" "}
                        the 2020 national average of {NATIONAL_AVG_2020}%.{" "}
                        {timeTravel.summary.severe_decline_count > 0 && (
                          <span className="text-red-400">
                            {timeTravel.summary.severe_decline_count === timeTravel.summary.tract_count ? "All" : timeTravel.summary.severe_decline_count}{" "}
                            {timeTravel.summary.tract_count === 1 ? "tract shows" : `of ${timeTravel.summary.tract_count} tracts show`} severe decline.
                          </span>
                        )}
                      </p>
                    </div>

                    {/* Tracts Table with Severity Column */}
                    <div className="bg-slate-800/30 rounded-lg overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-xs font-medium text-census-gray-400 uppercase px-4 py-3">Tract Name</th>
                            <th className="text-right text-xs font-medium text-census-gray-400 uppercase px-4 py-3">2010 Rate</th>
                            <th className="text-right text-xs font-medium text-census-gray-400 uppercase px-4 py-3">2020 Rate</th>
                            <th className="text-right text-xs font-medium text-census-gray-400 uppercase px-4 py-3">Delta</th>
                            <th className="text-center text-xs font-medium text-census-gray-400 uppercase px-4 py-3">Severity</th>
                          </tr>
                        </thead>
                        <tbody>
                          {timeTravel.tracts.map((tract) => {
                            const severity = getTractSeverity(tract.delta);
                            return (
                              <tr key={tract.tract_fips} className={`border-b border-white/5 ${tract.delta < -20 ? "bg-red-500/10" : ""}`}>
                                <td className="px-4 py-3 text-sm text-white">{tract.tract_name}</td>
                                <td className="px-4 py-3 text-sm text-census-gray-300 text-right">{tract.rate_2010.toFixed(1)}%</td>
                                <td className="px-4 py-3 text-sm text-census-gray-300 text-right">{tract.rate_2020.toFixed(1)}%</td>
                                <td className={`px-4 py-3 text-sm font-medium text-right ${tract.delta < -20 ? "text-red-400" : tract.delta < -10 ? "text-orange-400" : tract.delta < 0 ? "text-yellow-400" : "text-green-400"}`}>
                                  <span className="inline-flex items-center gap-1">
                                    {tract.delta < 0 ? "↓" : "↑"} {Math.abs(tract.delta).toFixed(1)}%
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`px-2 py-1 rounded text-xs font-medium ${severity.bg} ${severity.color}`}>{severity.label}</span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {timeTravel.tracts.length === 0 && <div className="text-center py-8 text-census-gray-500">No tract data available</div>}
                    </div>

                    {/* How is this calculated? with SQL */}
                    <details className="bg-slate-800/30 rounded-lg border border-white/5">
                      <summary className="px-4 py-3 cursor-pointer text-sm text-census-gray-300 hover:text-white flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        How is this calculated?
                      </summary>
                      <div className="px-4 pb-4 text-xs text-census-gray-400 space-y-3 border-t border-white/5 pt-3">
                        <div className="space-y-2">
                          <p><strong className="text-white">CRRALL</strong> = Cumulative Response Rate (all modes: internet, mail, phone)</p>
                          <p><strong className="text-white">Delta</strong> = 2020 Rate − 2010 Rate (negative = decline)</p>
                          <p><strong className="text-white">Severity:</strong> <span className="text-red-400 ml-2">Severe (&lt;-20%)</span><span className="text-orange-400 ml-2">Moderate (-10% to -20%)</span><span className="text-yellow-400 ml-2">Mild (0% to -10%)</span><span className="text-green-400 ml-2">Improved (&gt;0%)</span></p>
                        </div>
                        <div className="mt-4">
                          <p className="text-primary-400 font-medium mb-2">Delta Lake VERSION AS OF query:</p>
                          <pre className="text-xs text-primary-300 font-mono bg-slate-950 p-3 rounded overflow-x-auto whitespace-pre-wrap">{timeTravel.query_sql}</pre>
                        </div>
                      </div>
                    </details>

                    {/* Lineage */}
                    <div className="flex items-center justify-between p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        <span className="text-xs text-blue-400">Queried via Delta Lake time travel — {timeTravel.lineage.join(", ")}</span>
                      </div>
                      <span className="text-xs text-blue-400/60">{timeTravel.summary.severe_decline_count} severe | {timeTravel.summary.moderate_decline_count} moderate | {timeTravel.summary.stable_count} stable | {timeTravel.summary.improved_count} improved</span>
                    </div>
                  </>
                ) : <div className="text-center py-12 text-census-gray-500"><p>No time travel data available</p></div>}
              </div>
            )}

            {/* TAB 2: Root Cause */}
            {activeTab === "rootcause" && (
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-white">Root Cause Analysis</h3>
                  <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">Federated Join</span>
                </div>

                {rootCauseLoading ? (
                  <div className="space-y-4 animate-pulse">
                    <div className="h-20 bg-slate-800 rounded-lg" />
                    <div className="space-y-3">{[1,2,3,4].map(i => <div key={i} className="h-24 bg-slate-800 rounded-lg" />)}</div>
                  </div>
                ) : rootCause?.root_cause ? (
                  <>
                    {/* Dynamic Finding Sentence */}
                    {(() => {
                      const dominant = getDominantFactor();
                      const internetGap = rootCause.root_cause.internet_rate - NATIONAL_INTERNET_RATE;
                      return (
                        <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                          <p className="text-sm text-white leading-relaxed">
                            <strong>{countyName}</strong>'s internet response rate is{" "}
                            <span className="text-purple-400 font-semibold">{rootCause.root_cause.internet_rate?.toFixed(1) || "—"}%</span> —{" "}
                            <span className={internetGap < 0 ? "text-red-400" : "text-green-400"}>
                              {Math.abs(internetGap).toFixed(1)} points {internetGap < 0 ? "below" : "above"} national average
                            </span>.{" "}
                            {dominant && (
                              <>
                                The dominant factor is <strong>{dominant.label}</strong> at{" "}
                                <span className="text-red-400 font-semibold">{dominant.value.toFixed(1)}%</span>, which is{" "}
                                <span className="text-red-400 font-semibold">{dominant.multiplier.toFixed(1)}x</span>{" "}
                                the national benchmark of {dominant.benchmark}%.
                              </>
                            )}
                          </p>
                        </div>
                      );
                    })()}

                    {/* Root Cause Rank Badge */}
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 text-center">
                      <p className="text-xs text-purple-400 uppercase mb-1">Root Cause Pattern</p>
                      <p className="text-2xl font-bold text-white">{rootCause.root_cause.rank}</p>
                    </div>

                    {/* Factor Bars with Multipliers and Why This Matters */}
                    <div className="space-y-4">
                      {[
                        { key: "broadband", label: "Broadband Gap", subtitle: "Households without reliable internet access", 
                          value: rootCause.root_cause.pct_no_broadband, benchmark: BENCHMARKS.broadband,
                          whyMatters: `This county's internet response rate (CRRINT) is ${rootCause.root_cause.internet_rate?.toFixed(1) || "—"}% vs ${NATIONAL_INTERNET_RATE}% national` },
                        { key: "undeliverable", label: "Undeliverable Addresses", subtitle: "Addresses where mail cannot be delivered",
                          value: rootCause.root_cause.pct_undeliverable, benchmark: BENCHMARKS.undeliverable,
                          whyMatters: `${rootCause.root_cause.pct_undeliverable?.toFixed(1) || "—"}% of addresses are undeliverable — field enumeration is the primary response path` },
                        { key: "limited_english", label: "Language Barrier", subtitle: "Households with limited English proficiency",
                          value: rootCause.root_cause.pct_limited_english, benchmark: BENCHMARKS.limited_english,
                          whyMatters: `${rootCause.root_cause.pct_limited_english?.toFixed(1) || "—"}% of households have limited English — above the ${BENCHMARKS.limited_english}% national benchmark` },
                        { key: "renter", label: "Renter Households", subtitle: "Households that rent rather than own",
                          value: rootCause.root_cause.pct_renter, benchmark: BENCHMARKS.renter,
                          whyMatters: `${rootCause.root_cause.pct_renter?.toFixed(1) || "—"}% renter households correlates with higher mobility and proxy response rates` },
                      ].map((factor) => {
                        const multiplier = factor.value / factor.benchmark;
                        const isElevated = multiplier > 1;
                        const isHighRisk = multiplier > 2;
                        const pctOfMax = Math.min((factor.value / (factor.benchmark * 3)) * 100, 100);
                        const benchmarkPct = (factor.benchmark / (factor.benchmark * 3)) * 100;
                        
                        return (
                          <div key={factor.key} className={`p-4 rounded-lg ${isHighRisk ? "bg-red-500/10 border border-red-500/30" : "bg-slate-800/50"}`}>
                            <div className="flex items-center justify-between mb-1">
                              <div>
                                <span className="text-sm font-medium text-white">{factor.label}</span>
                                <p className="text-xs text-census-gray-500">{factor.subtitle}</p>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className={`text-lg font-bold ${isHighRisk ? "text-red-400" : "text-white"}`}>{factor.value?.toFixed(1) || "—"}%</span>
                                <span className="text-xs text-census-gray-500">vs {factor.benchmark}% avg</span>
                                {isElevated && (
                                  <span className={`px-2 py-0.5 text-xs rounded font-medium ${isHighRisk ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"}`}>
                                    {multiplier.toFixed(1)}x national avg
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="relative h-3 bg-slate-700 rounded-full overflow-hidden mb-2 mt-2">
                              <div className={`absolute h-full rounded-full ${isHighRisk ? "bg-red-500" : isElevated ? "bg-orange-500" : "bg-purple-500"}`} style={{ width: `${pctOfMax}%` }} />
                              <div className="absolute h-full w-0.5 bg-white/50" style={{ left: `${benchmarkPct}%` }} title={`National avg: ${factor.benchmark}%`} />
                            </div>
                            {isElevated && (
                              <p className="text-xs text-census-gray-400 italic">{factor.whyMatters}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Lineage */}
                    <div className="flex items-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-purple-400">Joined 4 Unity Catalog tables — anomaly_scores · root_cause_join · usps_undeliverable · broadband_coverage</span>
                    </div>
                  </>
                ) : <div className="text-center py-12 text-census-gray-500"><p>No root cause data available</p></div>}
              </div>
            )}

            {/* TAB 3: Methodology */}
            {activeTab === "methodology" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-semibold text-white">Census Methodology</h3>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">RAG from UC</span>
                  </div>
                  {methodology && <span className="text-xs text-census-gray-400">{methodology.chunk_count} relevant sections found</span>}
                </div>

                {methodologyLoading ? (
                  <div className="space-y-4 animate-pulse">{[1,2,3].map(i => <div key={i} className="h-32 bg-slate-800 rounded-lg" />)}</div>
                ) : methodology && methodology.chunks.length > 0 ? (
                  <>
                    <div className="space-y-4">
                      {methodology.chunks.map((chunk) => (
                        <div key={chunk.id} className="bg-slate-800/50 border border-white/5 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center flex-shrink-0">
                              <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                {chunk.relevance_reason && (
                                  <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full font-medium">
                                    {chunk.relevance_reason}
                                  </span>
                                )}
                                {chunk.relevance_detail && (
                                  <span className="text-xs text-census-gray-500">{chunk.relevance_detail}</span>
                                )}
                                {chunk.page && (
                                  <span className="px-1.5 py-0.5 bg-slate-700 text-census-gray-400 text-xs rounded ml-auto">p.{chunk.page}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-green-400 font-medium">{chunk.source_doc}</span>
                                {chunk.volume_url && (
                                  <a
                                    href={chunk.volume_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-500/20 text-primary-400 rounded hover:bg-primary-500/30 transition"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    View in Volume
                                  </a>
                                )}
                              </div>
                              <p className="text-sm text-census-gray-400 leading-relaxed">{chunk.text}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Lineage */}
                    <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-xs text-green-400">Retrieved via Databricks Vector Search — semantic search across 3 methodology PDFs</span>
                    </div>
                  </>
                ) : <div className="text-center py-12 text-census-gray-500"><p>No methodology documents found</p></div>}
              </div>
            )}
          </div>
        </div>

        {/* Right: Risk Score Panel */}
        <div className="w-80 flex-shrink-0">
          <div className="bg-slate-900/50 border border-white/10 rounded-xl p-6 sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-census-gray-400 uppercase tracking-wide">Risk Score</h3>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-xs rounded-full">Model Serving</span>
            </div>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                <div className="h-16 bg-slate-800 rounded-lg" />
                <div className="h-4 bg-slate-800 rounded w-2/3" />
                <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-slate-800 rounded" />)}</div>
              </div>
            ) : riskScore ? (
              <div className="space-y-6">
                <div className="text-center">
                  <div className={`text-5xl font-bold ${riskScore.risk_score > 0.85 ? "text-red-400" : riskScore.risk_score > 0.75 ? "text-orange-400" : "text-yellow-400"}`}>
                    {(riskScore.risk_score * 100).toFixed(0)}%
                  </div>
                  <div className={`text-sm mt-1 ${riskScore.risk_tier === "CRITICAL" ? "text-red-400" : riskScore.risk_tier === "HIGH" ? "text-orange-400" : "text-yellow-400"}`}>
                    {riskScore.risk_tier} RISK
                  </div>
                </div>
                {riskScore.score_delta !== 0 && (
                  <div className="flex items-center justify-center gap-2">
                    <span className={`text-sm ${riskScore.score_delta > 0 ? "text-red-400" : "text-green-400"}`}>{riskScore.score_delta > 0 ? "↑" : "↓"} {Math.abs(riskScore.score_delta * 100).toFixed(1)}%</span>
                    <span className="text-xs text-census-gray-500">vs 24h ago</span>
                  </div>
                )}
                <div className="space-y-3">
                  <h4 className="text-xs font-medium text-census-gray-400 uppercase">Top Factors</h4>
                  {riskScore.factors.map((factor, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-white">{factor.name}</span>
                          <span className="text-census-gray-400">{(factor.weight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${idx === 0 ? "bg-red-500" : idx === 1 ? "bg-orange-500" : "bg-yellow-500"}`} style={{ width: `${factor.weight * 100}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="pt-4 border-t border-white/10">
                  <p className="text-xs text-census-gray-500">Updated: {riskScore.score_updated_at}</p>
                </div>
                <div className="pt-2">
                  <div className="text-xs text-census-gray-600 bg-slate-800/50 rounded-lg p-2">
                    <span className="text-census-gray-400">Lineage:</span> {riskScore.lineage.join(" → ")}
                  </div>
                </div>
              </div>
            ) : <div className="text-center text-census-gray-500 py-8"><p>No risk score data</p></div>}
          </div>
        </div>
      </div>

      
    </div>
  );
}
