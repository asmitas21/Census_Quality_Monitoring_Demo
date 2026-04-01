import { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ComposableMap,
  Geographies,
  Geography,
  ZoomableGroup,
} from "react-simple-maps";
import { get } from "../api/client";
import { useFilterStore } from "../store/filters";

const STATES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";
const COUNTIES_GEO_URL = "https://cdn.jsdelivr.net/npm/us-atlas@3/counties-10m.json";

type DrillLevel = "national" | "state" | "county";

// ── Layer definitions ────────────────────────────────────────────────────────
type LayerKey =
  | "crrall"
  | "crrint"
  | "pct_no_broadband"
  | "pct_language_barrier"
  | "pct_renter"
  | "pct_undeliverable";

type LayerDef = {
  key: LayerKey;
  label: string;
  unit: string;
  description: string;
  higherIsBad: boolean;
  thresholds: [number, number, number];
  colors: [string, string, string, string];
  t26Only?: boolean;
};

const LAYERS: LayerDef[] = [
  {
    key: "crrall",
    label: "Response Rate",
    unit: "%",
    description: "Self-response rate (CRRALL)",
    higherIsBad: false,
    thresholds: [50, 60, 67],
    colors: ["#b71c1c", "#e65100", "#f9a825", "#2e7d32"],
  },
  {
    key: "crrint",
    label: "Internet Rate",
    unit: "%",
    description: "Internet response rate (CRRINT)",
    higherIsBad: false,
    thresholds: [30, 45, 55],
    colors: ["#b71c1c", "#e65100", "#f9a825", "#1565c0"],
  },
  {
    key: "pct_no_broadband",
    label: "No Broadband",
    unit: "%",
    description: "% households without broadband",
    higherIsBad: true,
    thresholds: [15, 25, 40],
    colors: ["#1565c0", "#f9a825", "#e65100", "#b71c1c"],
  },
  {
    key: "pct_language_barrier",
    label: "Language Barrier",
    unit: "%",
    description: "% Spanish-speaking, limited English",
    higherIsBad: true,
    thresholds: [5, 10, 20],
    colors: ["#1565c0", "#f9a825", "#e65100", "#b71c1c"],
    t26Only: true,
  },
  {
    key: "pct_renter",
    label: "Renter Rate",
    unit: "%",
    description: "% renter-occupied housing units",
    higherIsBad: true,
    thresholds: [20, 35, 50],
    colors: ["#1565c0", "#f9a825", "#e65100", "#b71c1c"],
    t26Only: true,
  },
  {
    key: "pct_undeliverable",
    label: "Undeliverable Mail",
    unit: "%",
    description: "% USPS undeliverable addresses",
    higherIsBad: true,
    thresholds: [5, 10, 20],
    colors: ["#1565c0", "#f9a825", "#e65100", "#b71c1c"],
  },
];

// ── National county layer type ───────────────────────────────────────────────
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
  top_factor: string | null;
  top_factor_1: string | null;
  score_delta: number | null;
  vacancy_rate: number | null;
};

// ── Existing types ────────────────────────────────────────────────────────────
type StateKpi = {
  kpi: string;
  value: number;
  baseline: number;
  delta_pct: number;
  unit: string;
  severity: string;
};

type StateData = {
  geography_id: string;
  geography: string;
  abbr: string;
  kpis: StateKpi[];
  anomaly_count: number;
};

type MapResponse = {
  states: StateData[];
  kpi_group: string;
  time_window: string;
};

type County = {
  county_fips: string;
  county_name: string;
  state_fips: string;
  crrall: number | null;
  crrint: number | null;
  risk_score: number | null;
  is_high_risk: boolean;
  top_factor: string | null;
};

type CountyResponse = {
  state_fips: string;
  state_abbr: string;
  state_name: string;
  counties: County[];
  summary: {
    total_counties: number;
    state_avg_crrall: number | null;
    national_avg_crrall: number;
    high_risk_count: number;
    worst_county_name: string | null;
    worst_county_crrall: number | null;
  };
};

type Tract = {
  tract_fips: string;
  tract_name: string;
  county_fips: string;
  crrall: number | null;
  crrall_2010: number | null;
  delta: number | null;
};

type TractResponse = {
  county_fips: string;
  county_name: string;
  state_abbr: string;
  tracts: Tract[];
  summary: {
    total_tracts: number;
    county_avg_crrall: number | null;
    worst_tract_name: string | null;
    worst_tract_crrall: number | null;
  };
};

const STATE_FIPS_TO_NAME: Record<string, string> = {
  "01": "Alabama", "02": "Alaska", "04": "Arizona", "05": "Arkansas", "06": "California",
  "08": "Colorado", "09": "Connecticut", "10": "Delaware", "11": "District of Columbia",
  "12": "Florida", "13": "Georgia", "15": "Hawaii", "16": "Idaho", "17": "Illinois",
  "18": "Indiana", "19": "Iowa", "20": "Kansas", "21": "Kentucky", "22": "Louisiana",
  "23": "Maine", "24": "Maryland", "25": "Massachusetts", "26": "Michigan", "27": "Minnesota",
  "28": "Mississippi", "29": "Missouri", "30": "Montana", "31": "Nebraska", "32": "Nevada",
  "33": "New Hampshire", "34": "New Jersey", "35": "New Mexico", "36": "New York",
  "37": "North Carolina", "38": "North Dakota", "39": "Ohio", "40": "Oklahoma", "41": "Oregon",
  "42": "Pennsylvania", "44": "Rhode Island", "45": "South Carolina", "46": "South Dakota",
  "47": "Tennessee", "48": "Texas", "49": "Utah", "50": "Vermont", "51": "Virginia",
  "53": "Washington", "54": "West Virginia", "55": "Wisconsin", "56": "Wyoming",
  "72": "Puerto Rico",
};

const STATE_CENTERS: Record<string, { center: [number, number]; zoom: number }> = {
  "01": { center: [-86.9, 32.8], zoom: 5 },
  "02": { center: [-153, 64], zoom: 2.5 },
  "04": { center: [-111.9, 34.2], zoom: 5 },
  "05": { center: [-92.4, 34.8], zoom: 6 },
  "06": { center: [-119.4, 37.2], zoom: 4 },
  "08": { center: [-105.5, 39], zoom: 5 },
  "09": { center: [-72.7, 41.6], zoom: 12 },
  "10": { center: [-75.5, 39], zoom: 12 },
  "11": { center: [-77, 38.9], zoom: 40 },
  "12": { center: [-81.7, 28.5], zoom: 4.5 },
  "13": { center: [-83.5, 32.7], zoom: 5 },
  "15": { center: [-157, 20.5], zoom: 6 },
  "16": { center: [-114.7, 44.2], zoom: 4.5 },
  "17": { center: [-89.2, 40], zoom: 5 },
  "18": { center: [-86.3, 39.8], zoom: 6 },
  "19": { center: [-93.5, 42], zoom: 6 },
  "20": { center: [-98.3, 38.5], zoom: 5 },
  "21": { center: [-85.3, 37.8], zoom: 6 },
  "22": { center: [-91.8, 30.9], zoom: 5.5 },
  "23": { center: [-69.2, 45.3], zoom: 5.5 },
  "24": { center: [-76.8, 39.1], zoom: 8 },
  "25": { center: [-71.8, 42.3], zoom: 9 },
  "26": { center: [-84.7, 44.3], zoom: 5 },
  "27": { center: [-94.3, 46.3], zoom: 5 },
  "28": { center: [-89.7, 32.8], zoom: 5.5 },
  "29": { center: [-92.5, 38.5], zoom: 5 },
  "30": { center: [-109.6, 47], zoom: 4.5 },
  "31": { center: [-99.8, 41.5], zoom: 5 },
  "32": { center: [-116.6, 39.3], zoom: 4.5 },
  "33": { center: [-71.6, 43.7], zoom: 8 },
  "34": { center: [-74.7, 40.2], zoom: 9 },
  "35": { center: [-106.2, 34.5], zoom: 4.5 },
  "36": { center: [-75.5, 43], zoom: 5 },
  "37": { center: [-79.8, 35.6], zoom: 5.5 },
  "38": { center: [-100.5, 47.5], zoom: 5.5 },
  "39": { center: [-82.8, 40.4], zoom: 6 },
  "40": { center: [-97.5, 35.5], zoom: 5 },
  "41": { center: [-120.5, 43.8], zoom: 5 },
  "42": { center: [-77.6, 41], zoom: 5.5 },
  "44": { center: [-71.5, 41.7], zoom: 14 },
  "45": { center: [-80.9, 33.9], zoom: 6 },
  "46": { center: [-100.2, 44.4], zoom: 5 },
  "47": { center: [-86.3, 35.8], zoom: 5.5 },
  "48": { center: [-99.3, 31.5], zoom: 3.8 },
  "49": { center: [-111.7, 39.3], zoom: 5 },
  "50": { center: [-72.6, 44], zoom: 8 },
  "51": { center: [-79.5, 37.5], zoom: 5.5 },
  "53": { center: [-120.7, 47.4], zoom: 5 },
  "54": { center: [-80.6, 38.6], zoom: 6 },
  "55": { center: [-89.6, 44.6], zoom: 5.5 },
  "56": { center: [-107.5, 43], zoom: 5 },
  "72": { center: [-66.5, 18.2], zoom: 8 },
};

// ── Color helpers ────────────────────────────────────────────────────────────
function getLayerColor(layer: LayerDef, value: number | null): string {
  if (value === null) return "#374151";
  const [t1, t2, t3] = layer.thresholds;
  const [c0, c1, c2, c3] = layer.colors;
  if (value < t1) return c0;
  if (value < t2) return c1;
  if (value < t3) return c2;
  return c3;
}

function crrallToColor(value: number | null): string {
  if (value === null) return "#64748b";
  if (value < 50) return "#b71c1c";
  if (value < 60) return "#e65100";
  if (value < 67) return "#f9a825";
  return "#2e7d32";
}

function padFips(id: string): string {
  return id.length < 5 ? id.padStart(5, "0") : id;
}

function fmt(v: number | null, unit = "%", decimals = 1): string {
  if (v === null || v === undefined) return "—";
  return `${v.toFixed(decimals)}${unit}`;
}

type StateAgg = {
  abbr: string;
  name: string;
  county_count: number;
  avg_crrall: number | null;
  avg_crrint: number | null;
  avg_no_broadband: number | null;
  avg_language_barrier: number | null;
  avg_renter: number | null;
  avg_undeliverable: number | null;
  worst_county: string | null;
  worst_crrall: number | null;
};

// ── Rich county tooltip ──────────────────────────────────────────────────────
function CountyTooltip({ county }: { county: CountyLayerRow }) {
  const { entitlement } = useFilterStore();
  const isT26 = entitlement === "title_13_and_26";
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl px-4 py-3 w-64 text-xs">
      <div className="font-semibold text-white text-sm mb-1">{county.county_name}</div>
      <div className="text-slate-400 mb-2">{county.state_abbr}</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <FactorRow label="Response Rate" value={fmt(county.crrall)} color={crrallToColor(county.crrall)} />
        <FactorRow label="Internet Rate" value={fmt(county.crrint)} color="#60a5fa" />
        <FactorRow label="No Broadband" value={fmt(county.pct_no_broadband)} color="#f97316" />
        {isT26 && <FactorRow label="Language Barrier" value={fmt(county.pct_language_barrier)} color="#a78bfa" />}
        {isT26 && <FactorRow label="Renter Rate" value={fmt(county.pct_renter)} color="#38bdf8" />}
        <FactorRow label="Undeliverable" value={fmt(county.pct_undeliverable)} color="#fb923c" />
        <FactorRow label="Vacancy Rate" value={fmt(county.vacancy_rate)} color="#94a3b8" />
      </div>
      {county.top_factor && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-slate-400">Primary Factor: </span>
          <span className="text-white font-medium">{county.top_factor}</span>
        </div>
      )}
      {!isT26 && (
        <div className="mt-2 pt-2 border-t border-white/10 text-yellow-400/70 text-[10px]">
          T26 required for language & renter data
        </div>
      )}
    </div>
  );
}

function StateTooltip({ state, isT26 }: { state: StateAgg; isT26: boolean }) {
  return (
    <div className="bg-slate-900 border border-white/10 rounded-xl shadow-2xl px-4 py-3 w-72 text-xs">
      <div className="font-semibold text-white text-sm mb-0.5">{state.name}</div>
      <div className="text-slate-400 mb-2">{state.county_count} counties</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        <FactorRow label="Avg Response Rate" value={fmt(state.avg_crrall)} color={crrallToColor(state.avg_crrall)} />
        <FactorRow label="Avg Internet Rate" value={fmt(state.avg_crrint)} color="#60a5fa" />
        <FactorRow label="Avg No Broadband" value={fmt(state.avg_no_broadband)} color="#f97316" />
        {isT26 && <FactorRow label="Avg Language Barrier" value={fmt(state.avg_language_barrier)} color="#a78bfa" />}
        {isT26 && <FactorRow label="Avg Renter Rate" value={fmt(state.avg_renter)} color="#38bdf8" />}
        <FactorRow label="Avg Undeliverable" value={fmt(state.avg_undeliverable)} color="#fb923c" />
      </div>
      {state.worst_county && (
        <div className="mt-2 pt-2 border-t border-white/10">
          <span className="text-slate-400">Lowest Response: </span>
          <span className="text-white font-medium">{state.worst_county}</span>
          <span className="ml-1 font-semibold" style={{ color: crrallToColor(state.worst_crrall) }}>
            {fmt(state.worst_crrall)}
          </span>
        </div>
      )}
      {!isT26 && (
        <div className="mt-2 pt-2 border-t border-white/10 text-yellow-400/70 text-[10px]">
          T26 required for language & renter data
        </div>
      )}
    </div>
  );
}

function FactorRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <>
      <span className="text-census-gray-400">{label}</span>
      <span className="font-semibold" style={{ color }}>{value}</span>
    </>
  );
}

// ── Layer selector pills ─────────────────────────────────────────────────────
function LayerSelector({ active, onChange, layers }: { active: LayerKey; onChange: (k: LayerKey) => void; layers: LayerDef[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mb-3">
      {layers.map((layer) => (
        <button
          key={layer.key}
          onClick={() => onChange(layer.key)}
          title={layer.description}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
            active === layer.key
              ? "bg-primary-500 border-primary-400 text-white shadow-sm"
              : "bg-slate-700/50 border-white/10 text-census-gray-400 hover:text-white hover:border-white/20"
          }`}
        >
          {layer.label}
        </button>
      ))}
    </div>
  );
}

// ── Dynamic legend ────────────────────────────────────────────────────────────
function LayerLegend({ layer }: { layer: LayerDef }) {
  const [t1, t2, t3] = layer.thresholds;
  const [c0, c1, c2, c3] = layer.colors;
  const u = layer.unit;
  const bands = [
    { color: c0, label: `<${t1}${u}` },
    { color: c1, label: `${t1}–${t2}${u}` },
    { color: c2, label: `${t2}–${t3}${u}` },
    { color: c3, label: `≥${t3}${u}` },
  ];
  return (
    <div className="bg-slate-900/50 rounded-lg p-4">
      <h4 className="text-xs font-medium text-census-gray-400 uppercase mb-2">{layer.label}</h4>
      <p className="text-[10px] text-census-gray-500 mb-3">{layer.description}</p>
      <div className="space-y-1.5">
        {bands.map((b) => (
          <div key={b.label} className="flex items-center gap-2 text-xs">
            <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: b.color }} />
            <span className="text-census-gray-400">{b.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs">
          <span className="w-3 h-3 rounded flex-shrink-0 bg-slate-600" />
          <span className="text-census-gray-400">No data</span>
        </div>
      </div>
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
type Props = {
  compact?: boolean;
  showSidebar?: boolean;
  initialStateFips?: string;
};

// ── Main component ────────────────────────────────────────────────────────────
export function DrillDownMap({ compact = false, showSidebar = true, initialStateFips }: Props) {
  const [level, setLevel] = useState<DrillLevel>("national");
  const [statesData, setStatesData] = useState<MapResponse | null>(null);
  const [countyData, setCountyData] = useState<CountyResponse | null>(null);
  const [tractData, setTractData] = useState<TractResponse | null>(null);
  const [selectedStateFips, setSelectedStateFips] = useState<string | null>(initialStateFips || null);
  const [selectedCountyFips, setSelectedCountyFips] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // National county layer — loaded once, cached
  const [countyLayer, setCountyLayer] = useState<Map<string, CountyLayerRow>>(new Map());
  const [_countyLayerLoading, setCountyLayerLoading] = useState(false);
  const [activeLayer, setActiveLayer] = useState<LayerKey>("crrall");

  const [tooltip, setTooltip] = useState<
    | { x: number; y: number; county: CountyLayerRow; kind: "county" }
    | { x: number; y: number; state: StateAgg; kind: "state" }
    | null
  >(null);

  const navigate = useNavigate();

  const { entitlement } = useFilterStore();
  const isT26 = entitlement === "title_13_and_26";
  // Filter layers based on entitlement
  const availableLayers = LAYERS.filter((l) => !l.t26Only || isT26);

  const activeDef = availableLayers.find((l) => l.key === activeLayer) ?? availableLayers[0];

  const stateAggMap = useMemo(() => {
    if (countyLayer.size === 0) return new Map<string, StateAgg>();

    const ABBR_TO_FIPS: Record<string, string> = {
      AL:"01",AK:"02",AZ:"04",AR:"05",CA:"06",CO:"08",CT:"09",DE:"10",DC:"11",
      FL:"12",GA:"13",HI:"15",ID:"16",IL:"17",IN:"18",IA:"19",KS:"20",KY:"21",
      LA:"22",ME:"23",MD:"24",MA:"25",MI:"26",MN:"27",MS:"28",MO:"29",MT:"30",
      NE:"31",NV:"32",NH:"33",NJ:"34",NM:"35",NY:"36",NC:"37",ND:"38",OH:"39",
      OK:"40",OR:"41",PA:"42",RI:"44",SC:"45",SD:"46",TN:"47",TX:"48",UT:"49",
      VT:"50",VA:"51",WA:"53",WV:"54",WI:"55",WY:"56",PR:"72",
    };

    const buckets = new Map<string, CountyLayerRow[]>();
    for (const c of countyLayer.values()) {
      if (!c.state_abbr) continue;
      let arr = buckets.get(c.state_abbr);
      if (!arr) { arr = []; buckets.set(c.state_abbr, arr); }
      arr.push(c);
    }

    const result = new Map<string, StateAgg>();
    for (const [abbr, counties] of buckets) {
      const avg = (fn: (c: CountyLayerRow) => number | null) => {
        const vals = counties.map(fn).filter((v): v is number => v !== null);
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
      };
      const worst = counties.reduce<CountyLayerRow | null>((w, c) => {
        if (c.crrall === null) return w;
        if (!w || w.crrall === null || c.crrall < w.crrall) return c;
        return w;
      }, null);
      const fips = ABBR_TO_FIPS[abbr];
      if (!fips) continue;
      result.set(fips, {
        abbr,
        name: STATE_FIPS_TO_NAME[fips] || abbr,
        county_count: counties.length,
        avg_crrall: avg((c) => c.crrall),
        avg_crrint: avg((c) => c.crrint),
        avg_no_broadband: avg((c) => c.pct_no_broadband),
        avg_language_barrier: avg((c) => c.pct_language_barrier),
        avg_renter: avg((c) => c.pct_renter),
        avg_undeliverable: avg((c) => c.pct_undeliverable),
        worst_county: worst?.county_name ?? null,
        worst_crrall: worst?.crrall ?? null,
      });
    }
    return result;
  }, [countyLayer]);

  useEffect(() => {
    setLoading(true);
    get<MapResponse>("/snapshot/map", { kpi_group: "response_rate" })
      .then(setStatesData)
      .catch(console.error)
      .finally(() => setLoading(false));

    get<{ counties: CountyLayerRow[] }>("/snapshot/county-layer")
      .then((res) => {
        const m = new Map<string, CountyLayerRow>();
        for (const c of res.counties) {
          if (c.county_fips) m.set(c.county_fips, c);
        }
        setCountyLayer(m);
      })
      .catch(console.error);
  }, []);

  // Load county layer for a specific state after clicking into it
  const loadCountyLayer = useCallback(async (_stateFips: string) => {
    if (countyLayer.size > 0) return; // already cached nationally
    setCountyLayerLoading(true);
    get<{ counties: CountyLayerRow[] }>("/snapshot/county-layer")
      .then((res) => {
        const m = new Map<string, CountyLayerRow>();
        for (const c of res.counties) {
          if (c.county_fips) m.set(c.county_fips, c);
        }
        setCountyLayer(m);
      })
      .catch(console.error)
      .finally(() => setCountyLayerLoading(false));
  }, [countyLayer.size]);

  useEffect(() => {
    if (initialStateFips && statesData) {
      handleStateClick(initialStateFips);
    }
  }, [initialStateFips, statesData]);

  const stateMap = useMemo(() => {
    if (!statesData) return new Map<string, { state: StateData; kpi: StateKpi }>();
    const m = new Map<string, { state: StateData; kpi: StateKpi }>();
    for (const s of statesData.states) {
      const kpi = s.kpis.find((k) => k.kpi === "Self-Response Rate");
      if (kpi) m.set(s.geography_id, { state: s, kpi });
    }
    return m;
  }, [statesData]);

  const countyDataMap = useMemo(() => {
    if (!countyData) return new Map<string, County>();
    const m = new Map<string, County>();
    for (const c of countyData.counties) {
      m.set(c.county_fips, c);
    }
    return m;
  }, [countyData]);

  const handleStateClick = useCallback(async (stateFips: string) => {
    setSelectedStateFips(stateFips);
    setSelectedCountyFips(null);
    setTractData(null);
    setLevel("state");
    setLoading(true);
    // Start loading county layer for rich tooltips in state view
    loadCountyLayer(stateFips);
    try {
      const res = await get<CountyResponse>(`/snapshot/counties-enhanced/${stateFips}`);
      setCountyData(res);
    } catch (e) {
      console.error("Failed to load county data:", e);
    }
    setLoading(false);
  }, [loadCountyLayer]);

  const handleCountyClick = useCallback(async (countyFips: string) => {
    setSelectedCountyFips(countyFips);
    setLevel("county");
    setLoading(true);
    try {
      const res = await get<TractResponse>(`/snapshot/tracts/${countyFips}`);
      setTractData(res);
    } catch (e) {
      console.error("Failed to load tract data:", e);
    }
    setLoading(false);
  }, []);

  const handleBackToNational = () => {
    setLevel("national");
    setSelectedStateFips(null);
    setSelectedCountyFips(null);
    setCountyData(null);
    setTractData(null);
  };

  const handleBackToState = () => {
    setLevel("state");
    setSelectedCountyFips(null);
    setTractData(null);
  };

  const handleInvestigate = (countyFips: string) => {
    navigate(`/investigate?county_fips=${countyFips}`);
  };

  const selectedStateName = selectedStateFips ? STATE_FIPS_TO_NAME[selectedStateFips] || "Unknown State" : "";
  const selectedCountyName =
    (tractData?.county_name && tractData.county_name !== "Unknown County")
      ? tractData.county_name
      : countyData?.counties.find(c => c.county_fips === selectedCountyFips)?.county_name || "";

  const sortedCounties = useMemo(() => {
    if (!countyData) return [];
    return [...countyData.counties].sort((a, b) => (a.crrall ?? 100) - (b.crrall ?? 100));
  }, [countyData]);

  const sortedTracts = useMemo(() => {
    if (!tractData) return [];
    return [...tractData.tracts].sort((a, b) => (a.crrall ?? 100) - (b.crrall ?? 100));
  }, [tractData]);

  const mapHeight = compact ? 360 : 520;
  const stateZoom = selectedStateFips ? STATE_CENTERS[selectedStateFips] : null;

  if (loading && level === "national") {
    return (
      <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
        <div className="h-6 w-48 bg-slate-700 rounded animate-pulse mb-4" />
        <div className="bg-slate-700/50 rounded animate-pulse" style={{ height: mapHeight }} />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 rounded-xl border border-white/5 p-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm mb-4">
        <button onClick={handleBackToNational} className={`font-medium transition ${level === "national" ? "text-white" : "text-census-blue hover:underline"}`}>
          National
        </button>
        {level !== "national" && (
          <>
            <span className="text-census-gray-500">›</span>
            <button onClick={handleBackToState} className={`font-medium transition ${level === "state" ? "text-white" : "text-census-blue hover:underline"}`}>
              {selectedStateName}
            </button>
          </>
        )}
        {level === "county" && (
          <>
            <span className="text-census-gray-500">›</span>
            <span className="font-medium text-white">{selectedCountyName}</span>
          </>
        )}
      </nav>

      {/* Layer selector — shown in state view to color county choropleth */}
      {level === "state" && (
        <LayerSelector active={activeLayer} onChange={setActiveLayer} layers={availableLayers} />
      )}

      <div className={`grid gap-4 ${showSidebar ? "grid-cols-[1fr_220px]" : "grid-cols-1"}`}>
        {/* Map */}
        <div>
          {/* National map — always state choropleth, click to drill in */}
          {level === "national" && (
            <div className="relative">
              <ComposableMap
                projection="geoAlbersUsa"
                style={{ width: "100%", height: mapHeight }}
              >
                <Geographies geography={STATES_GEO_URL}>
                  {({ geographies }) =>
                    geographies.map((geo) => {
                      const stateFips = String(geo.id).padStart(2, "0");
                      const entry = stateMap.get(stateFips);
                      const fill = entry ? crrallToColor(entry.kpi.value) : "#374151";
                      return (
                        <Geography
                          key={geo.rsmKey}
                          geography={geo}
                          fill={fill}
                          stroke="#1e293b"
                          strokeWidth={0.5}
                          style={{
                            default: { outline: "none" },
                            hover: { outline: "none", fill: "#60a5fa", cursor: "pointer" },
                            pressed: { outline: "none" },
                          }}
                          onMouseEnter={(evt) => {
                            const agg = stateAggMap.get(stateFips);
                            if (agg) {
                              setTooltip({ x: evt.clientX, y: evt.clientY, state: agg, kind: "state" });
                            }
                          }}
                          onMouseMove={(evt) => {
                            setTooltip((t) => t ? { ...t, x: evt.clientX, y: evt.clientY } : null);
                          }}
                          onMouseLeave={() => setTooltip(null)}
                          onClick={() => handleStateClick(stateFips)}
                        />
                      );
                    })
                  }
                </Geographies>
              </ComposableMap>
              {tooltip && tooltip.kind === "state" && (
                <div className="fixed z-50 pointer-events-none" style={{ left: tooltip.x + 14, top: tooltip.y - 30 }}>
                  <StateTooltip state={tooltip.state} isT26={isT26} />
                </div>
              )}
            </div>
          )}

          {/* State map */}
          {level === "state" && (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-slate-800/50 rounded flex items-center justify-center z-10">
                  <span className="text-sm text-census-gray-400">Loading counties…</span>
                </div>
              )}
              <ComposableMap
                projection="geoAlbersUsa"
                style={{ width: "100%", height: mapHeight }}
              >
                <ZoomableGroup
                  center={stateZoom?.center ?? [-96, 38]}
                  zoom={(stateZoom?.zoom ?? 1) * 1.5}
                >
                  <Geographies geography={COUNTIES_GEO_URL}>
                    {({ geographies }) => {
                      const stateCounties = geographies.filter((geo) => {
                        const fips = padFips(String(geo.id));
                        return selectedStateFips && fips.startsWith(selectedStateFips);
                      });
                      return stateCounties.map((geo) => {
                        const fips = padFips(String(geo.id));
                        const isSelected = fips === selectedCountyFips;
                        const county = countyDataMap.get(fips);
                        const layerRow = countyLayer.get(fips);
                        const layerVal = layerRow ? (layerRow[activeLayer] as number | null) : null;
                        const countyFill = isSelected
                          ? "#3b82f6"
                          : layerRow
                          ? getLayerColor(activeDef, layerVal)
                          : crrallToColor(county?.crrall ?? null);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={countyFill}
                            stroke={isSelected ? "#60a5fa" : "#1e293b"}
                            strokeWidth={isSelected ? 1.5 : 0.3}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", fill: isSelected ? "#3b82f6" : "#4a5568", cursor: "pointer" },
                              pressed: { outline: "none" },
                            }}
                            onClick={() => {
                              if (!isSelected) handleCountyClick(fips);
                            }}
                            onMouseEnter={(evt) => {
                              if (!isSelected) {
                                const layerRow = countyLayer.get(fips);
                                if (layerRow) {
                                  setTooltip({ x: evt.clientX, y: evt.clientY, county: layerRow, kind: "county" });
                                }
                              }
                            }}
                            onMouseMove={(evt) => {
                              setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null);
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        );
                      });
                    }}
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              {tooltip && tooltip.kind === "county" && (
                <div className="fixed z-50 pointer-events-none" style={{ left: tooltip.x + 14, top: tooltip.y - 30 }}>
                  <CountyTooltip county={tooltip.county} />
                </div>
              )}
            </div>
          )}

          {/* County / tract view */}
          {level === "county" && (
            <div className="relative">
              {loading && (
                <div className="absolute inset-0 bg-slate-800/50 rounded flex items-center justify-center z-10">
                  <span className="text-sm text-census-gray-400">Loading tracts…</span>
                </div>
              )}
              <ComposableMap
                projection="geoAlbersUsa"
                style={{ width: "100%", height: mapHeight }}
              >
                <ZoomableGroup
                  center={stateZoom?.center ?? [-96, 38]}
                  zoom={(stateZoom?.zoom ?? 1) * 1.5}
                >
                  <Geographies geography={COUNTIES_GEO_URL}>
                    {({ geographies }) => {
                      const stateCounties = geographies.filter((geo) => {
                        const fips = padFips(String(geo.id));
                        return selectedStateFips && fips.startsWith(selectedStateFips);
                      });
                      return stateCounties.map((geo) => {
                        const fips = padFips(String(geo.id));
                        const isSelected = fips === selectedCountyFips;
                        const county = countyDataMap.get(fips);
                        return (
                          <Geography
                            key={geo.rsmKey}
                            geography={geo}
                            fill={isSelected ? "#3b82f6" : "#2d3748"}
                            stroke={isSelected ? "#60a5fa" : "#1e293b"}
                            strokeWidth={isSelected ? 1.5 : 0.3}
                            style={{
                              default: { outline: "none" },
                              hover: { outline: "none", fill: isSelected ? "#3b82f6" : "#4a5568", cursor: "pointer" },
                              pressed: { outline: "none" },
                            }}
                            onClick={() => {
                              if (!isSelected) handleCountyClick(fips);
                            }}
                            onMouseEnter={(evt) => {
                              if (!isSelected && county) {
                                const layerRow = countyLayer.get(fips);
                                if (layerRow) {
                                  setTooltip({ x: evt.clientX, y: evt.clientY, county: layerRow, kind: "county" });
                                }
                              }
                            }}
                            onMouseMove={(evt) => {
                              setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null);
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        );
                      });
                    }}
                  </Geographies>
                </ZoomableGroup>
              </ComposableMap>
              {tooltip && tooltip.kind === "county" && (
                <div className="fixed z-50 pointer-events-none" style={{ left: tooltip.x + 14, top: tooltip.y - 30 }}>
                  <CountyTooltip county={tooltip.county} />
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
                {sortedTracts.map((tract, idx) => (
                  <div
                    key={tract.tract_fips}
                    className="p-3 rounded-lg bg-slate-700/50 border border-white/5 hover:bg-slate-700 transition cursor-pointer"
                    onClick={() => handleInvestigate(selectedCountyFips!)}
                  >
                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-census-gray-500 text-[10px]">{idx + 1}.</span>
                      <span className="text-xs font-medium text-white truncate">{tract.tract_name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold" style={{ color: crrallToColor(tract.crrall) }}>
                        {tract.crrall?.toFixed(1) ?? '—'}%
                      </span>
                      {tract.delta !== null && (
                        <span className={`text-[10px] ${tract.delta < 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {tract.delta > 0 ? '+' : ''}{tract.delta.toFixed(1)}
                        </span>
                      )}
                    </div>
                    <p className="text-[9px] text-census-gray-500 mt-1 truncate">FIPS: {tract.tract_fips}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        {showSidebar && (
          <div className="space-y-4">
            {level === "national" && (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-xs font-medium text-census-gray-400 uppercase mb-3">Response Rate (CRRALL)</h4>
                <div className="space-y-2">
                  {[
                    { color: "#2e7d32", label: "≥67% — On target" },
                    { color: "#f9a825", label: "60-67% — Below avg" },
                    { color: "#e65100", label: "50-60% — Low" },
                    { color: "#b71c1c", label: "<50% — Critical" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                      <span className="text-census-gray-400">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {level === "state" && <LayerLegend layer={activeDef} />}
            {level === "county" && (
              <div className="bg-slate-900/50 rounded-lg p-4">
                <h4 className="text-xs font-medium text-census-gray-400 uppercase mb-3">Tracts (CRRALL)</h4>
                <div className="space-y-2">
                  {[
                    { color: "#2e7d32", label: "≥67% — On target" },
                    { color: "#f9a825", label: "60-67% — Below avg" },
                    { color: "#e65100", label: "50-60% — Low" },
                    { color: "#b71c1c", label: "<50% — Critical" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
                      <span className="text-census-gray-400">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-slate-900/50 rounded-lg p-4">
              <h4 className="text-xs font-medium text-census-gray-400 uppercase mb-3">
                {level === "national" ? "States" : level === "state" ? `${selectedStateName} Counties` : `${selectedCountyName} Tracts`} (Ranked)
              </h4>
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {level === "national" && statesData?.states
                  .map((s) => ({ ...s, kpi: s.kpis.find((k) => k.kpi === "Self-Response Rate") }))
                  .filter((s) => s.kpi)
                  .sort((a, b) => a.kpi!.value - b.kpi!.value)
                  .map((s, idx) => (
                    <button key={s.geography_id} onClick={() => handleStateClick(s.geography_id)} className="w-full flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-white/5 transition text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-census-gray-500 w-4 text-right">{idx + 1}.</span>
                        <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: crrallToColor(s.kpi!.value) }} />
                        <span className="font-medium text-white">{s.abbr}</span>
                      </div>
                      <span className="font-medium tabular-nums" style={{ color: crrallToColor(s.kpi!.value) }}>{s.kpi!.value}%</span>
                    </button>
                  ))}

                {level === "state" && sortedCounties.map((county, idx) => (
                  <button key={county.county_fips} onClick={() => handleCountyClick(county.county_fips)} className="w-full flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-white/5 transition text-left">
                    <div className="flex items-center gap-2">
                      <span className="text-census-gray-500 w-4 text-right">{idx + 1}.</span>
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: crrallToColor(county.crrall) }} />
                      <span className="font-medium text-white truncate max-w-[100px]">{county.county_name}</span>
                      {county.is_high_risk && <span className="w-2 h-2 rounded-full bg-red-500" />}
                    </div>
                    <span className="font-medium tabular-nums" style={{ color: crrallToColor(county.crrall) }}>{county.crrall?.toFixed(1) ?? '—'}%</span>
                  </button>
                ))}

                {level === "county" && sortedTracts.map((tract, idx) => (
                  <div key={tract.tract_fips} className="w-full flex items-center justify-between py-1.5 px-2 rounded text-xs hover:bg-white/5 transition text-left cursor-pointer" onClick={() => handleInvestigate(selectedCountyFips!)}>
                    <div className="flex items-center gap-2">
                      <span className="text-census-gray-500 w-4 text-right">{idx + 1}.</span>
                      <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: crrallToColor(tract.crrall) }} />
                      <span className="font-medium text-white truncate max-w-[80px]">{tract.tract_name}</span>
                    </div>
                    <span className="font-medium tabular-nums" style={{ color: crrallToColor(tract.crrall) }}>{tract.crrall?.toFixed(1) ?? '—'}%</span>
                  </div>
                ))}
              </div>
            </div>

            {level === "county" && selectedCountyFips && (
              <button
                onClick={() => handleInvestigate(selectedCountyFips)}
                className="w-full py-3 px-4 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition flex items-center justify-center gap-2 font-medium"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Investigate {selectedCountyName} →
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-4 text-xs text-census-gray-500">
          <span>
            {level === "national"
              ? "Click a state to drill in"
              : level === "state"
              ? "Click a county to view tracts · Use layer pills to change the color factor"
              : "Click a tract to investigate"}
          </span>
        </div>
        <span className="px-2 py-0.5 bg-primary-500/20 text-primary-400 text-xs rounded">Unity Catalog</span>
      </div>
    </div>
  );
}
