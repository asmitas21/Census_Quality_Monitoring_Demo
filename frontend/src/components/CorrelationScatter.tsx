import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  ZAxis,
  Label,
} from "recharts";
import { get } from "../api/client";

type CountyPoint = {
  county_fips: string;
  county_name: string;
  state_abbr: string;
  crrall: number | null;
  crrint: number | null;
  pct_no_broadband: number | null;
  pct_spanish_limited_english: number | null;
  risk_score: number | null;
  is_anomaly: boolean;
  top_factor: string | null;
};

type ScatterData = {
  counties: CountyPoint[];
  total: number;
  lineage: string[];
};

function getPointColor(riskScore: number | null): string {
  if (riskScore === null) return "#64748b";
  if (riskScore > 0.75) return "#ef4444";
  if (riskScore > 0.5) return "#f97316";
  return "#64748b";
}

function getPointSize(isAnomaly: boolean): number {
  return isAnomaly ? 120 : 40;
}

type ScatterPlotProps = {
  data: CountyPoint[];
  xKey: "pct_no_broadband" | "pct_spanish_limited_english";
  xLabel: string;
  title: string;
  onPointClick: (fips: string) => void;
};

function SingleScatterPlot({ data, xKey, xLabel, title, onPointClick }: ScatterPlotProps) {
  const validData = data
    .filter((d) => d.crrall !== null && d[xKey] !== null)
    .map((d) => ({
      ...d,
      x: d[xKey] as number,
      y: d.crrall as number,
      z: getPointSize(d.is_anomaly),
      color: getPointColor(d.risk_score),
    }));

  const anomalyData = validData.filter((d) => d.is_anomaly);
  const normalData = validData.filter((d) => !d.is_anomaly);

  const xValues = validData.map((d) => d.x);
  const yValues = validData.map((d) => d.y);
  const xMean = xValues.reduce((a, b) => a + b, 0) / xValues.length;
  const yMean = yValues.reduce((a, b) => a + b, 0) / yValues.length;

  let slope = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < xValues.length; i++) {
    sumXY += (xValues[i] - xMean) * (yValues[i] - yMean);
    sumXX += (xValues[i] - xMean) ** 2;
  }
  if (sumXX !== 0) slope = sumXY / sumXX;
  const intercept = yMean - slope * xMean;

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: typeof validData[0] }> }) => {
    if (!active || !payload || !payload[0]) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-slate-800 border border-white/10 rounded-lg p-3 shadow-lg text-xs">
        <p className="font-semibold text-white">{d.county_name}, {d.state_abbr}</p>
        <div className="mt-2 space-y-1">
          <p className="text-census-gray-400">
            CRRALL: <span className="text-white font-medium">{d.y.toFixed(1)}%</span>
          </p>
          <p className="text-census-gray-400">
            {xLabel}: <span className="text-white font-medium">{d.x.toFixed(1)}%</span>
          </p>
          {d.risk_score && (
            <p className="text-census-gray-400">
              Risk Score: <span className={d.risk_score > 0.75 ? "text-red-400" : "text-orange-400"}>
                {(d.risk_score * 100).toFixed(0)}%
              </span>
            </p>
          )}
        </div>
        <p className="text-census-gray-500 mt-2 text-[10px]">Click to investigate</p>
      </div>
    );
  };

  return (
    <div className="bg-slate-800/50 rounded-xl border border-white/5 p-4">
      <h4 className="text-sm font-semibold text-white mb-3">{title}</h4>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              type="number"
              dataKey="x"
              domain={[0, "auto"]}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
            >
              <Label value={xLabel} offset={-20} position="insideBottom" fill="#94a3b8" fontSize={10} />
            </XAxis>
            <YAxis
              type="number"
              dataKey="y"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "#94a3b8" }}
              tickLine={false}
              label={{ value: "CRRALL %", angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 10 }}
            />
            <ZAxis type="number" dataKey="z" range={[30, 150]} />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={67} stroke="#3b82f6" strokeDasharray="5 5" strokeWidth={1} />
            <ReferenceLine
              segment={[
                { x: xMin, y: slope * xMin + intercept },
                { x: xMax, y: slope * xMax + intercept },
              ]}
              stroke="#a855f7"
              strokeDasharray="3 3"
              strokeWidth={1}
            />
            <Scatter
              data={normalData}
              fill="#64748b"
              fillOpacity={0.6}
              cursor="pointer"
              onClick={(data: { county_fips: string }) => onPointClick(data.county_fips)}
            />
            <Scatter
              data={anomalyData}
              cursor="pointer"
              onClick={(data: { county_fips: string }) => onPointClick(data.county_fips)}
            >
              {anomalyData.map((entry, index) => (
                <circle
                  key={`anomaly-${index}`}
                  r={8}
                  fill={entry.color}
                  stroke="#fff"
                  strokeWidth={1}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex items-center justify-between mt-2 text-xs">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-census-gray-400">High risk</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-census-gray-400">Medium risk</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-slate-500" />
            <span className="text-census-gray-400">Normal</span>
          </div>
        </div>
        <span className="text-census-gray-600">
          r = {slope < 0 ? "-" : ""}{Math.abs(slope).toFixed(2)}
        </span>
      </div>
    </div>
  );
}

export function CorrelationScatter() {
  const [data, setData] = useState<ScatterData | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(true);
    get<ScatterData>("/snapshot/scatterplot-data")
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handlePointClick = (fips: string) => {
    navigate(`/investigate?county_fips=${fips}`);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="bg-slate-800/50 rounded-xl border border-white/5 p-4">
            <div className="h-6 w-48 bg-slate-700 rounded animate-pulse mb-4" />
            <div className="h-64 bg-slate-700/50 rounded animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          Factor Correlation Analysis
        </h3>
        <span className="px-2 py-1 bg-primary-500/20 text-primary-400 text-xs rounded">
          Unity Catalog federated join — 3 tables
        </span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SingleScatterPlot
          data={data.counties}
          xKey="pct_no_broadband"
          xLabel="% No Broadband"
          title="Broadband Access vs Self-Response Rate"
          onPointClick={handlePointClick}
        />
        <SingleScatterPlot
          data={data.counties}
          xKey="pct_spanish_limited_english"
          xLabel="% Limited English"
          title="Language Barrier vs Self-Response Rate"
          onPointClick={handlePointClick}
        />
      </div>
    </div>
  );
}
