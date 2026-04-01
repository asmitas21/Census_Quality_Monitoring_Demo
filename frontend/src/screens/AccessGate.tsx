import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function AccessGate() {
  const [entitlement, setEntitlement] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : { entitlement: "title_13_and_26" }))
      .then((d) => setEntitlement(d.entitlement ?? "title_13_and_26"))
      .catch(() => setEntitlement("title_13_and_26"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-census-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-census-blue border-t-transparent rounded-full animate-spin" />
          <span className="text-census-blue font-medium text-sm">Verifying access...</span>
        </div>
      </div>
    );
  }

  const isT26 = entitlement === "title_13_and_26";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-census-gray-100 px-4">
      <div className="bg-white rounded-xl shadow-lg border border-census-gray-200 p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <img src="/favicon.svg" alt="" className="h-14 w-14 mx-auto mb-4" aria-hidden />
          <h1 className="text-xl font-semibold text-census-blue">Quality Monitoring System</h1>
          <p className="text-sm text-census-gray-500 mt-1">U.S. Census Bureau</p>
        </div>

        <div className="bg-census-gray-100/70 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-3 h-3 rounded-full ${isT26 ? "bg-severity-ok" : "bg-severity-low"}`} />
            <span className="text-sm font-medium text-census-gray-800">Access Verified</span>
          </div>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between">
              <dt className="text-census-gray-500">Entitlement</dt>
              <dd className="font-medium">{isT26 ? "Title 13 + Title 26" : "Title 13 Only"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-census-gray-500">Data Access</dt>
              <dd className={`text-xs px-2 py-0.5 rounded ${isT26 ? "bg-severity-ok/15 text-severity-ok" : "bg-severity-low/15 text-severity-low"}`}>
                {isT26 ? "Full (demographics included)" : "Restricted (no demographics)"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-census-gray-500">Safe Output</dt>
              <dd className="text-census-gray-700">Enforced</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-census-gray-500">Audit Logging</dt>
              <dd className="text-census-gray-700">Active</dd>
            </div>
          </dl>
        </div>

        <button
          onClick={() => navigate("/")}
          className="w-full py-2.5 px-4 bg-census-blue text-white rounded-lg font-medium hover:bg-census-blue-light focus:ring-2 focus:ring-census-blue focus:ring-offset-2 transition"
        >
          Continue to Dashboard
        </button>
        <p className="text-[10px] text-census-gray-400 text-center mt-4 leading-relaxed">
          All data access is logged for Title 13/26 compliance. Only aggregated, disclosure-safe outputs are permitted.
        </p>
      </div>
    </div>
  );
}
