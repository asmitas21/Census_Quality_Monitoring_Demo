import { useEffect, useState, useCallback } from "react";
import { get } from "../api/client";
import { useFilterStore } from "../store/filters";

type AuditEntry = {
  timestamp: string;
  user: string;
  method: string;
  path: string;
  status: number;
  duration_ms: number;
  entitlement: string;
};

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [userFilter, setUserFilter] = useState("");
  const [methodFilter, setMethodFilter] = useState("");
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { userEmail } = useFilterStore();

  const load = useCallback(() => {
    const params: Record<string, string> = { limit: "50" };
    if (userFilter) params.user = userFilter;
    if (methodFilter) params.method = methodFilter;
    get<{ items: AuditEntry[]; compliance_note: string }>("/audit/log", params).then((r) => {
      setEntries(r.items);
      setLastRefresh(new Date());
    });
  }, [userFilter, methodFilter]);

  useEffect(() => {
    load();
  }, [methodFilter]);

  // Auto-refresh every 10 seconds so live audit entries show up
  useEffect(() => {
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
  }, [load]);

  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/15 text-blue-400",
    POST: "bg-green-500/15 text-green-400",
    PATCH: "bg-yellow-500/15 text-yellow-400",
    DELETE: "bg-red-500/15 text-red-400",
  };

  const statusColor = (status: number) => {
    if (status >= 200 && status < 300) return "text-green-400";
    if (status >= 400) return "text-red-400";
    return "text-census-gray-400";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
          <p className="text-census-gray-400 text-sm mt-1">
            Title 13/26 compliance — all API access is logged in real time.
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {lastRefresh && (
            <span className="text-xs text-census-gray-500">
              Updated {lastRefresh.toLocaleTimeString()}
            </span>
          )}
          <div className="flex items-center gap-1.5 text-xs text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            Live
          </div>
          <button
            onClick={load}
            className="px-3 py-1.5 text-xs rounded-lg bg-white/5 hover:bg-white/10 text-white transition border border-white/10"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Compliance banner */}
      <div className="bg-primary-500/10 border border-primary-500/20 rounded-lg px-4 py-3 text-sm text-census-gray-300">
        <strong className="text-white">Compliance Note:</strong> Every API call made in this app is captured here — user identity, method, path, status code, and duration.
        {userEmail && (
          <span> You are currently logged in as <span className="text-white font-medium">{userEmail}</span>.</span>
        )}
        {" "}Demographic data access by Title 13-only users is blocked and logged with 403 status.
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs font-medium text-census-gray-400">Filter by user</label>
            {userEmail && !userFilter && (
              <button
                onClick={() => setUserFilter(userEmail)}
                className="text-[10px] text-primary-400 hover:text-primary-300 transition"
              >
                Use my email
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Email..."
              className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white placeholder-census-gray-600 w-64 focus:outline-none focus:border-primary-500"
            />
            <button onClick={load} className="px-3 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 text-white transition">Apply</button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-census-gray-400 mb-1">Method</label>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-900/50 px-3 py-2 text-sm text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">All</option>
            <option value="GET">GET</option>
            <option value="POST">POST</option>
            <option value="PATCH">PATCH</option>
          </select>
        </div>
      </div>

      {entries === null ? (
        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-10 bg-slate-800/50 rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="bg-slate-800/50 rounded-xl border border-white/5 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-white/5">
                  {["Timestamp", "User", "Method", "Path", "Status", "Duration", "Entitlement"].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-census-gray-400 uppercase tracking-wider bg-slate-900/30">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {entries.map((entry, i) => (
                  <tr key={i} className={`hover:bg-white/[0.02] transition ${entry.user === userEmail ? "bg-primary-500/5 border-l-2 border-primary-500/40" : ""}`}>
                    <td className="px-4 py-2.5 text-xs text-census-gray-400 tabular-nums">
                      {new Date(entry.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-white">{entry.user}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded ${methodColors[entry.method] || "text-census-gray-400"}`}>
                        {entry.method}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-census-gray-300 font-mono">{entry.path}</td>
                    <td className={`px-4 py-2.5 text-xs font-medium ${statusColor(entry.status)}`}>
                      {entry.status}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-census-gray-400 tabular-nums">{entry.duration_ms.toFixed(1)}ms</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        entry.entitlement === "title_13_and_26"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-yellow-500/15 text-yellow-400"
                      }`}>
                        {entry.entitlement === "title_13_and_26" ? "T13+T26" : "T13 only"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-census-gray-500 px-4 py-3 border-t border-white/5">{entries.length} entries shown</p>
        </div>
      )}
    </div>
  );
}
