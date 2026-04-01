import { useState, useEffect } from "react";
import { Routes, Route, Navigate, Link, useLocation } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import { get } from "./api/client";
import SidebarFilters from "./components/SidebarFilters";
import AccessGate from "./screens/AccessGate";
import LandingOverview from "./screens/LandingOverview";
import AnomalyPanel from "./screens/AnomalyPanel";
import DrilldownExplain from "./screens/DrilldownExplain";
import ContextFilters from "./screens/ContextFilters";
import SaveExportSubscribe from "./screens/SaveExportSubscribe";
import InvestigationTracker from "./screens/InvestigationTracker";
import AuditLog from "./screens/AuditLog";
import GeographyMap from "./screens/GeographyMap";
import MetricCatalog from "./screens/MetricCatalog";
import ChildrenJourney from "./screens/ChildrenJourney";
import AIFindings from "./screens/AIFindings";
import MetricDrilldown from "./screens/MetricDrilldown";
import Investigate from "./screens/Investigate";
import Genie from "./screens/Genie";
import MetricViews from "./screens/MetricViews";
import SharingHub from "./screens/SharingHub";
import CompliancePanel from "./screens/CompliancePanel";
import { useFilterStore } from "./store/filters";

const NAV = [
  { path: "/", label: "Command Center" },
  { path: "/investigate", label: "Investigate" },
  { path: "/map", label: "Geography" },
  { path: "/genie", label: "Genie" },
  { path: "/metrics", label: "Metric Views" },
  { path: "/audit", label: "Audit Log" },
];

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isAccess = location.pathname === "/access";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { kpiGroup, timeWindow, entitlement, userEmail, entitlementLoaded, setEntitlement } = useFilterStore();

  // Fetch user identity + entitlement once on mount
  useEffect(() => {
    get<{ email: string; entitlement: string }>("/snapshot/me")
      .then((res) => setEntitlement(res.email, res.entitlement as "title_13_only" | "title_13_and_26"))
      .catch(() => setEntitlement("local-dev@demo.gov", "title_13_and_26"));
  }, []);

  const kpiGroupLabel: Record<string, string> = { 
    quality: "Data Quality", 
    response_rate: "Response Rates", 
    coverage: "Coverage", 
    operations: "Operations" 
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* New Modern Header */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border-b border-white/5 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          {/* Top bar */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              {/* Logo */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <span className="text-white font-bold text-lg">2030</span>
                </div>
                <div>
                  <h1 className="font-bold text-white text-lg tracking-tight">Census Intelligence</h1>
                  <p className="text-xs text-white/60">Decennial Operations Command</p>
                </div>
              </div>

              {/* Separator */}
              <div className="h-8 w-px bg-white/10 hidden lg:block" />

              {/* Live Status */}
              <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-green-500/10 border border-green-500/20 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400 font-medium">Live Data</span>
              </div>
            </div>

            {/* Right Side */}
            {!isAccess && (
              <div className="flex items-center gap-3">
                <div className="hidden md:flex items-center gap-2 text-xs text-white/70">
                  <span className="px-2 py-1 bg-white/10 rounded text-white">{kpiGroupLabel[kpiGroup] || kpiGroup}</span>
                  <span>•</span>
                  <span>{timeWindow}</span>
                </div>

                {/* Entitlement badge */}
                {entitlementLoaded && (
                  <div className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                    entitlement === "title_13_and_26"
                      ? "bg-green-500/10 border-green-500/30 text-green-400"
                      : "bg-yellow-500/10 border-yellow-500/30 text-yellow-400"
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${entitlement === "title_13_and_26" ? "bg-green-400" : "bg-yellow-400"}`} />
                    {entitlement === "title_13_and_26" ? "T13 + T26" : "T13 Only"}
                  </div>
                )}

                <button
                  onClick={() => setSidebarOpen(true)}
                  className="p-2 hover:bg-white/5 rounded-lg transition text-census-gray-400 hover:text-white"
                  title="Filters"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>

                {/* User avatar with email tooltip */}
                <div className="relative group">
                  <div className="w-8 h-8 rounded-full bg-primary-500/20 border border-primary-500/30 flex items-center justify-center cursor-default">
                    <span className="text-primary-400 text-sm font-medium">
                      {userEmail ? userEmail.slice(0, 2).toUpperCase() : "DS"}
                    </span>
                  </div>
                  {userEmail && (
                    <div className="absolute right-0 top-10 hidden group-hover:block bg-slate-800 border border-white/10 rounded-lg px-3 py-2 text-xs text-white whitespace-nowrap z-50 shadow-xl">
                      {userEmail}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation */}
          {!isAccess && (
            <nav className="flex gap-1 pb-3 overflow-x-auto" aria-label="Main">
              {NAV.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    location.pathname === path
                      ? "bg-primary-500/20 text-white border border-primary-500/30"
                      : "text-census-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>
      </header>

      {/* T13-only restriction banner */}
      {!isAccess && entitlementLoaded && entitlement === "title_13_only" && (
        <div className="bg-yellow-500/10 border-b border-yellow-500/20 px-4 py-2.5">
          <div className="max-w-[1600px] mx-auto flex items-center gap-3 text-sm">
            <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span className="text-yellow-300 font-medium">Title 13 Only access</span>
            <span className="text-yellow-400/70">— Demographic breakdown, language barrier, and renter data are restricted. Contact your administrator to request Title 26 authorization.</span>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-4 bg-slate-900/50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-xs text-census-gray-600">
          <div className="flex items-center gap-4">
            <span>Census Intelligence Platform</span>
            <span>•</span>
            <span>Real 2020 Decennial + ACS Data</span>
            <span>•</span>
            <span className="text-green-500">Unity Catalog Governed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 bg-white/5 rounded text-census-gray-500">Title 13/26 Compliant</span>
          </div>
        </div>
      </footer>

      <SidebarFilters open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Routes>
        <Route path="/access" element={<AccessGate />} />
        <Route
          path="/*"
          element={
            <Layout>
              <Routes>
                {/* Primary Nav Routes */}
                <Route path="/" element={<LandingOverview />} />
                <Route path="/investigate" element={<Investigate />} />
                <Route path="/map" element={<GeographyMap />} />
                <Route path="/genie" element={<Genie />} />
                <Route path="/metrics" element={<MetricViews />} />
                <Route path="/sharing" element={<SharingHub />} />
                <Route path="/compliance" element={<CompliancePanel />} />
                
                {/* Secondary Routes (not in primary nav) */}
                <Route path="/ai-findings" element={<AIFindings />} />
                <Route path="/children" element={<ChildrenJourney />} />
                <Route path="/metric/:metricName" element={<MetricDrilldown />} />
                <Route path="/anomalies" element={<AnomalyPanel />} />
                <Route path="/drilldown" element={<DrilldownExplain />} />
                <Route path="/metric-catalog" element={<MetricCatalog />} />
                <Route path="/filters" element={<ContextFilters />} />
                <Route path="/export" element={<SaveExportSubscribe />} />
                <Route path="/investigations" element={<InvestigationTracker />} />
                <Route path="/audit" element={<AuditLog />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Layout>
          }
        />
      </Routes>
    </ToastProvider>
  );
}
