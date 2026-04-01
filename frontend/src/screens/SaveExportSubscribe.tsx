import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import Skeleton from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { get, post } from "../api/client";
import { useFilterStore } from "../store/filters";

type SavedView = {
  id: string;
  name: string;
  kpi_group: string;
  benchmark_set: string;
  filters: Record<string, string>;
  created_at: string;
};

export default function SaveExportSubscribe() {
  const [viewName, setViewName] = useState("");
  const [savedViews, setSavedViews] = useState<SavedView[] | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [thresholdPct, setThresholdPct] = useState(20);
  const { toast } = useToast();
  const { timeWindow, geography, kpiGroup, benchmarkSet } = useFilterStore();

  const loadViews = () => {
    get<{ items: SavedView[] }>("/views").then((r) => setSavedViews(r.items));
  };

  useEffect(() => {
    loadViews();
  }, []);

  const handleSaveView = async () => {
    if (!viewName.trim()) return;
    await post("/views", {
      name: viewName.trim(),
      filters: { time_window: timeWindow, geography, kpi_group: kpiGroup },
      kpi_group: kpiGroup,
      benchmark_set: benchmarkSet,
    });
    setViewName("");
    toast("View saved successfully", "success");
    loadViews();
  };

  const handleLoadView = (view: SavedView) => {
    const { setTimeWindow, setGeography, setKpiGroup, setBenchmarkSet } = useFilterStore.getState();
    if (view.filters.time_window) setTimeWindow(view.filters.time_window);
    if (view.filters.geography) setGeography(view.filters.geography);
    if (view.filters.kpi_group) setKpiGroup(view.filters.kpi_group);
    if (view.benchmark_set) setBenchmarkSet(view.benchmark_set);
    toast(`Loaded view: ${view.name}`, "info");
  };

  const handleExportCsv = () => {
    window.open(`/api/export/summary?format=csv&kpi_group=${kpiGroup}&time_window=${timeWindow}`, "_blank");
    toast("CSV export started", "success");
  };

  const handleExportSql = async () => {
    const r = await get<{ query: string; params: Record<string, string> }>("/export/sql", { kpi_group: kpiGroup, time_window: timeWindow });
    const text = `-- Params: ${JSON.stringify(r.params)}\n${r.query}`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quality_query.sql";
    a.click();
    URL.revokeObjectURL(url);
    toast("SQL query exported", "success");
  };

  const handleAiSummary = async () => {
    setAiLoading(true);
    try {
      const r = await post<{ summary: string }>(`/ai/summarize?kpi_group=${kpiGroup}`, {});
      setAiSummary(r.summary);
      toast("AI summary generated", "success");
    } catch {
      toast("Failed to generate summary", "error");
    }
    setAiLoading(false);
  };

  const handleExportAiSummary = () => {
    if (!aiSummary) return;
    const blob = new Blob([aiSummary], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quality_monitoring_summary.md";
    a.click();
    URL.revokeObjectURL(url);
    toast("Summary exported", "success");
  };

  const handleSubscribe = async () => {
    await post("/export/subscriptions", { threshold_pct: thresholdPct });
    toast(`Subscribed to alerts at ±${thresholdPct}% threshold`, "success");
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-census-gray-800">Save, Export & Subscribe</h1>
        <p className="text-census-gray-500 text-sm mt-1">Save views, export safe summaries, generate AI reports, and subscribe to threshold alerts.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Save view */}
        <Card title="Save Current View">
          <p className="text-sm text-census-gray-600 mb-3">Save current filters, KPI group, and benchmark set for quick access.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={viewName}
              onChange={(e) => setViewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSaveView()}
              placeholder="View name"
              className="flex-1 rounded border border-census-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-census-blue"
            />
            <Button onClick={handleSaveView} disabled={!viewName.trim()} className="text-sm">Save</Button>
          </div>
          <p className="text-xs text-census-gray-400 mt-2">
            Currently: {kpiGroup} &middot; {timeWindow} &middot; {benchmarkSet.replace("_", " ")}
          </p>
        </Card>

        {/* Saved views list */}
        <Card title="Saved Views">
          {savedViews === null ? (
            <Skeleton rows={3} />
          ) : savedViews.length === 0 ? (
            <p className="text-sm text-census-gray-500">No saved views yet.</p>
          ) : (
            <ul className="space-y-1 max-h-48 overflow-y-auto">
              {savedViews.map((v) => (
                <li key={v.id} className="flex items-center justify-between py-2 border-b border-census-gray-100 last:border-0">
                  <div>
                    <button onClick={() => handleLoadView(v)} className="text-sm font-medium text-census-blue hover:underline">
                      {v.name}
                    </button>
                    <p className="text-xs text-census-gray-500">{v.kpi_group} &middot; {v.benchmark_set?.replace("_", " ")}</p>
                  </div>
                  <span className="text-xs text-census-gray-400">{v.created_at ? new Date(v.created_at).toLocaleDateString() : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Export CSV */}
        <Card title="Export Safe Summary">
          <p className="text-sm text-census-gray-600 mb-3">Download aggregated, disclosure-safe data as CSV.</p>
          <Button variant="secondary" onClick={handleExportCsv} className="text-sm">Export CSV</Button>
        </Card>

        {/* Export SQL */}
        <Card title="Export SQL Query">
          <p className="text-sm text-census-gray-600 mb-3">Get parameterized Unity Catalog query for power users.</p>
          <Button variant="outline" onClick={handleExportSql} className="text-sm">Export SQL</Button>
        </Card>

        {/* AI Summary */}
        <Card title="AI Executive Summary" className="md:col-span-2">
          <p className="text-sm text-census-gray-600 mb-3">
            Generate an AI-powered narrative summary of current quality metrics for stakeholder briefings.
          </p>
          <div className="flex gap-2 mb-3">
            <Button onClick={handleAiSummary} disabled={aiLoading} className="text-sm">
              {aiLoading ? "Generating..." : "Generate AI Summary"}
            </Button>
            {aiSummary && (
              <Button variant="outline" onClick={handleExportAiSummary} className="text-sm">Export as Markdown</Button>
            )}
          </div>
          {aiSummary && (
            <div className="bg-census-gray-100 rounded-lg p-4 text-sm text-census-gray-700 whitespace-pre-wrap leading-relaxed max-h-80 overflow-y-auto">
              {aiSummary}
            </div>
          )}
        </Card>

        {/* Subscribe */}
        <Card title="Subscribe to Alerts" className="md:col-span-2">
          <p className="text-sm text-census-gray-600 mb-3">Get notified when KPI thresholds are breached.</p>
          <div className="flex items-center gap-3">
            <label className="text-sm text-census-gray-700">Threshold:</label>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={thresholdPct}
              onChange={(e) => setThresholdPct(Number(e.target.value))}
              className="flex-1 max-w-xs"
            />
            <span className="text-sm font-medium tabular-nums w-12">&plusmn;{thresholdPct}%</span>
            <Button variant="outline" onClick={handleSubscribe} className="text-sm">Subscribe</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
