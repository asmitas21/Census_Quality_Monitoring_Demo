import { useEffect, useState } from "react";
import LineageGraph from "../components/LineageGraph";
import { get } from "../api/client";
import { useWorkspaceHost, ucExploreUrl } from "../hooks/useWorkspaceHost";

type MetricSummary = {
  name: string;
  owner: string;
  certified: boolean;
  usage_count: number;
  description: string;
};

type MetricDetail = {
  id: string;
  name: string;
  owner: string;
  owner_email: string;
  certified: boolean;
  certification_date: string | null;
  last_updated: string;
  usage_count: number;
  definition: string;
  sql: string;
  source_tables: string[];
  downstream_dependencies: string[];
};

type Lineage = {
  nodes: { id: string; label: string; type: string }[];
  edges: { from: string; to: string }[];
};

type CatalogResponse = {
  catalog: Record<string, MetricSummary[]>;
  total_metrics: number;
  certified_count: number;
  message: string;
};

export default function MetricCatalog() {
  const host = useWorkspaceHost();
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MetricSummary[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<MetricDetail | null>(null);
  const [_lineage, setLineage] = useState<Lineage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    get<CatalogResponse>("/governance/catalog").then((data) => {
      setCatalog(data);
      setLoading(false);
    });
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const res = await get<{ results: MetricSummary[] }>(`/governance/search?q=${encodeURIComponent(searchQuery)}`);
    setSearchResults(res.results || []);
  };

  const selectMetric = async (name: string) => {
    const res = await get<{ metric: MetricDetail; lineage: Lineage }>(`/governance/metrics/${encodeURIComponent(name)}`);
    setSelectedMetric(res.metric);
    setLineage(res.lineage);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-20 bg-slate-800/50 rounded-xl animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-900/30 via-slate-800 to-slate-900 border border-white/5 p-6">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PHBhdGggZD0iTTM2IDM0djItSDI0di0yaDEyek0zNiAyNHYySDI0di0yaDEyek0zNiAxNHYySDE0di0yaDIyeiIvPjwvZz48L2c+PC9zdmc+')] opacity-50" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl">📊</span>
            <div>
              <h1 className="text-2xl font-bold text-white">Metric Library</h1>
              <p className="text-sm text-census-gray-400">
                Find, trust, and reuse certified metrics — don't re-derive what already exists
              </p>
            </div>
          </div>
          
          <p className="text-census-gray-500 text-sm max-w-2xl mb-4">
            Every metric here is governed in Unity Catalog with full lineage, ownership, and certification status. 
            Search for what you need, see who owns it, and trace where the data comes from.
          </p>

          {/* Stats Row */}
          <div className="flex gap-6">
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-white">{catalog?.total_metrics || 0}</span>
              <span className="text-xs text-census-gray-500">Total<br/>Metrics</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-green-400">{catalog?.certified_count || 0}</span>
              <span className="text-xs text-green-400/70">Certified<br/>Production Ready</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-bold text-yellow-400">
                {(catalog?.total_metrics || 0) - (catalog?.certified_count || 0)}
              </span>
              <span className="text-xs text-yellow-400/70">In<br/>Development</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-slate-800/50 rounded-xl border border-white/5 p-5">
        <h2 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>🔍</span>
          Search Metrics
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search for 'children', 'response', 'hispanic', 'coverage'..."
            className="flex-1 px-4 py-2.5 bg-slate-900 border border-white/10 rounded-lg text-white placeholder-census-gray-500 text-sm focus:outline-none focus:border-primary-500/50"
          />
          <button
            onClick={handleSearch}
            className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition"
          >
            Search
          </button>
        </div>
        
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((m) => (
              <button
                key={m.name}
                className="w-full p-4 bg-slate-900/50 border border-white/5 rounded-lg hover:border-primary-500/30 text-left transition"
                onClick={() => selectMetric(m.name)}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-primary-400">{m.name}</span>
                  <div className="flex items-center gap-2">
                    {m.certified && (
                      <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        ✓ Certified
                      </span>
                    )}
                    <span className="text-xs text-census-gray-500">{m.usage_count} users</span>
                  </div>
                </div>
                <p className="text-xs text-census-gray-400">{m.description}</p>
                <p className="text-xs text-census-gray-600 mt-1">Owner: {m.owner}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Catalog by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {catalog?.catalog && Object.entries(catalog.catalog).map(([category, metrics]) => (
          <div key={category} className="bg-slate-800/50 rounded-xl border border-white/5 p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary-500" />
              {category}
            </h3>
            <div className="space-y-2">
              {metrics.map((m) => (
                <button
                  key={m.name}
                  className="w-full p-3 rounded-lg hover:bg-slate-900/50 text-left transition group border-l-2 border-l-transparent hover:border-l-primary-500"
                  onClick={() => selectMetric(m.name)}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-census-gray-300 group-hover:text-white transition">
                      {m.name}
                    </span>
                    {m.certified && (
                      <span className="w-2 h-2 rounded-full bg-green-500" title="Certified" />
                    )}
                  </div>
                  <p className="text-xs text-census-gray-600">by {m.owner}</p>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Selected Metric Detail Modal */}
      {selectedMetric && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl shadow-2xl border border-white/10 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between mb-6">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">📊</span>
                    <h2 className="text-xl font-bold text-white">{selectedMetric.name}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedMetric.certified ? (
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs rounded-full font-medium border border-green-500/30">
                        ✓ Certified - Production Ready
                      </span>
                    ) : (
                      <span className="px-3 py-1 bg-yellow-500/20 text-yellow-400 text-xs rounded-full font-medium border border-yellow-500/30">
                        In Development
                      </span>
                    )}
                    <span className="text-xs text-census-gray-500">
                      {selectedMetric.usage_count} people use this metric
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => { setSelectedMetric(null); setLineage(null); }}
                  className="p-2 hover:bg-white/5 rounded-lg text-census-gray-400 hover:text-white transition"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Ownership */}
              <div className="grid grid-cols-2 gap-4 mb-6 p-4 bg-slate-800/50 rounded-xl border border-white/5">
                <div>
                  <p className="text-xs text-census-gray-500 uppercase tracking-wide mb-1">Owner</p>
                  <p className="font-medium text-white">{selectedMetric.owner}</p>
                  <p className="text-xs text-census-gray-500">{selectedMetric.owner_email}</p>
                </div>
                <div>
                  <p className="text-xs text-census-gray-500 uppercase tracking-wide mb-1">Last Updated</p>
                  <p className="font-medium text-white">
                    {new Date(selectedMetric.last_updated).toLocaleDateString()}
                  </p>
                  {selectedMetric.certification_date && (
                    <p className="text-xs text-green-400">
                      Certified: {selectedMetric.certification_date}
                    </p>
                  )}
                </div>
              </div>

              {/* Definition */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <span>📝</span> Definition
                </h3>
                <p className="text-sm text-census-gray-300 bg-slate-800/30 p-4 rounded-lg border border-white/5">
                  {selectedMetric.definition}
                </p>
              </div>

              {/* Lineage Graph */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <span>🔗</span> Data Lineage
                </h3>
                <div className="bg-slate-800/30 p-4 rounded-lg border border-white/5">
                  <LineageGraph metricName={selectedMetric.name} />
                </div>
              </div>

              {/* SQL */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <span>💻</span> SQL Logic
                </h3>
                <pre className="bg-slate-950 text-primary-300 p-4 rounded-lg text-xs overflow-x-auto border border-white/5 font-mono">
                  {selectedMetric.sql}
                </pre>
              </div>

              {/* Source Tables */}
              <div className="mb-6">
                <h3 className="font-semibold text-white mb-2 flex items-center gap-2">
                  <span>📁</span> Source Tables
                </h3>
                <div className="flex flex-wrap gap-2">
                  {selectedMetric.source_tables.map((table) => (
                    <span
                      key={table}
                      className="px-3 py-1.5 bg-blue-500/20 text-blue-400 rounded-lg text-xs font-mono border border-blue-500/30"
                    >
                      {table}
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-white/5">
                <button className="px-5 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2">
                  <span>✨</span> Use This Metric
                </button>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(selectedMetric.sql);
                    alert('SQL copied to clipboard!');
                  }}
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition border border-white/10"
                >
                  Copy SQL
                </button>
                <a 
                  href={ucExploreUrl(host, selectedMetric.source_tables?.[0] || 'census_operations_demo.operations')}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-medium transition border border-white/10"
                >
                  View Source Table →
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
