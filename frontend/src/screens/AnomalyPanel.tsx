import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SeverityBadge from "../components/SeverityBadge";
import Skeleton from "../components/Skeleton";
import Button from "../components/Button";
import { useToast } from "../components/Toast";
import { get, post } from "../api/client";
import { useFilterStore } from "../store/filters";

type Anomaly = {
  id: string;
  kpi: string;
  kpi_group: string;
  geography: string;
  geography_id: string;
  time_scope: string;
  delta_pct: number;
  severity: string;
  persistence_weeks: number;
  safe_to_display: boolean;
};

export default function AnomalyPanel() {
  const [items, setItems] = useState<Anomaly[] | null>(null);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("");
  const [sortBy, setSortBy] = useState("severity");
  const [sortDir, setSortDir] = useState("desc");
  const navigate = useNavigate();
  const { toast } = useToast();
  const { kpiGroup, geography } = useFilterStore();

  const load = () => {
    setItems(null);
    const params: Record<string, string> = { sort_by: sortBy, sort_dir: sortDir };
    if (kpiGroup) params.kpi_group = kpiGroup;
    if (geography) params.geography = geography;
    if (severityFilter) params.severity = severityFilter;
    if (search) params.search = search;
    get<{ items: Anomaly[] }>("/anomalies", params).then((r) => setItems(r.items));
  };

  useEffect(() => {
    load();
  }, [kpiGroup, geography, severityFilter, sortBy, sortDir]);

  const handleSearch = () => load();

  const handleCreateInvestigation = async (anomaly: Anomaly) => {
    try {
      await post("/investigations", {
        title: `${anomaly.kpi} anomaly in ${anomaly.geography}`,
        anomaly_ids: [anomaly.id],
        notes: `Auto-created from anomaly panel. Delta: ${anomaly.delta_pct}%, Severity: ${anomaly.severity}.`,
      });
      toast("Investigation created", "success");
    } catch {
      toast("Failed to create investigation", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Alerts</h1>
        <p className="text-white/70 text-sm mt-1">
          Real-time anomaly detection based on Census Bureau data. These alerts are computed from 
          actual response rate deviations in Unity Catalog.
        </p>
      </div>

      {/* Search and filter bar */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-white/60 mb-1">Search</label>
          <div className="flex gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="Search KPI or geography..."
              className="flex-1 rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <Button onClick={handleSearch} className="text-sm px-3 py-2">Search</Button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Severity</label>
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Sort by</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="severity">Severity</option>
            <option value="delta_pct">Delta %</option>
            <option value="kpi">KPI Name</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-white/60 mb-1">Direction</label>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </div>

      {items === null ? (
        <Skeleton variant="table" rows={8} />
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-white/5 p-4">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-white/70">{items.length} alerts found</span>
            <span className="text-xs text-white/50">Source: census_operations_demo.operations</span>
          </div>
          
          {/* Custom table with white text */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">KPI</th>
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">Geography</th>
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">Time</th>
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">Delta</th>
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">Persistence</th>
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">Severity</th>
                  <th className="text-left text-xs font-medium text-white/60 pb-3 px-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr 
                    key={row.id} 
                    className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition"
                    onClick={() => navigate(`/drilldown?anomaly_id=${row.id}`)}
                  >
                    <td className="py-3 px-2 text-sm text-white">{row.kpi}</td>
                    <td className="py-3 px-2 text-sm text-white">{row.geography}</td>
                    <td className="py-3 px-2 text-sm text-white/70">{row.time_scope}</td>
                    <td className="py-3 px-2">
                      <span className={`text-sm font-medium tabular-nums ${
                        Math.abs(row.delta_pct) > 20 ? "text-red-400" : 
                        Math.abs(row.delta_pct) > 10 ? "text-orange-400" : "text-white"
                      }`}>
                        {row.delta_pct > 0 ? "+" : ""}{row.delta_pct}%
                      </span>
                    </td>
                    <td className="py-3 px-2 text-sm text-white/60">{row.persistence_weeks}w</td>
                    <td className="py-3 px-2">
                      <SeverityBadge severity={row.severity as "high" | "medium" | "low"} />
                    </td>
                    <td className="py-3 px-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => navigate(`/drilldown?anomaly_id=${row.id}`)}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          Drill
                        </button>
                        <span className="text-white/20">|</span>
                        <button
                          onClick={() => handleCreateInvestigation(row)}
                          className="text-xs text-primary-400 hover:text-primary-300"
                        >
                          Investigate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
