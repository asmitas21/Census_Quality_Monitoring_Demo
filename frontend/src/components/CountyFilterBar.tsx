import { useEffect, useState } from "react";
import { get } from "../api/client";

type FilterOptions = {
  states: string[];
  factors: string[];
  response_ranges: Array<{ label: string; min: number; max: number }>;
  trending_options: string[];
};

type Filters = {
  state: string | null;
  risk_factor: string | null;
  crrall_min: number | null;
  crrall_max: number | null;
  trending_only: boolean;
};

type Props = {
  onFilterChange: (filters: Filters) => void;
  filters: Filters;
};

export function CountyFilterBar({ onFilterChange, filters }: Props) {
  const [options, setOptions] = useState<FilterOptions | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    get<FilterOptions>("/snapshot/filter-options")
      .then(setOptions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleStateChange = (value: string) => {
    onFilterChange({
      ...filters,
      state: value === "" ? null : value,
    });
  };

  const handleFactorChange = (value: string) => {
    onFilterChange({
      ...filters,
      risk_factor: value === "" ? null : value,
    });
  };

  const handleRangeChange = (value: string) => {
    if (value === "") {
      onFilterChange({ ...filters, crrall_min: null, crrall_max: null });
    } else {
      const range = options?.response_ranges.find((r) => r.label === value);
      if (range) {
        onFilterChange({
          ...filters,
          crrall_min: range.min,
          crrall_max: range.max,
        });
      }
    }
  };

  const handleTrendingChange = (value: string) => {
    onFilterChange({
      ...filters,
      trending_only: value === "Trending worse",
    });
  };

  const clearFilters = () => {
    onFilterChange({
      state: null,
      risk_factor: null,
      crrall_min: null,
      crrall_max: null,
      trending_only: false,
    });
  };

  const hasActiveFilters =
    filters.state || filters.risk_factor || filters.crrall_min !== null || filters.trending_only;

  const getCurrentRangeLabel = () => {
    if (filters.crrall_min === null && filters.crrall_max === null) return "";
    const range = options?.response_ranges.find(
      (r) => r.min === filters.crrall_min && r.max === filters.crrall_max
    );
    return range?.label || "";
  };

  if (loading) {
    return (
      <div className="flex items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-white/5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-9 w-36 bg-slate-700/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-slate-800/30 rounded-lg border border-white/5">
      <span className="text-xs font-medium text-census-gray-400 uppercase tracking-wide">
        Filter:
      </span>

      {/* State Filter */}
      <select
        value={filters.state || ""}
        onChange={(e) => handleStateChange(e.target.value)}
        className="h-9 px-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
      >
        <option value="">All States</option>
        {options?.states.map((state) => (
          <option key={state} value={state}>
            {state}
          </option>
        ))}
      </select>

      {/* Risk Factor Filter */}
      <select
        value={filters.risk_factor || ""}
        onChange={(e) => handleFactorChange(e.target.value)}
        className="h-9 px-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
      >
        <option value="">All Risk Factors</option>
        {options?.factors.map((factor) => (
          <option key={factor} value={factor}>
            {factor}
          </option>
        ))}
      </select>

      {/* Response Rate Range Filter */}
      <select
        value={getCurrentRangeLabel()}
        onChange={(e) => handleRangeChange(e.target.value)}
        className="h-9 px-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
      >
        <option value="">All Response Rates</option>
        {options?.response_ranges.map((range) => (
          <option key={range.label} value={range.label}>
            {range.label}
          </option>
        ))}
      </select>

      {/* Trending Filter */}
      <select
        value={filters.trending_only ? "Trending worse" : "All"}
        onChange={(e) => handleTrendingChange(e.target.value)}
        className="h-9 px-3 bg-slate-800 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-primary-500"
      >
        <option value="All">All Counties</option>
        <option value="Trending worse">Trending Worse</option>
        <option value="Stable">Stable</option>
      </select>

      {/* Clear Filters */}
      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="h-9 px-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-sm text-red-400 flex items-center gap-1.5 transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}

      {/* Active filter count */}
      {hasActiveFilters && (
        <span className="text-xs text-primary-400 ml-auto">
          {[filters.state, filters.risk_factor, filters.crrall_min !== null, filters.trending_only].filter(Boolean).length} filter(s) active
        </span>
      )}
    </div>
  );
}
