import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { get } from "../api/client";

type CountyRow = {
  county_fips: string;
  county_name: string;
  state_abbr: string;
  crrall: number | null;
  crrint: number | null;
  pct_no_broadband: number | null;
  pct_language_barrier: number | null;
  pct_renter: number | null;
  pct_undeliverable: number | null;
  vacancy_rate: number | null;
  risk_score: number | null;
  top_factor: string | null;
};

type SortKey = "county_name" | "state_abbr" | "crrall" | "risk_score" | "pct_no_broadband" | "pct_language_barrier" | "pct_renter";

const COLUMNS: { key: SortKey; label: string; fmt?: (v: number | null) => string }[] = [
  { key: "county_name", label: "County" },
  { key: "state_abbr", label: "State" },
  { key: "crrall", label: "Response Rate", fmt: (v) => (v != null ? `${v.toFixed(1)}%` : "—") },
  { key: "risk_score", label: "Risk Score", fmt: (v) => (v != null ? v.toFixed(2) : "—") },
  { key: "pct_no_broadband", label: "No Broadband", fmt: (v) => (v != null ? `${v.toFixed(1)}%` : "—") },
  { key: "pct_language_barrier", label: "Limited English", fmt: (v) => (v != null ? `${v.toFixed(1)}%` : "—") },
  { key: "pct_renter", label: "Renter Rate", fmt: (v) => (v != null ? `${v.toFixed(1)}%` : "—") },
];

export function CountyExplorer() {
  const [data, setData] = useState<CountyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("risk_score");
  const [sortAsc, setSortAsc] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    get<{ counties: CountyRow[] }>("/snapshot/county-layer")
      .then((res) => setData(res.counties))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const states = useMemo(() => {
    const s = new Set(data.map((c) => c.state_abbr).filter(Boolean));
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (stateFilter) rows = rows.filter((r) => r.state_abbr === stateFilter);
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((r) => r.county_name?.toLowerCase().includes(q));
    }
    rows = [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string" && typeof bv === "string") return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
    return rows;
  }, [data, stateFilter, search, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const riskColor = (score: number | null) => {
    if (score == null) return "text-census-gray-500";
    if (score > 0.85) return "text-red-400";
    if (score > 0.75) return "text-orange-400";
    if (score > 0.5) return "text-yellow-400";
    return "text-green-400";
  };

  const responseColor = (rate: number | null) => {
    if (rate == null) return "text-census-gray-500";
    if (rate < 40) return "text-red-400";
    if (rate < 55) return "text-orange-400";
    if (rate < 70) return "text-yellow-400";
    return "text-green-400";
  };

  return (
    <div className="rounded-xl border border-white/10 bg-slate-800/40 overflow-hidden">
      <div className="px-5 py-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <svg className="w-5 h-5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          <h3 className="text-sm font-semibold text-white">County Explorer</h3>
          <span className="text-xs text-census-gray-500 ml-1">
            {filtered.length.toLocaleString()} of {data.length.toLocaleString()} counties
          </span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search county…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white placeholder-census-gray-600 focus:outline-none focus:border-primary-400 w-40"
          />
          <select
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value)}
            className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-xs text-white focus:outline-none focus:border-primary-400"
          >
            <option value="">All States</option>
            {states.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="p-8 text-center">
          <svg className="w-6 h-6 animate-spin text-primary-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xs text-census-gray-500">Loading from Unity Catalog…</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-slate-800 z-10">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className="px-3 py-2.5 text-left text-census-gray-400 font-medium cursor-pointer hover:text-white transition select-none whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <svg className={`w-3 h-3 ${sortAsc ? "" : "rotate-180"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
                <th className="px-3 py-2.5 text-left text-census-gray-400 font-medium whitespace-nowrap">Top Factor</th>
                <th className="px-3 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.slice(0, 100).map((row) => (
                <tr key={row.county_fips} className="hover:bg-white/3 transition">
                  <td className="px-3 py-2 text-white font-medium">{row.county_name}</td>
                  <td className="px-3 py-2 text-census-gray-400">{row.state_abbr}</td>
                  <td className={`px-3 py-2 font-mono ${responseColor(row.crrall)}`}>
                    {row.crrall != null ? `${row.crrall.toFixed(1)}%` : "—"}
                  </td>
                  <td className={`px-3 py-2 font-mono font-semibold ${riskColor(row.risk_score)}`}>
                    {row.risk_score != null ? row.risk_score.toFixed(2) : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-census-gray-400">
                    {row.pct_no_broadband != null ? `${row.pct_no_broadband.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-census-gray-400">
                    {row.pct_language_barrier != null ? `${row.pct_language_barrier.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2 font-mono text-census-gray-400">
                    {row.pct_renter != null ? `${row.pct_renter.toFixed(1)}%` : "—"}
                  </td>
                  <td className="px-3 py-2">
                    {row.top_factor && (
                      <span className="px-2 py-0.5 bg-slate-700/60 rounded text-census-gray-300 whitespace-nowrap">
                        {row.top_factor}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => navigate(`/investigate?county_fips=${row.county_fips}`)}
                      className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-census-gray-400 hover:text-white transition"
                    >
                      →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 100 && (
            <p className="text-center text-[10px] text-census-gray-600 py-2 border-t border-white/5">
              Showing first 100 of {filtered.length.toLocaleString()} counties — use filters to narrow
            </p>
          )}
        </div>
      )}

      <div className="px-5 py-2 border-t border-white/5 text-[10px] text-census-gray-600 flex items-center justify-between">
        <span>Source: <code className="text-blue-400/60 font-mono">census_operations_demo.operations.root_cause_join</code></span>
        <span>Sortable · Filterable · Click → to investigate</span>
      </div>
    </div>
  );
}
