import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { get } from "../api/client";
import { DimensionExplorer } from "../components/DimensionExplorer";
import { CorrelationFinder } from "../components/CorrelationFinder";
import GenieSearch from "../components/GenieSearch";
import { useWorkspaceHost, ucExploreUrl } from "../hooks/useWorkspaceHost";

interface ChildrenAlert {
  alert_type: string;
  severity: string;
  headline: string;
  description: string;
  affected_tracts: number;
  affected_counties: number;
  multiplier: number;
  action: string;
}

interface RiskCounty {
  NAME: string;
  state: number;
  county: number;
  combined_risk_score: number;
  pct_grandchildren_with_grandparent: number;
  pct_linguistically_isolated: number;
  pct_children_no_parents: number;
  pct_renter: number;
}

interface HistoricalComparison {
  NAME: string;
  state: number;
  county: number;
  pct_children_under_5_2010: number;
  pct_children_under_5_current: number;
  change: number;
  trend: string;
}

export default function ChildrenJourney() {
  const host = useWorkspaceHost();
  const [alert, setAlert] = useState<ChildrenAlert | null>(null);
  const [riskCounties, setRiskCounties] = useState<RiskCounty[]>([]);
  const [historicalData, setHistoricalData] = useState<HistoricalComparison[]>([]);
  const [activeTab, setActiveTab] = useState<"explorer" | "correlation" | "risk" | "historical" | "ai">("explorer");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      get<ChildrenAlert>("/journey/children-alert"),
      get<{ high_risk_counties: RiskCounty[] }>("/journey/risk-factors"),
      get<{ comparison: HistoricalComparison[] }>("/journey/historical-comparison"),
    ]).then(([alertRes, riskRes, histRes]) => {
      setAlert(alertRes);
      setRiskCounties(riskRes.high_risk_counties || []);
      setHistoricalData(histRes.comparison || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const tabs = [
    { id: "explorer", label: "Dimension Explorer" },
    { id: "correlation", label: "Correlation Finder" },
    { id: "risk", label: "Risk Factors" },
    { id: "historical", label: "Historical Comparison" },
    { id: "ai", label: "Ask AI" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-4">
          <svg className="w-10 h-10 animate-spin text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-white/60">Loading Children Journey...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Alert */}
      {alert && (
        <div className={`relative overflow-hidden rounded-2xl ${
          alert.severity === "high" ? "bg-gradient-to-r from-red-900/50 to-red-800/30" : "bg-gradient-to-r from-orange-900/50 to-orange-800/30"
        } border ${alert.severity === "high" ? "border-red-500/30" : "border-orange-500/30"} p-6`}>
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative">
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${alert.severity === "high" ? "bg-red-500/20" : "bg-orange-500/20"}`}>
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                    alert.severity === "high" ? "bg-red-500 text-white" : "bg-orange-500 text-white"
                  }`}>
                    {alert.severity.toUpperCase()} PRIORITY
                  </span>
                  <span className="text-xs text-white/50">Children Under 5 Undercount Risk</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">{alert.headline}</h2>
                <p className="text-white/80 mb-4">{alert.description}</p>
                
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">{alert.multiplier}x</p>
                    <p className="text-xs text-white/60">Risk Multiplier</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">{alert.affected_tracts?.toLocaleString()}</p>
                    <p className="text-xs text-white/60">Tracts Affected</p>
                  </div>
                  <div className="text-center">
                    <p className="text-3xl font-bold text-white">{alert.affected_counties}</p>
                    <p className="text-xs text-white/60">Counties</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.id
                ? "bg-primary-500 text-white"
                : "bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "explorer" && <DimensionExplorer />}
      
      {activeTab === "correlation" && <CorrelationFinder />}
      
      {activeTab === "risk" && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            High-Risk Counties (2+ Risk Factors)
          </h3>
          <p className="text-sm text-white/60 mb-6">
            Counties with multiple demographic risk factors for children undercount. Based on real Census Bureau research on undercount drivers.
          </p>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs text-white/60 pb-3">County</th>
                  <th className="text-center text-xs text-white/60 pb-3">Risk Score</th>
                  <th className="text-center text-xs text-white/60 pb-3">Grandparent HH</th>
                  <th className="text-center text-xs text-white/60 pb-3">Linguistic Isolation</th>
                  <th className="text-center text-xs text-white/60 pb-3">Children No Parents</th>
                  <th className="text-center text-xs text-white/60 pb-3">High Renter</th>
                </tr>
              </thead>
              <tbody>
                {riskCounties.slice(0, 15).map((county, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                    <td className="py-3 text-sm text-white">{county.NAME}</td>
                    <td className="py-3 text-center">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        county.combined_risk_score >= 3 ? "bg-red-500/20 text-red-400" : "bg-orange-500/20 text-orange-400"
                      }`}>
                        {county.combined_risk_score}
                      </span>
                    </td>
                    <td className="py-3 text-center text-sm text-white/80">
                      {county.pct_grandchildren_with_grandparent?.toFixed(1)}%
                    </td>
                    <td className="py-3 text-center text-sm text-white/80">
                      {county.pct_linguistically_isolated?.toFixed(1)}%
                    </td>
                    <td className="py-3 text-center text-sm text-white/80">
                      {county.pct_children_no_parents?.toFixed(1)}%
                    </td>
                    <td className="py-3 text-center text-sm text-white/80">
                      {county.pct_renter?.toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-sm text-white/80">
              <strong>Risk Factors Explained:</strong> These are based on Census Bureau post-enumeration studies showing that children living with grandparents, in linguistically isolated households, or in high-renter areas are significantly more likely to be missed.
            </p>
          </div>
        </div>
      )}
      
      {activeTab === "historical" && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
            Historical Comparison: 2010 vs Now
          </h3>
          <p className="text-sm text-white/60 mb-6">
            Counties where children under 5 percentage has changed since the 2010 Census.
          </p>
          
          <div className="grid grid-cols-2 gap-6">
            {/* Declining */}
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-3">Declining Counties</h4>
              <div className="space-y-2">
                {historicalData
                  .filter((h) => h.trend === "declining")
                  .slice(0, 8)
                  .map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-red-500/10 rounded-lg">
                      <span className="text-sm text-white">{h.NAME}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-red-400">{h.change}%</span>
                        <span className="text-xs text-white/50 ml-2">
                          ({h.pct_children_under_5_2010}% → {h.pct_children_under_5_current}%)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            
            {/* Increasing */}
            <div>
              <h4 className="text-sm font-medium text-green-400 mb-3">Increasing Counties</h4>
              <div className="space-y-2">
                {historicalData
                  .filter((h) => h.trend === "increasing")
                  .slice(0, 8)
                  .map((h, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-green-500/10 rounded-lg">
                      <span className="text-sm text-white">{h.NAME}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold text-green-400">+{h.change}%</span>
                        <span className="text-xs text-white/50 ml-2">
                          ({h.pct_children_under_5_2010}% → {h.pct_children_under_5_current}%)
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {activeTab === "ai" && (
        <div className="bg-gradient-to-br from-slate-800/80 to-slate-900/80 rounded-2xl border border-white/10 p-6">
          <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
            <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            Ask Census Intelligence
          </h3>
          <p className="text-sm text-white/60 mb-6">
            Ask questions about children undercount patterns, historical interventions, or explore the data.
          </p>
          
          <GenieSearch />
          
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-sm font-medium text-white mb-2">Try asking:</p>
              <ul className="space-y-2 text-sm text-white/70">
                <li>• "Which counties have the highest grandparent household rates?"</li>
                <li>• "Compare California and Texas children under 5 rates"</li>
                <li>• "What factors are most associated with low children counts?"</li>
              </ul>
            </div>
            <div className="p-4 bg-white/5 rounded-xl">
              <p className="text-sm font-medium text-white mb-2">Document Search:</p>
              <ul className="space-y-2 text-sm text-white/70">
                <li>• "What interventions worked for children undercount in 2010?"</li>
                <li>• "How does the Census count children in complex households?"</li>
                <li>• "What is the ACS methodology for population estimates?"</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Footer with Databricks Links */}
      <div className="flex items-center justify-between text-xs text-white/50 pt-4 border-t border-white/10">
        <div className="flex items-center gap-4">
          <span>Data: Real Census Bureau ACS 2022 + 2010/2020 Decennial</span>
          <span>•</span>
          <span className="text-green-400">Unity Catalog Governed</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href={ucExploreUrl(host, "census_operations_demo/operations")}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-400 hover:text-primary-300"
          >
            View in Unity Catalog →
          </a>
          <Link to="/metrics" className="text-primary-400 hover:text-primary-300">
            View Lineage →
          </Link>
        </div>
      </div>
    </div>
  );
}
