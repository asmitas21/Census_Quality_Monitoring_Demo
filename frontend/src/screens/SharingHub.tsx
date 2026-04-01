import { useEffect, useState, useCallback } from "react";
import { get, post } from "../api/client";

type Grant = {
  view_name: string;
  full_name: string;
  principal: string;
  action_type: string;
  object_type: string;
};

type GrantsResponse = {
  grants: Grant[];
  total: number;
  workspace_host: string;
};

type MetricView = {
  view_name: string;
  full_name: string;
  comment: string;
  databricks_url: string;
};

type MetricsResponse = {
  metrics: MetricView[];
  workspace_host: string;
};

export default function SharingHub() {
  const [grants, setGrants] = useState<Grant[]>([]);
  const [metricViews, setMetricViews] = useState<MetricView[]>([]);
  const [workspaceHost, setWorkspaceHost] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");
  const [granting, setGranting] = useState(false);
  const [grantResult, setGrantResult] = useState<{
    status: string;
    message?: string;
    databricks_url?: string;
    principal?: string;
    view_name?: string;
  } | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const fetchGrants = useCallback(() => {
    get<GrantsResponse>("/snapshot/metric-grants")
      .then((res) => {
        setGrants(res.grants || []);
        setWorkspaceHost(res.workspace_host || "");
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      get<GrantsResponse>("/snapshot/metric-grants"),
      get<MetricsResponse>("/snapshot/metric-definitions"),
    ])
      .then(([grantsRes, metricsRes]) => {
        setGrants(grantsRes.grants || []);
        setWorkspaceHost(grantsRes.workspace_host || "");
        setMetricViews(metricsRes.metrics || []);
        if (metricsRes.metrics?.length > 0) {
          setSelectedView(metricsRes.metrics[0].view_name);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleGrant = async () => {
    if (!selectedView || !recipientEmail.trim()) return;
    setGranting(true);
    setGrantResult(null);
    try {
      const result = await post<{
        status: string;
        message?: string;
        databricks_url?: string;
        principal?: string;
        view_name?: string;
      }>("/snapshot/metric-grants", {
        view_name: selectedView,
        principal: recipientEmail.trim(),
      });
      setGrantResult(result);
      if (result.status === "granted") {
        setRecipientEmail("");
        fetchGrants();
      }
    } catch (err) {
      setGrantResult({ status: "error", message: String(err) });
    } finally {
      setGranting(false);
    }
  };

  const handleRevoke = async (viewName: string, principal: string) => {
    const key = `${viewName}:${principal}`;
    setRevoking(key);
    try {
      await post("/snapshot/metric-grants/revoke", {
        view_name: viewName,
        principal,
      });
      fetchGrants();
    } catch (err) {
      console.error("Revoke failed:", err);
    } finally {
      setRevoking(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-64 bg-slate-800/50 rounded animate-pulse" />
        <div className="h-48 bg-slate-800/50 rounded-xl animate-pulse" />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <svg className="w-7 h-7 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Governed Access
        </h1>
        <p className="text-census-gray-400 mt-1">
          Grant and revoke access to metric views using Unity Catalog permissions.
          Every action executes real GRANT/REVOKE SQL in Databricks.
        </p>
      </div>

      {/* Grant Access Form */}
      <div className="bg-slate-800/50 rounded-xl border border-primary-500/20 p-6">
        <h3 className="text-white font-semibold mb-1 flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Grant Metric Access
        </h3>
        <p className="text-xs text-census-gray-500 mb-4">
          This executes <code className="text-green-400 bg-slate-900 px-1 rounded">GRANT SELECT ON TABLE ... TO `email`</code> in Unity Catalog.
        </p>

        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="block text-xs text-census-gray-400 mb-1">Metric View</label>
            <select
              value={selectedView}
              onChange={(e) => setSelectedView(e.target.value)}
              className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-primary-500 appearance-none cursor-pointer"
            >
              {metricViews.map((mv) => (
                <option key={mv.view_name} value={mv.view_name}>
                  {mv.view_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-xs text-census-gray-400 mb-1">Recipient Email</label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="analyst@census.gov"
              className="w-full px-3 py-2 bg-slate-900/50 border border-white/10 rounded-lg text-white text-sm placeholder-census-gray-600 focus:outline-none focus:border-primary-500"
              onKeyDown={(e) => { if (e.key === "Enter") handleGrant(); }}
            />
          </div>
          <button
            onClick={handleGrant}
            disabled={granting || !recipientEmail.trim()}
            className="px-5 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-slate-700 disabled:text-census-gray-500 text-white rounded-lg text-sm font-medium transition shrink-0"
          >
            {granting ? "Granting..." : "Grant SELECT"}
          </button>
        </div>

        {/* SQL Preview */}
        {selectedView && recipientEmail.trim() && (
          <div className="mt-3">
            <pre className="text-xs text-census-gray-500 bg-slate-950 px-3 py-2 rounded font-mono border border-white/5">
              GRANT SELECT ON TABLE census_operations_demo.operations.{selectedView} TO `{recipientEmail.trim()}`
            </pre>
          </div>
        )}

        {/* Grant Result */}
        {grantResult && (
          <div className={`mt-4 p-4 rounded-lg ${grantResult.status === "granted" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
            {grantResult.status === "granted" ? (
              <div>
                <p className="text-sm text-green-400 font-medium">
                  SELECT granted on {grantResult.view_name} to {grantResult.principal}
                </p>
                {grantResult.databricks_url && (
                  <a
                    href={grantResult.databricks_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-primary-500/20 text-primary-400 rounded text-sm hover:bg-primary-500/30 transition"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Verify in Databricks
                  </a>
                )}
              </div>
            ) : (
              <p className="text-sm text-red-400">{grantResult.message || "Grant failed"}</p>
            )}
          </div>
        )}
      </div>

      {/* Current Grants Table */}
      <div className="bg-slate-800/50 rounded-xl border border-white/5 overflow-hidden">
        <div className="p-5 border-b border-white/5">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <svg className="w-5 h-5 text-census-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Current Permissions
            <span className="text-xs text-census-gray-500 font-normal ml-2">
              (from SHOW GRANTS — live from Unity Catalog)
            </span>
          </h3>
        </div>

        {grants.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-census-gray-500 text-sm">No grants found on metric views. Use the form above to grant access.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-census-gray-500 uppercase border-b border-white/5">
                <th className="px-5 py-3">Metric View</th>
                <th className="px-5 py-3">Principal</th>
                <th className="px-5 py-3">Privilege</th>
                <th className="px-5 py-3">Object Type</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {grants.map((g, i) => {
                const revokeKey = `${g.view_name}:${g.principal}`;
                const isOwner = g.action_type === "OWN";
                const viewUrl = workspaceHost
                  ? `${workspaceHost}/explore/data/census_operations_demo/operations/${g.view_name}`
                  : "";

                return (
                  <tr key={i} className="hover:bg-white/[0.02] transition">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{g.view_name}</span>
                        {viewUrl && (
                          <a
                            href={viewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-census-gray-500 hover:text-primary-400 transition"
                            title="Open in Databricks"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                          </a>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-sm text-census-gray-300">{g.principal}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        isOwner
                          ? "bg-purple-500/20 text-purple-400"
                          : "bg-green-500/20 text-green-400"
                      }`}>
                        {g.action_type}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-xs text-census-gray-500">{g.object_type}</span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      {g.action_type === "SELECT" && (
                        <button
                          onClick={() => handleRevoke(g.view_name, g.principal)}
                          disabled={revoking === revokeKey}
                          className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded text-xs font-medium transition disabled:opacity-50"
                        >
                          {revoking === revokeKey ? "Revoking..." : "Revoke"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* How It Works */}
      <div className="bg-gradient-to-r from-primary-500/10 to-blue-500/10 rounded-xl border border-primary-500/20 p-6">
        <h3 className="text-white font-semibold mb-3">How Governed Access Works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
              <span className="text-blue-400 font-bold text-sm">1</span>
            </div>
            <p className="text-sm text-white font-medium">Define Once</p>
            <p className="text-xs text-census-gray-400">
              Metrics are defined as YAML in Unity Catalog. One formula, one source of truth.
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
              <span className="text-green-400 font-bold text-sm">2</span>
            </div>
            <p className="text-sm text-white font-medium">Grant Access</p>
            <p className="text-xs text-census-gray-400">
              GRANT SELECT to any user or group. No data copies, no ETL. Access is live.
            </p>
          </div>
          <div className="space-y-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 flex items-center justify-center">
              <span className="text-purple-400 font-bold text-sm">3</span>
            </div>
            <p className="text-sm text-white font-medium">Audit Everything</p>
            <p className="text-xs text-census-gray-400">
              Unity Catalog tracks who accessed what, when. Full lineage from metric to source table.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-census-gray-600 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4">
          <span className="text-green-500">Unity Catalog Governed</span>
          <span>|</span>
          <span>{grants.length} grants across {metricViews.length} metric views</span>
          <span>|</span>
          <span>GRANT/REVOKE executed via SQL Warehouse</span>
        </div>
        {workspaceHost && (
          <a
            href={`${workspaceHost}/explore/data/census_operations_demo/operations`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2 py-1 bg-white/5 rounded text-census-gray-400 hover:text-primary-400 transition"
          >
            Open UC Schema
          </a>
        )}
      </div>
    </div>
  );
}
