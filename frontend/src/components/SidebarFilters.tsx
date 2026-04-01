import { useFilterStore } from "../store/filters";

interface SidebarFiltersProps {
  open: boolean;
  onClose: () => void;
}

export default function SidebarFilters({ open, onClose }: SidebarFiltersProps) {
  const {
    timeWindow, geography, kpiGroup, benchmarkSet, demographicDimension, collectionMode,
    setTimeWindow, setGeography, setKpiGroup, setBenchmarkSet, setDemographicDimension, setCollectionMode,
  } = useFilterStore();

  return (
    <>
      {/* Backdrop */}
      {open && <div className="fixed inset-0 bg-black/20 z-30 lg:hidden" onClick={onClose} />}

      <aside
        className={`fixed top-0 right-0 h-full w-80 bg-white border-l border-census-gray-200 shadow-xl z-40 transform transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        } overflow-y-auto`}
      >
        <div className="p-4 border-b border-census-gray-200 flex items-center justify-between">
          <h3 className="font-semibold text-census-gray-800">Filters</h3>
          <button onClick={onClose} className="text-census-gray-500 hover:text-census-gray-700 text-xl leading-none">&times;</button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-census-gray-700 mb-1">Time window</label>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value)}
              className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-census-gray-700 mb-1">KPI group</label>
            <select
              value={kpiGroup}
              onChange={(e) => setKpiGroup(e.target.value)}
              className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none"
            >
              <option value="quality">Quality</option>
              <option value="response_rate">Response Rate</option>
              <option value="operations">Operations</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-census-gray-700 mb-1">Benchmark set</label>
            <select
              value={benchmarkSet}
              onChange={(e) => setBenchmarkSet(e.target.value)}
              className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none"
            >
              <option value="2020_census">2020 Census</option>
              <option value="rolling_avg">Rolling Average</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-census-gray-700 mb-1">Geography</label>
            <select
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
              className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none"
            >
              <option value="">All States</option>
              <option value="06">California</option>
              <option value="12">Florida</option>
              <option value="36">New York</option>
              <option value="48">Texas</option>
              <option value="17">Illinois</option>
              <option value="42">Pennsylvania</option>
              <option value="13">Georgia</option>
              <option value="39">Ohio</option>
              <option value="37">North Carolina</option>
              <option value="26">Michigan</option>
              <option value="04">Arizona</option>
              <option value="53">Washington</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-census-gray-700 mb-1">Demographic dimension</label>
            <select
              value={demographicDimension}
              onChange={(e) => setDemographicDimension(e.target.value)}
              className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none"
            >
              <option value="">None</option>
              <option value="age_group">Age Group</option>
              <option value="sex">Sex</option>
              <option value="race">Race</option>
              <option value="tenure">Tenure</option>
              <option value="relationship">Relationship</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-census-gray-700 mb-1">Collection mode</label>
            <select
              value={collectionMode}
              onChange={(e) => setCollectionMode(e.target.value)}
              className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-census-blue focus:outline-none"
            >
              <option value="">All Modes</option>
              <option value="internet">Internet</option>
              <option value="phone">Phone (CATI)</option>
              <option value="mail">Mail</option>
              <option value="in_person">In-Person (NRFU)</option>
              <option value="proxy">Proxy</option>
            </select>
          </div>

          <div className="pt-2 border-t border-census-gray-200">
            <button
              onClick={() => {
                setTimeWindow("weekly");
                setGeography("");
                setKpiGroup("quality");
                setBenchmarkSet("2020_census");
                setDemographicDimension("");
                setCollectionMode("");
              }}
              className="text-sm text-census-blue hover:underline"
            >
              Reset all filters
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
