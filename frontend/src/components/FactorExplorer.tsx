/**
 * FactorExplorer — dynamic scatter plot letting users pick any 2 demographic
 * factors as X and Y axes, with dots colored by a 3rd factor (risk score by
 * default). Shows Pearson r-value correlation and a linear trend line.
 */
import { useEffect, useState, useMemo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { get } from "../api/client";
import { useFilterStore } from "../store/filters";

// ── Factor definitions ────────────────────────────────────────────────────────
type FactorKey =
  | "crrall"
  | "crrint"
  | "pct_no_broadband"
  | "pct_language_barrier"
  | "pct_renter"
  | "pct_undeliverable"
  | "vacancy_rate";

const FACTORS: { key: FactorKey; label: string; unit: string; t26Only?: boolean }[] = [
  { key: "crrall",               label: "Self-Response Rate",    unit: "%" },
  { key: "crrint",               label: "Internet Response Rate", unit: "%" },
  { key: "pct_no_broadband",     label: "No Broadband",          unit: "%" },
  { key: "pct_language_barrier", label: "Language Barrier",      unit: "%", t26Only: true },
  { key: "pct_renter",           label: "Renter Rate",           unit: "%", t26Only: true },
  { key: "pct_undeliverable",    label: "Undeliverable Mail",    unit: "%" },
  { key: "vacancy_rate",         label: "Vacancy Rate",          unit: "%" },
];

// ── Data types ────────────────────────────────────────────────────────────────
type CountyLayerRow = {
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
  top_factor: string | null;
  score_delta: number | null;
};

// ── Math helpers ──────────────────────────────────────────────────────────────
function pearsonR(xs: number[], ys: number[]): number | null {
  if (xs.length < 3) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const num = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0);
  const dx = Math.sqrt(xs.reduce((acc, x) => acc + (x - mx) ** 2, 0));
  const dy = Math.sqrt(ys.reduce((acc, y) => acc + (y - my) ** 2, 0));
  if (dx === 0 || dy === 0) return null;
  return num / (dx * dy);
}

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number } | null {
  if (xs.length < 2) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const slope = xs.reduce((acc, x, i) => acc + (x - mx) * (ys[i] - my), 0) /
                xs.reduce((acc, x) => acc + (x - mx) ** 2, 0);
  const intercept = my - slope * mx;
  return { slope, intercept };
}

// ── Color helper — dots colored by response rate ──────────────────────────────
function crrallToColor(crrall: number | null): string {
  if (crrall === null) return "#6b7280";
  if (crrall < 50)  return "#ef4444";
  if (crrall < 60)  return "#f97316";
  if (crrall < 67)  return "#eab308";
  return "#22c55e";
}

// ── Custom dot ────────────────────────────────────────────────────────────────
function CustomDot(props: {
  cx?: number;
  cy?: number;
  payload?: { crrall: number | null; name: string };
}) {
  const { cx = 0, cy = 0, payload } = props;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={3}
      fill={crrallToColor(payload?.crrall ?? null)}
      fillOpacity={0.7}
      stroke="none"
    />
  );
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
function ScatterTooltip({ active, payload }: { active?: boolean; payload?: { payload: { name: string; state: string; x: number; y: number; crrall: number | null } }[] }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-white font-semibold">{d.name}</p>
      <p className="text-slate-400">{d.state}</p>
      <p className="text-slate-300 mt-1">X: <span className="text-white">{d.x?.toFixed(1)}</span></p>
      <p className="text-slate-300">Y: <span className="text-white">{d.y?.toFixed(1)}</span></p>
      {d.crrall !== null && (
        <p className="text-slate-300 mt-1">
          Response Rate: <span style={{ color: crrallToColor(d.crrall) }}>{d.crrall.toFixed(1)}%</span>
        </p>
      )}
    </div>
  );
}

// ── R-value badge ─────────────────────────────────────────────────────────────
function CorrelationBadge({ r }: { r: number | null }) {
  if (r === null) return null;
  const abs = Math.abs(r);
  const strength = abs >= 0.7 ? "Strong" : abs >= 0.4 ? "Moderate" : "Weak";
  const direction = r > 0 ? "positive" : "negative";
  const color =
    abs >= 0.7
      ? r > 0 ? "text-red-400" : "text-green-400"
      : abs >= 0.4
      ? "text-yellow-400"
      : "text-census-gray-400";

  return (
    <div className="flex items-center gap-2 bg-slate-900/60 border border-white/10 rounded-lg px-4 py-2">
      <span className="text-census-gray-400 text-sm">Correlation (r)</span>
      <span className={`text-xl font-bold tabular-nums ${color}`}>{r.toFixed(3)}</span>
      <span className={`text-xs px-2 py-0.5 rounded-full border ${color} border-current`}>
        {strength} {direction}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function FactorExplorer() {
  const [data, setData] = useState<CountyLayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [xFactor, setXFactor] = useState<FactorKey>("pct_no_broadband");
  const [yFactor, setYFactor] = useState<FactorKey>("crrall");

  const { entitlement } = useFilterStore();
  const isT26 = entitlement === "title_13_and_26";
  // Only show T26-only factors if user has T26 access
  const availableFactors = FACTORS.filter((f) => !f.t26Only || isT26);

  useEffect(() => {
    get<{ counties: CountyLayerRow[] }>("/snapshot/county-layer")
      .then((res) => setData(res.counties))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const xDef = FACTORS.find((f) => f.key === xFactor)!;
  const yDef = FACTORS.find((f) => f.key === yFactor)!;

  const points = useMemo(() => {
    return data
      .filter((c) => c[xFactor] !== null && c[yFactor] !== null)
      .map((c) => ({
        x: c[xFactor] as number,
        y: c[yFactor] as number,
        crrall: c.crrall,
        name: c.county_name,
        state: c.state_abbr,
        fips: c.county_fips,
      }));
  }, [data, xFactor, yFactor]);

  const r = useMemo(() => {
    if (points.length < 3) return null;
    return pearsonR(points.map((p) => p.x), points.map((p) => p.y));
  }, [points]);

  const trendLine = useMemo(() => {
    if (points.length < 2) return null;
    const reg = linearRegression(points.map(p => p.x), points.map(p => p.y));
    if (!reg) return null;
    const xs = points.map((p) => p.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    return {
      x1: minX,
      y1: reg.slope * minX + reg.intercept,
      x2: maxX,
      y2: reg.slope * maxX + reg.intercept,
    };
  }, [points]);

  const xDomain = useMemo(() => {
    if (!points.length) return [0, 100] as [number, number];
    const xs = points.map(p => p.x);
    const min = Math.floor(Math.min(...xs));
    const max = Math.ceil(Math.max(...xs));
    return [min, max] as [number, number];
  }, [points]);

  const yDomain = useMemo(() => {
    if (!points.length) return [0, 100] as [number, number];
    const ys = points.map(p => p.y);
    const min = Math.floor(Math.min(...ys));
    const max = Math.ceil(Math.max(...ys));
    return [min, max] as [number, number];
  }, [points]);

  return (
    <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-white">Factor Explorer</h3>
          <p className="text-xs text-census-gray-400 mt-0.5">
            Pick two factors to explore their correlation across all {points.length.toLocaleString()} counties
          </p>
        </div>
        {!loading && <CorrelationBadge r={r} />}
      </div>

      {/* Axis selectors */}
      <div className="flex flex-wrap items-center gap-4 mb-4">
        <AxisSelect label="X Axis" value={xFactor} onChange={(v) => setXFactor(v as FactorKey)} exclude={yFactor} availableFactors={availableFactors} />
        <AxisSelect label="Y Axis" value={yFactor} onChange={(v) => setYFactor(v as FactorKey)} exclude={xFactor} availableFactors={availableFactors} />
        <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
          <span>Dot color = Response Rate:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span>≥67%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            <span>60–67%</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span>&lt;60%</span>
          </div>
        </div>
      </div>

      {loading && (
        <div className="h-80 flex items-center justify-center text-census-gray-400 text-sm">
          Loading county data from Unity Catalog…
        </div>
      )}

      {error && (
        <div className="h-80 flex items-center justify-center text-red-400 text-sm">{error}</div>
      )}

      {!loading && !error && (
        <ResponsiveContainer width="100%" height={380}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" />
            <XAxis
              dataKey="x"
              type="number"
              domain={xDomain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{ value: `${xDef.label}${xDef.unit ? ` (${xDef.unit})` : ""}`, position: "insideBottom", offset: -15, fill: "#94a3b8", fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#94a3b8", fontSize: 11 }}
              label={{ value: `${yDef.label}${yDef.unit ? ` (${yDef.unit})` : ""}`, angle: -90, position: "insideLeft", offset: 10, fill: "#94a3b8", fontSize: 11 }}
            />
            <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#475569" }} />

            {/* Trend line as reference line */}
            {trendLine && (
              <ReferenceLine
                segment={[
                  { x: trendLine.x1, y: trendLine.y1 },
                  { x: trendLine.x2, y: trendLine.y2 },
                ]}
                stroke="#60a5fa"
                strokeDasharray="6 3"
                strokeWidth={1.5}
                strokeOpacity={0.6}
              />
            )}

            <Scatter
              data={points}
              shape={<CustomDot />}
            />
          </ScatterChart>
        </ResponsiveContainer>
      )}

      {!loading && !error && r !== null && (
        <div className="mt-3 text-xs text-census-gray-500">
          <span className="text-census-gray-400">Interpretation: </span>
          {Math.abs(r) >= 0.7
            ? `Strong correlation (r=${r.toFixed(2)}). ${r < 0 ? "Higher" : "Lower"} ${xDef.label} is strongly associated with ${r < 0 ? "lower" : "higher"} ${yDef.label}.`
            : Math.abs(r) >= 0.4
            ? `Moderate correlation (r=${r.toFixed(2)}). ${xDef.label} shows a noticeable relationship with ${yDef.label}.`
            : `Weak correlation (r=${r.toFixed(2)}). ${xDef.label} and ${yDef.label} may not be directly related.`}
          <span className="ml-2 text-census-gray-600">· n={points.length.toLocaleString()} counties · Unity Catalog</span>
        </div>
      )}
    </div>
  );
}

// ── Axis dropdown ─────────────────────────────────────────────────────────────
function AxisSelect({
  label,
  value,
  onChange,
  exclude,
  availableFactors,
}: {
  label: string;
  value: FactorKey;
  onChange: (v: string) => void;
  exclude: FactorKey;
  availableFactors: typeof FACTORS;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-census-gray-400 font-medium w-10">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-700 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary-500"
      >
        {availableFactors.filter((f) => f.key !== exclude).map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </div>
  );
}
