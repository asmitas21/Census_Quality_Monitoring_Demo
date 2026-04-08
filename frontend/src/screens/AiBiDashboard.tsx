import { useState } from "react";
import { useWorkspaceHost, dashboardUrl, dashboardEmbedUrl } from "../hooks/useWorkspaceHost";

const DASHBOARD_ID = import.meta.env.VITE_DASHBOARD_ID || "";

const PAGES = [
  { key: "command_center", label: "Command Center" },
  { key: "high_risk", label: "High Risk Counties" },
  { key: "county_explorer", label: "County Explorer" },
  { key: "composite_metrics", label: "Composite Metrics" },
];

export default function AiBiDashboard() {
  const [activePage, setActivePage] = useState(0);
  const host = useWorkspaceHost();

  const embedUrl = dashboardEmbedUrl(host, DASHBOARD_ID, activePage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-semibold text-census-gray-800">
            AI/BI Dashboard
          </h1>
          <p className="text-census-gray-500 text-sm mt-1">
            Native Databricks AI/BI &middot; Querying Unity Catalog &middot;
            Real census data
          </p>
        </div>
        <a
          href={dashboardUrl(host, DASHBOARD_ID)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-census-blue hover:underline flex items-center gap-1"
        >
          Open in Databricks &rarr;
        </a>
      </div>

      <div className="flex gap-1 border-b border-census-gray-200">
        {PAGES.map((page, idx) => (
          <button
            key={page.key}
            onClick={() => setActivePage(idx)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition ${
              activePage === idx
                ? "border-census-blue text-census-blue"
                : "border-transparent text-census-gray-500 hover:text-census-gray-700 hover:border-census-gray-300"
            }`}
          >
            {page.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-census-gray-200 overflow-hidden shadow-sm">
        <iframe
          key={activePage}
          src={embedUrl}
          title="Census Quality Command Center"
          className="w-full border-0"
          style={{ height: "calc(100vh - 240px)", minHeight: "600px" }}
          allow="fullscreen"
        />
      </div>
    </div>
  );
}
