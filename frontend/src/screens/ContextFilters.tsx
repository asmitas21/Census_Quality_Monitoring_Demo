import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import { useFilterStore } from "../store/filters";
import { get } from "../api/client";
import { useToast } from "../components/Toast";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";

type DemographicItem = { category: string; value: number; benchmark: number; delta_pct: number };
type CollectionModeItem = { mode: string; value: number; benchmark: number; delta_pct: number; count: number };

export default function ContextFilters() {
  const {
    timeWindow, geography, kpiGroup, benchmarkSet, demographicDimension, collectionMode,
    setTimeWindow, setGeography, setKpiGroup, setBenchmarkSet, setDemographicDimension, setCollectionMode,
  } = useFilterStore();

  const [demographics, setDemographics] = useState<DemographicItem[] | null>(null);
  const [collectionModes, setCollectionModes] = useState<CollectionModeItem[] | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (demographicDimension) {
      get<{ items: DemographicItem[] }>("/drilldown/demographics", {
        kpi_name: "Overall Response Rate",
        dimension: demographicDimension,
      }).then((r) => setDemographics(r.items));
    } else {
      setDemographics(null);
    }
  }, [demographicDimension]);

  useEffect(() => {
    get<{ items: CollectionModeItem[] }>("/drilldown/collection-modes", {
      kpi_name: "Overall Response Rate",
    }).then((r) => setCollectionModes(r.items));
  }, []);

  const handleReset = () => {
    setTimeWindow("weekly");
    setGeography("");
    setKpiGroup("quality");
    setBenchmarkSet("2020_census");
    setDemographicDimension("");
    setCollectionMode("");
    toast("Filters reset", "info");
  };

  const kpiGroupLabels: Record<string, string> = { quality: "Quality", response_rate: "Response Rate", operations: "Operations" };
  const geoLabels: Record<string, string> = {
    "": "All States", "06": "California", "12": "Florida", "36": "New York", "48": "Texas",
    "17": "Illinois", "42": "Pennsylvania", "13": "Georgia", "39": "Ohio",
    "37": "North Carolina", "26": "Michigan", "04": "Arizona", "53": "Washington",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-census-gray-800">Context Filters</h1>
        <p className="text-census-gray-500 text-sm mt-1">Define snapshot context: time, geography, demographics, collection mode, KPI group, and benchmark set.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filter controls */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Snapshot Filters">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-census-gray-700 mb-1">Time Window</label>
                <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)}
                  className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none">
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-census-gray-700 mb-1">KPI Group</label>
                <select value={kpiGroup} onChange={(e) => setKpiGroup(e.target.value)}
                  className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none">
                  <option value="quality">Quality</option>
                  <option value="response_rate">Response Rate</option>
                  <option value="operations">Operations</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-census-gray-700 mb-1">Benchmark Set</label>
                <select value={benchmarkSet} onChange={(e) => setBenchmarkSet(e.target.value)}
                  className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none">
                  <option value="2020_census">2020 Census</option>
                  <option value="rolling_avg">Rolling Average</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-census-gray-700 mb-1">Geography</label>
                <select value={geography} onChange={(e) => setGeography(e.target.value)}
                  className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none">
                  {Object.entries(geoLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-census-gray-700 mb-1">Demographic Dimension</label>
                <select value={demographicDimension} onChange={(e) => setDemographicDimension(e.target.value)}
                  className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none">
                  <option value="">None</option>
                  <option value="age_group">Age Group</option>
                  <option value="sex">Sex</option>
                  <option value="race">Race</option>
                  <option value="tenure">Tenure</option>
                  <option value="relationship">Relationship</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-census-gray-700 mb-1">Collection Mode</label>
                <select value={collectionMode} onChange={(e) => setCollectionMode(e.target.value)}
                  className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none">
                  <option value="">All Modes</option>
                  <option value="internet">Internet</option>
                  <option value="phone">Phone (CATI)</option>
                  <option value="mail">Mail</option>
                  <option value="in_person">In-Person (NRFU)</option>
                  <option value="proxy">Proxy</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <Button variant="ghost" onClick={handleReset} className="text-sm">Reset All</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Current context display + preview charts */}
        <div className="lg:col-span-2 space-y-6">
          <Card title="Current Context Summary">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Time Window", value: timeWindow },
                { label: "KPI Group", value: kpiGroupLabels[kpiGroup] || kpiGroup },
                { label: "Benchmark", value: benchmarkSet.replace("_", " ") },
                { label: "Geography", value: geoLabels[geography] || geography || "All States" },
                { label: "Demographic", value: demographicDimension ? demographicDimension.replace("_", " ") : "None" },
                { label: "Collection Mode", value: collectionMode || "All Modes" },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-census-gray-100/50 rounded-lg">
                  <p className="text-xs text-census-gray-500 font-medium uppercase tracking-wide">{item.label}</p>
                  <p className="text-sm font-medium text-census-gray-800 mt-0.5 capitalize">{item.value}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Demographic preview chart */}
          {demographics && demographics.length > 0 && (
            <Card title={`Demographic Preview: ${demographicDimension.replace("_", " ")}`}>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={demographics}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                    <XAxis dataKey="category" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <ReferenceLine y={demographics[0]?.benchmark} stroke="#9e9e9e" strokeDasharray="5 5" />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {demographics.map((d, i) => (
                        <Cell key={i} fill={d.delta_pct < -10 ? "#b71c1c" : d.delta_pct > 5 ? "#2e7d32" : "#004b87"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Collection mode preview */}
          {collectionModes && (
            <Card title="Collection Mode Overview">
              <div className="space-y-3">
                {collectionModes.map((m) => {
                  const pct = Math.min(100, Math.max(5, (m.value / (m.benchmark * 1.2)) * 100));
                  return (
                    <div key={m.mode}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-census-gray-700">{m.mode}</span>
                        <span className="text-census-gray-500">
                          {m.value} ({m.delta_pct > 0 ? "+" : ""}{m.delta_pct}%) &middot; {m.count.toLocaleString()} responses
                        </span>
                      </div>
                      <div className="w-full bg-census-gray-200 rounded-full h-2.5">
                        <div
                          className={`h-2.5 rounded-full transition-all ${m.delta_pct >= 0 ? "bg-severity-ok" : "bg-census-blue"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
