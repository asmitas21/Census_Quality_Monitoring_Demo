import { useEffect, useState } from "react";
import { get } from "../api/client";

type TableClassification = {
  table_name: string;
  full_name: string;
  classification: string;
  sensitivity: string;
  description: string;
};

type MaskingPolicy = {
  policy_name: string;
  applied_to: string;
  column: string;
  rule: string;
  description: string;
};

type RowFilter = {
  filter_name: string;
  applied_to: string;
  condition: string;
  description: string;
};

type ComplianceData = {
  tables: TableClassification[];
  total_tables: number;
  grants: Record<string, string>[];
  masking_policies: MaskingPolicy[];
  row_filters: RowFilter[];
  summary: {
    title_13_tables: number;
    title_26_tables: number;
    public_tables: number;
    federated_tables: number;
    masking_policies_count: number;
    row_filters_count: number;
  };
  workspace_host: string;
  catalog_url: string;
};

const CLASSIFICATION_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  TITLE_13_PROTECTED: { bg: "bg-red-500/20", text: "text-red-400", label: "Title 13 Protected" },
  TITLE_26_IRS: { bg: "bg-purple-500/20", text: "text-purple-400", label: "Title 26 IRS" },
  MULTI_SOURCE_FEDERATED: { bg: "bg-orange-500/20", text: "text-orange-400", label: "Multi-Source Federated" },
  AGENCY_RESTRICTED: { bg: "bg-yellow-500/20", text: "text-yellow-400", label: "Agency Restricted" },
  DERIVED_INTERNAL: { bg: "bg-blue-500/20", text: "text-blue-400", label: "Derived Internal" },
  PUBLIC_AGGREGATE: { bg: "bg-green-500/20", text: "text-green-400", label: "Public Aggregate" },
  PUBLIC_METHODOLOGY: { bg: "bg-green-500/20", text: "text-green-400", label: "Public Methodology" },
  UNCLASSIFIED: { bg: "bg-slate-500/20", text: "text-slate-400", label: "Unclassified" },
};

const SENSITIVITY_STYLES: Record<string, string> = {
  Critical: "text-red-400 bg-red-500/10 border-red-500/20",
  High: "text-orange-400 bg-orange-500/10 border-orange-500/20",
  Medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Low: "text-green-400 bg-green-500/10 border-green-500/20",
};

export default function CompliancePanel() {
  const [data, setData] = useState<ComplianceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"classification" | "masking" | "rowfilters" | "grants">("classification");

  useEffect(() => {
    get<ComplianceData>("/snapshot/compliance")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12 w-80 bg-slate-800/50 rounded animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-slate-800/50 rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-slate-800/50 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!data) return null;

  const title13Tables = data.tables.filter((t) => t.classification === "TITLE_13_PROTECTED");
  const otherTables = data.tables.filter((t) => t.classification !== "TITLE_13_PROTECTED");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Title 13 / Title 26 Compliance
          </h1>
          <p className="text-census-gray-400 mt-1">
            Federal data protection enforcement via Unity Catalog — classification, column masking, row-level security, and access audit.
          </p>
        </div>
        {data.catalog_url && (
          <a
            href={data.catalog_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition flex items-center gap-2 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Open in Unity Catalog
          </a>
        )}
      </div>

      {/* Legal Context Banner */}
      <div className="bg-gradient-to-r from-red-500/10 via-purple-500/10 to-red-500/10 rounded-xl border border-red-500/20 p-5">
        <div className="grid grid-cols-2 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-red-500/20 text-red-400 text-xs font-medium rounded">Title 13, U.S.C.</span>
            </div>
            <p className="text-sm text-census-gray-300">
              All Census responses are <strong className="text-white">confidential by federal law</strong>. Data cannot be shared with law enforcement, IRS, immigration, or any non-statistical agency. Violations are punishable by up to 5 years imprisonment and $250,000 in fines.
            </p>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs font-medium rounded">Title 26, IRC</span>
            </div>
            <p className="text-sm text-census-gray-300">
              IRS tax data used by the Census Bureau for address validation and income estimation is protected under the <strong className="text-white">Internal Revenue Code</strong>. Access restricted to Title 26-authorized personnel only.
            </p>
          </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-6 gap-3">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{data.summary.title_13_tables}</p>
          <p className="text-xs text-census-gray-400 mt-1">Title 13 Protected</p>
        </div>
        <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-purple-400">{data.summary.title_26_tables}</p>
          <p className="text-xs text-census-gray-400 mt-1">Title 26 IRS</p>
        </div>
        <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-green-400">{data.summary.public_tables}</p>
          <p className="text-xs text-census-gray-400 mt-1">Public Data</p>
        </div>
        <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-orange-400">{data.summary.federated_tables}</p>
          <p className="text-xs text-census-gray-400 mt-1">Federated Sources</p>
        </div>
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-blue-400">{data.summary.masking_policies_count}</p>
          <p className="text-xs text-census-gray-400 mt-1">Masking Policies</p>
        </div>
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-yellow-400">{data.summary.row_filters_count}</p>
          <p className="text-xs text-census-gray-400 mt-1">Row Filters</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 pb-px">
        {([
          { key: "classification" as const, label: "Data Classification", icon: "M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" },
          { key: "masking" as const, label: "Column Masking", icon: "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" },
          { key: "rowfilters" as const, label: "Row-Level Security", icon: "M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" },
          { key: "grants" as const, label: "Access Grants", icon: "M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" },
        ]).map(({ key, label, icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition flex items-center gap-2 ${
              activeTab === key
                ? "bg-slate-800 text-white border border-white/10 border-b-slate-800 -mb-px"
                : "text-census-gray-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
            </svg>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-slate-800/30 rounded-xl border border-white/5 p-6">
        {activeTab === "classification" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">Data Classification Registry</h3>
              <p className="text-xs text-census-gray-500">{data.total_tables} tables in census_operations_demo.operations</p>
            </div>

            {/* Title 13 Protected */}
            <div>
              <h4 className="text-sm font-medium text-red-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                Title 13 Protected ({title13Tables.length} tables)
              </h4>
              <div className="space-y-2">
                {title13Tables.map((t) => {
                  const style = CLASSIFICATION_STYLES[t.classification] || CLASSIFICATION_STYLES.UNCLASSIFIED;
                  const sensStyle = SENSITIVITY_STYLES[t.sensitivity] || "";
                  return (
                    <div key={t.table_name} className="flex items-start gap-4 p-3 bg-slate-900/50 rounded-lg border border-red-500/10 hover:border-red-500/20 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-white font-mono font-medium">{t.table_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sensStyle}`}>{t.sensitivity}</span>
                        </div>
                        <p className="text-xs text-census-gray-500 leading-relaxed">{t.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Other Classifications */}
            <div>
              <h4 className="text-sm font-medium text-census-gray-400 uppercase tracking-wide mb-3">Other Classifications</h4>
              <div className="space-y-2">
                {otherTables.map((t) => {
                  const style = CLASSIFICATION_STYLES[t.classification] || CLASSIFICATION_STYLES.UNCLASSIFIED;
                  const sensStyle = SENSITIVITY_STYLES[t.sensitivity] || "";
                  return (
                    <div key={t.table_name} className="flex items-start gap-4 p-3 bg-slate-900/50 rounded-lg border border-white/5 hover:border-white/10 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm text-white font-mono font-medium">{t.table_name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.text}`}>{style.label}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${sensStyle}`}>{t.sensitivity}</span>
                        </div>
                        <p className="text-xs text-census-gray-500 leading-relaxed">{t.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "masking" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Column Masking Policies</h3>
              <p className="text-sm text-census-gray-400">Unity Catalog column masks automatically redact sensitive values based on the querying user's group membership. Non-authorized users see masked values — the data never leaves the platform unprotected.</p>
            </div>

            {data.masking_policies.map((p) => (
              <div key={p.policy_name} className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <svg className="w-4 h-4 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                        </svg>
                        {p.policy_name}
                      </h4>
                      <p className="text-xs text-census-gray-500 mt-1">{p.description}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-orange-500/20 text-orange-400 text-[10px] font-medium rounded shrink-0">COLUMN MASK</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div>
                      <span className="text-census-gray-500">Applied to: </span>
                      <span className="text-primary-400 font-mono">{p.applied_to}</span>
                    </div>
                    <div>
                      <span className="text-census-gray-500">Column: </span>
                      <span className="text-white font-mono">{p.column}</span>
                    </div>
                  </div>
                </div>
                <div className="border-t border-white/5 bg-slate-950/50 px-5 py-3">
                  <p className="text-[10px] text-census-gray-500 uppercase mb-1">Masking Rule (SQL)</p>
                  <pre className="text-xs text-green-400 font-mono">{p.rule}</pre>
                </div>

                {/* Before/After Demo */}
                <div className="border-t border-white/5 px-5 py-4">
                  <p className="text-[10px] text-census-gray-500 uppercase mb-2">What users see</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-red-400 font-medium mb-1">Standard Analyst</p>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{p.column}:</span>
                        <span className="text-red-400 font-mono text-sm bg-red-500/10 px-2 py-0.5 rounded">***</span>
                      </div>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-green-400 font-medium mb-1">Authorized Statistician</p>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono text-sm">{p.column}:</span>
                        <span className="text-green-400 font-mono text-sm bg-green-500/10 px-2 py-0.5 rounded">42.8</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "rowfilters" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Row-Level Security Filters</h3>
              <p className="text-sm text-census-gray-400">Unity Catalog row filters automatically exclude rows that could enable re-identification. Small-population tracts and geographies are suppressed for non-authorized users — the rows simply don't appear in query results.</p>
            </div>

            {data.row_filters.map((f) => (
              <div key={f.filter_name} className="bg-slate-900/50 rounded-xl border border-white/10 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="text-white font-semibold flex items-center gap-2">
                        <svg className="w-4 h-4 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        {f.filter_name}
                      </h4>
                      <p className="text-xs text-census-gray-500 mt-1">{f.description}</p>
                    </div>
                    <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-[10px] font-medium rounded shrink-0">ROW FILTER</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-census-gray-500">Applied to: </span>
                    <span className="text-primary-400 font-mono">{f.applied_to}</span>
                  </div>
                </div>
                <div className="border-t border-white/5 bg-slate-950/50 px-5 py-3">
                  <p className="text-[10px] text-census-gray-500 uppercase mb-1">Filter Condition (SQL)</p>
                  <pre className="text-xs text-green-400 font-mono">{f.condition}</pre>
                </div>
                <div className="border-t border-white/5 px-5 py-4">
                  <p className="text-[10px] text-census-gray-500 uppercase mb-2">Effect</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-red-500/5 border border-red-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-red-400 font-medium mb-1">Standard Analyst Query</p>
                      <p className="text-xs text-census-gray-400">Small-population rows <span className="text-red-400 font-medium">excluded from results</span> — analyst sees fewer rows but never knows protected data exists.</p>
                    </div>
                    <div className="bg-green-500/5 border border-green-500/10 rounded-lg p-3">
                      <p className="text-[10px] text-green-400 font-medium mb-1">Title 13 Authorized Statistician</p>
                      <p className="text-xs text-census-gray-400">All rows visible including <span className="text-green-400 font-medium">small-population geographies</span> — full access for authorized research.</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === "grants" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-1">Active Access Grants</h3>
              <p className="text-sm text-census-gray-400">Live from Unity Catalog — every grant is auditable, revocable, and tracked. Shows who has access to governed metric views in the metrics schema.</p>
            </div>

            {data.grants.length === 0 ? (
              <div className="text-center py-12 text-census-gray-500">
                <p>No active grants found on metric views.</p>
              </div>
            ) : (
              <div className="bg-slate-900/40 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left text-[10px] font-medium text-census-gray-400 uppercase px-4 py-3">Principal</th>
                      <th className="text-left text-[10px] font-medium text-census-gray-400 uppercase px-4 py-3">Privilege</th>
                      <th className="text-left text-[10px] font-medium text-census-gray-400 uppercase px-4 py-3">Object</th>
                      <th className="text-left text-[10px] font-medium text-census-gray-400 uppercase px-4 py-3">Granted By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.grants.map((g, i) => (
                      <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="px-4 py-2.5 text-white font-mono text-xs">{g.principal || g.Principal || "—"}</td>
                        <td className="px-4 py-2.5">
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-xs rounded">{g.privilege || g.ActionType || "SELECT"}</span>
                        </td>
                        <td className="px-4 py-2.5 text-primary-400 font-mono text-xs">{g.object || g.ObjectKey || "—"}</td>
                        <td className="px-4 py-2.5 text-census-gray-400 text-xs">{g.granted_by || g.GrantedBy || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-primary-500/10 border border-primary-500/20 rounded-lg">
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-xs text-primary-400">Every access is logged in Unity Catalog system tables (system.access.audit). Full audit trail for Title 13/26 compliance reporting.</span>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-census-gray-600 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4">
          <span className="text-red-400">Title 13 Enforced</span>
          <span>|</span>
          <span className="text-purple-400">Title 26 Enforced</span>
          <span>|</span>
          <span>Catalog: census_operations_demo</span>
          <span>|</span>
          <span>{data.total_tables} tables classified</span>
        </div>
        <span className="text-green-400">Unity Catalog Governed</span>
      </div>
    </div>
  );
}
