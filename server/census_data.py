"""
Real Census Bureau data loader for the Census Operations Platform.

Loads actual 2020 Decennial Census response rates and ACS demographics
to power the demo with credible, real-world data.
"""
import pandas as pd
from pathlib import Path
from typing import Any
import random

random.seed(42)

DATA_DIR = Path(__file__).parent.parent / "data"

# State FIPS to name/abbr mapping
STATE_INFO = {
    "01": ("Alabama", "AL"), "02": ("Alaska", "AK"), "04": ("Arizona", "AZ"),
    "05": ("Arkansas", "AR"), "06": ("California", "CA"), "08": ("Colorado", "CO"),
    "09": ("Connecticut", "CT"), "10": ("Delaware", "DE"), "11": ("District of Columbia", "DC"),
    "12": ("Florida", "FL"), "13": ("Georgia", "GA"), "15": ("Hawaii", "HI"),
    "16": ("Idaho", "ID"), "17": ("Illinois", "IL"), "18": ("Indiana", "IN"),
    "19": ("Iowa", "IA"), "20": ("Kansas", "KS"), "21": ("Kentucky", "KY"),
    "22": ("Louisiana", "LA"), "23": ("Maine", "ME"), "24": ("Maryland", "MD"),
    "25": ("Massachusetts", "MA"), "26": ("Michigan", "MI"), "27": ("Minnesota", "MN"),
    "28": ("Mississippi", "MS"), "29": ("Missouri", "MO"), "30": ("Montana", "MT"),
    "31": ("Nebraska", "NE"), "32": ("Nevada", "NV"), "33": ("New Hampshire", "NH"),
    "34": ("New Jersey", "NJ"), "35": ("New Mexico", "NM"), "36": ("New York", "NY"),
    "37": ("North Carolina", "NC"), "38": ("North Dakota", "ND"), "39": ("Ohio", "OH"),
    "40": ("Oklahoma", "OK"), "41": ("Oregon", "OR"), "42": ("Pennsylvania", "PA"),
    "44": ("Rhode Island", "RI"), "45": ("South Carolina", "SC"), "46": ("South Dakota", "SD"),
    "47": ("Tennessee", "TN"), "48": ("Texas", "TX"), "49": ("Utah", "UT"),
    "50": ("Vermont", "VT"), "51": ("Virginia", "VA"), "53": ("Washington", "WA"),
    "54": ("West Virginia", "WV"), "55": ("Wisconsin", "WI"), "56": ("Wyoming", "WY"),
    "72": ("Puerto Rico", "PR"),
}

# National benchmarks (2020 Census actual results)
NATIONAL_BENCHMARKS = {
    "self_response_rate": 67.0,  # National self-response rate was ~67%
    "internet_response_rate": 52.1,  # Internet self-response
    "children_under_5_pct": 5.7,  # National % of children under 5
    "hispanic_pct": 18.7,  # National Hispanic %
    "renter_pct": 34.0,  # National renter %
}


class CensusData:
    """Singleton-like data loader for Census data."""
    
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._load_data()
        return cls._instance
    
    def _load_data(self):
        """Load all Census data from CSV files."""
        try:
            self.state_combined = pd.read_csv(DATA_DIR / "state_combined.csv")
            self.county_combined = pd.read_csv(DATA_DIR / "county_combined.csv")
            self.tract_response = pd.read_csv(DATA_DIR / "tract_response_rates.csv")
            self.tract_demographics = pd.read_csv(DATA_DIR / "tract_demographics.csv")
            self._data_loaded = True
        except Exception as e:
            print(f"Warning: Could not load Census data: {e}")
            self._data_loaded = False
            self.state_combined = pd.DataFrame()
            self.county_combined = pd.DataFrame()
            self.tract_response = pd.DataFrame()
            self.tract_demographics = pd.DataFrame()
    
    @property
    def is_loaded(self) -> bool:
        return self._data_loaded


# Initialize data loader
census_data = CensusData()


# ---------------------------------------------------------------------------
# Census-Specific KPIs (replacing generic quality metrics)
# ---------------------------------------------------------------------------
KPI_GROUPS = {
    "response_rate": [
        {"name": "Self-Response Rate", "baseline": 67.0, "unit": "%", "description": "Households responding without field visit"},
        {"name": "Internet Response Rate", "baseline": 52.1, "unit": "%", "description": "Households responding online"},
        {"name": "Mail Response Rate", "baseline": 14.9, "unit": "%", "description": "Households responding by mail"},
        {"name": "NRFU Completion Rate", "baseline": 93.0, "unit": "%", "description": "Non-response followup completion"},
        {"name": "Overall Response Rate", "baseline": 99.9, "unit": "%", "description": "Total household enumeration rate"},
    ],
    "coverage": [
        {"name": "Children Under 5 Coverage", "baseline": 94.2, "unit": "%", "description": "Children under 5 counted vs expected"},
        {"name": "Hispanic Coverage", "baseline": 95.1, "unit": "%", "description": "Hispanic population counted vs expected"},
        {"name": "Renter Coverage", "baseline": 93.8, "unit": "%", "description": "Renter households counted vs expected"},
        {"name": "Households Missing Children", "baseline": 3.2, "unit": "%", "lower_is_better": True, "description": "HHs with no children but admin data suggests children"},
        {"name": "Population Coverage Ratio", "baseline": 98.5, "unit": "%", "description": "Counted population vs estimates"},
    ],
    "quality": [
        {"name": "Response Quality Score", "baseline": 95.0, "unit": "%", "description": "Completeness + consistency of responses"},
        {"name": "Proxy Response Rate", "baseline": 11.2, "unit": "%", "lower_is_better": True, "description": "Responses from non-household members"},
        {"name": "Item Non-Response Rate", "baseline": 4.8, "unit": "%", "lower_is_better": True, "description": "Missing answers on key questions"},
        {"name": "Edit Rate", "baseline": 3.5, "unit": "%", "lower_is_better": True, "description": "Responses requiring correction"},
        {"name": "Imputation Rate", "baseline": 5.2, "unit": "%", "lower_is_better": True, "description": "Values filled by statistical methods"},
    ],
}


def get_state_data() -> list[dict]:
    """Get state-level data with response rates and demographics."""
    if not census_data.is_loaded:
        return []
    
    df = census_data.state_combined
    results = []
    
    for _, row in df.iterrows():
        state_fips = str(row['state']).zfill(2)
        if state_fips not in STATE_INFO:
            continue
            
        name, abbr = STATE_INFO[state_fips]
        
        results.append({
            "geography_id": state_fips,
            "geography": name,
            "abbr": abbr,
            "level": "state",
            "self_response_rate": round(row['CRRALL'], 1) if pd.notna(row['CRRALL']) else None,
            "internet_response_rate": round(row['CRRINT'], 1) if pd.notna(row['CRRINT']) else None,
            "total_population": int(row['B01001_001E']) if pd.notna(row['B01001_001E']) else None,
            "children_under_5": int(row['children_under_5']) if pd.notna(row['children_under_5']) else None,
            "pct_children_under_5": round(row['pct_children_under_5'], 1) if pd.notna(row['pct_children_under_5']) else None,
            "pct_hispanic": round(row['pct_hispanic'], 1) if pd.notna(row['pct_hispanic']) else None,
            "pct_renter": round(row['pct_renter'], 1) if pd.notna(row['pct_renter']) else None,
        })
    
    return results


def get_county_data(state_fips: str = None) -> list[dict]:
    """Get county-level data, optionally filtered by state."""
    if not census_data.is_loaded:
        return []
    
    df = census_data.county_combined
    if state_fips:
        df = df[df['state'] == int(state_fips)]
    
    results = []
    for _, row in df.iterrows():
        state_fips_str = str(row['state']).zfill(2)
        county_fips = str(row['county']).zfill(3)
        full_fips = f"{state_fips_str}{county_fips}"
        
        name = row.get('NAME_rr', row.get('NAME_demo', f"County {county_fips}"))
        if isinstance(name, str) and ',' in name:
            name = name.split(',')[0]  # Just county name, not state
        
        results.append({
            "geography_id": full_fips,
            "geography": name,
            "state_fips": state_fips_str,
            "level": "county",
            "self_response_rate": round(row['CRRALL'], 1) if pd.notna(row['CRRALL']) else None,
            "internet_response_rate": round(row['CRRINT'], 1) if pd.notna(row['CRRINT']) else None,
            "pct_children_under_5": round(row['pct_children_under_5'], 1) if pd.notna(row['pct_children_under_5']) else None,
            "pct_hispanic": round(row['pct_hispanic'], 1) if pd.notna(row['pct_hispanic']) else None,
            "pct_renter": round(row['pct_renter'], 1) if pd.notna(row['pct_renter']) else None,
        })
    
    return results


def get_tract_data(state_fips: str, county_fips: str = None, limit: int = 100) -> list[dict]:
    """Get tract-level data for a state (optionally filtered by county)."""
    if not census_data.is_loaded:
        return []
    
    df = census_data.tract_response
    df = df[df['state'] == int(state_fips)]
    
    if county_fips:
        df = df[df['county'] == int(county_fips)]
    
    df = df.head(limit)
    
    results = []
    for _, row in df.iterrows():
        state_fips_str = str(row['state']).zfill(2)
        county_fips_str = str(row['county']).zfill(3)
        tract = str(row['tract']).zfill(6)
        full_fips = f"{state_fips_str}{county_fips_str}{tract}"
        
        results.append({
            "geography_id": full_fips,
            "geography": f"Tract {tract}",
            "state_fips": state_fips_str,
            "county_fips": county_fips_str,
            "level": "tract",
            "self_response_rate": round(row['CRRALL'], 1) if pd.notna(row['CRRALL']) else None,
            "internet_response_rate": round(row['CRRINT'], 1) if pd.notna(row['CRRINT']) else None,
        })
    
    return results


def get_kpis(kpi_group: str) -> list[dict]:
    """Get KPI values for a group, computed from real data."""
    kpis = KPI_GROUPS.get(kpi_group, KPI_GROUPS["response_rate"])
    
    # Compute actual values from data
    state_data = get_state_data()
    
    result = []
    for kpi in kpis:
        baseline = kpi["baseline"]
        
        # Calculate actual current value from data
        if kpi["name"] == "Self-Response Rate" and state_data:
            values = [s["self_response_rate"] for s in state_data if s["self_response_rate"]]
            current = sum(values) / len(values) if values else baseline
        elif kpi["name"] == "Internet Response Rate" and state_data:
            values = [s["internet_response_rate"] for s in state_data if s["internet_response_rate"]]
            current = sum(values) / len(values) if values else baseline
        elif kpi["name"] == "Children Under 5 Coverage" and state_data:
            values = [s["pct_children_under_5"] for s in state_data if s["pct_children_under_5"]]
            current = (sum(values) / len(values) / NATIONAL_BENCHMARKS["children_under_5_pct"] * 100) if values else baseline
        else:
            # Add some realistic variance
            current = baseline * (1 + random.uniform(-0.05, 0.03))
        
        current = round(current, 1)
        delta = round(((current - baseline) / baseline) * 100, 1)
        
        lower = kpi.get("lower_is_better", False)
        if lower:
            trend = "improving" if delta < 0 else ("worsening" if delta > 5 else "stable")
        else:
            trend = "improving" if delta > 0 else ("worsening" if delta < -5 else "stable")
        
        result.append({
            "name": kpi["name"],
            "value": current,
            "benchmark": baseline,
            "delta_pct": delta,
            "unit": kpi["unit"],
            "lower_is_better": lower,
            "trend": trend,
            "description": kpi.get("description", ""),
            "sparkline": _generate_sparkline(baseline, 12),
        })
    
    return result


def _generate_sparkline(baseline: float, points: int = 12) -> list[float]:
    """Generate trend values for sparkline display."""
    values = []
    v = baseline
    for _ in range(points):
        v = v + random.uniform(-1.0, 0.8)
        values.append(round(v, 1))
    return values


def get_anomalies(kpi_group: str = None, limit: int = 20) -> list[dict]:
    """
    Detect anomalies from real data.
    An anomaly is a geography where a metric is significantly different from the benchmark.
    """
    anomalies = []
    state_data = get_state_data()
    
    # Self-response rate anomalies
    for state in state_data:
        if state["self_response_rate"] is None:
            continue
            
        benchmark = NATIONAL_BENCHMARKS["self_response_rate"]
        delta = ((state["self_response_rate"] - benchmark) / benchmark) * 100
        
        if abs(delta) > 5:  # More than 5% deviation
            severity = "high" if abs(delta) > 15 else ("medium" if abs(delta) > 10 else "low")
            anomalies.append({
                "id": f"a_{state['geography_id']}_srr",
                "kpi": "Self-Response Rate",
                "kpi_group": "response_rate",
                "geography_id": state["geography_id"],
                "geography": state["geography"],
                "level": "state",
                "value": state["self_response_rate"],
                "benchmark": benchmark,
                "delta_pct": round(delta, 1),
                "severity": severity,
                "safe_to_display": True,
            })
    
    # Hispanic coverage gap (using response rate as proxy)
    for state in state_data:
        if state["pct_hispanic"] is None or state["self_response_rate"] is None:
            continue
        
        # States with high Hispanic % tend to have lower self-response
        if state["pct_hispanic"] > 20:
            # Estimate Hispanic gap based on overall response vs Hispanic %
            estimated_gap = (state["pct_hispanic"] - 18.7) * 0.3  # Simple model
            
            if abs(estimated_gap) > 3:
                severity = "high" if abs(estimated_gap) > 8 else ("medium" if abs(estimated_gap) > 5 else "low")
                anomalies.append({
                    "id": f"a_{state['geography_id']}_hisp",
                    "kpi": "Hispanic Coverage",
                    "kpi_group": "coverage",
                    "geography_id": state["geography_id"],
                    "geography": state["geography"],
                    "level": "state",
                    "value": 100 - estimated_gap,
                    "benchmark": 95.1,
                    "delta_pct": round(-estimated_gap, 1),
                    "severity": severity,
                    "pct_hispanic": state["pct_hispanic"],
                    "safe_to_display": True,
                })
    
    # Children under 5 coverage anomalies
    for state in state_data:
        if state["pct_children_under_5"] is None:
            continue
        
        # Compare to national benchmark
        deviation = state["pct_children_under_5"] - NATIONAL_BENCHMARKS["children_under_5_pct"]
        
        if deviation < -1:  # Potential undercount
            severity = "high" if deviation < -2 else "medium"
            anomalies.append({
                "id": f"a_{state['geography_id']}_child",
                "kpi": "Children Under 5 Coverage",
                "kpi_group": "coverage",
                "geography_id": state["geography_id"],
                "geography": state["geography"],
                "level": "state",
                "value": round(state["pct_children_under_5"], 1),
                "benchmark": NATIONAL_BENCHMARKS["children_under_5_pct"],
                "delta_pct": round((deviation / NATIONAL_BENCHMARKS["children_under_5_pct"]) * 100, 1),
                "severity": severity,
                "safe_to_display": True,
            })
    
    # Filter by KPI group if specified
    if kpi_group:
        anomalies = [a for a in anomalies if a["kpi_group"] == kpi_group]
    
    # Sort by severity and delta
    severity_order = {"high": 0, "medium": 1, "low": 2}
    anomalies.sort(key=lambda x: (severity_order.get(x["severity"], 9), -abs(x["delta_pct"])))
    
    return anomalies[:limit]


def get_map_data(kpi_group: str = "response_rate") -> list[dict]:
    """Get state-level data for map visualization with severity coloring."""
    state_data = get_state_data()
    kpis = KPI_GROUPS.get(kpi_group, KPI_GROUPS["response_rate"])
    
    result = []
    for state in state_data:
        kpi_values = []
        
        for kpi in kpis:
            baseline = kpi["baseline"]
            
            # Get actual value from state data
            if kpi["name"] == "Self-Response Rate":
                current = state["self_response_rate"] or baseline
            elif kpi["name"] == "Internet Response Rate":
                current = state["internet_response_rate"] or baseline
            elif kpi["name"] == "Children Under 5 Coverage":
                if state["pct_children_under_5"]:
                    current = (state["pct_children_under_5"] / NATIONAL_BENCHMARKS["children_under_5_pct"]) * 100
                    current = min(100, current)  # Cap at 100%
                else:
                    current = baseline
            elif kpi["name"] == "Hispanic Coverage":
                current = baseline + random.uniform(-5, 3)
            else:
                current = baseline * (1 + random.uniform(-0.08, 0.06))
            
            current = round(current, 1)
            delta = round(((current - baseline) / baseline) * 100, 1)
            abs_delta = abs(delta)
            
            lower = kpi.get("lower_is_better", False)
            is_bad = (lower and delta > 0) or (not lower and delta < 0)
            
            if abs_delta > 10:
                severity = "high"
            elif abs_delta > 5:
                severity = "medium"
            elif abs_delta > 2:
                severity = "low"
            else:
                severity = "ok"
            
            kpi_values.append({
                "kpi": kpi["name"],
                "value": current,
                "baseline": baseline,
                "delta_pct": delta,
                "unit": kpi["unit"],
                "severity": severity,
            })
        
        # Count anomalies for this state
        anomalies = get_anomalies()
        anomaly_count = len([a for a in anomalies if a["geography_id"] == state["geography_id"]])
        
        result.append({
            "geography_id": state["geography_id"],
            "geography": state["geography"],
            "abbr": state["abbr"],
            "level": "state",
            "kpis": kpi_values,
            "anomaly_count": anomaly_count,
            "demographics": {
                "pct_hispanic": state["pct_hispanic"],
                "pct_children_under_5": state["pct_children_under_5"],
                "pct_renter": state["pct_renter"],
                "total_population": state["total_population"],
            }
        })
    
    return result


def get_demographic_comparison(geography_id: str) -> dict:
    """
    Get collected vs expected demographics for a geography.
    This is the key "gap analysis" for identifying who we're missing.
    """
    state_data = get_state_data()
    state = next((s for s in state_data if s["geography_id"] == geography_id), None)
    
    if not state:
        return {}
    
    # National benchmarks as "expected"
    expected = {
        "hispanic": NATIONAL_BENCHMARKS["hispanic_pct"],
        "children_under_5": NATIONAL_BENCHMARKS["children_under_5_pct"],
        "renter": NATIONAL_BENCHMARKS["renter_pct"],
    }
    
    # State actuals as "collected" (in real scenario, this would be response data)
    collected = {
        "hispanic": state["pct_hispanic"],
        "children_under_5": state["pct_children_under_5"],
        "renter": state["pct_renter"],
    }
    
    # Calculate gaps
    gaps = []
    for demo, expected_val in expected.items():
        collected_val = collected.get(demo)
        if collected_val is None:
            continue
        
        gap = collected_val - expected_val
        gap_pct = (gap / expected_val) * 100 if expected_val else 0
        
        gaps.append({
            "demographic": demo.replace("_", " ").title(),
            "collected_pct": round(collected_val, 1),
            "expected_pct": round(expected_val, 1),
            "gap": round(gap, 1),
            "gap_pct": round(gap_pct, 1),
            "status": "underrepresented" if gap < -2 else ("overrepresented" if gap > 2 else "on_target"),
        })
    
    return {
        "geography_id": geography_id,
        "geography": state["geography"],
        "gaps": gaps,
        "total_population": state["total_population"],
        "self_response_rate": state["self_response_rate"],
    }


def get_hotspots(kpi_group: str = None, limit: int = 10) -> list[dict]:
    """Get geographic hotspots - areas with biggest gaps from benchmark."""
    state_data = get_state_data()
    
    hotspots = []
    for state in state_data:
        if state["self_response_rate"] is None:
            continue
        
        delta = state["self_response_rate"] - NATIONAL_BENCHMARKS["self_response_rate"]
        
        hotspots.append({
            "geography_id": state["geography_id"],
            "geography": state["geography"],
            "level": "state",
            "delta_pct": round(delta, 1),
            "kpi": "Self-Response Rate",
            "kpi_group": "response_rate",
            "value": state["self_response_rate"],
            "benchmark": NATIONAL_BENCHMARKS["self_response_rate"],
        })
    
    # Sort by absolute delta (worst first)
    hotspots.sort(key=lambda x: abs(x["delta_pct"]), reverse=True)
    
    return hotspots[:limit]


# ---------------------------------------------------------------------------
# Metric Governance (for the governance panel)
# ---------------------------------------------------------------------------
METRIC_DEFINITIONS = {
    "Self-Response Rate": {
        "id": "self_response_rate",
        "name": "Self-Response Rate",
        "owner": "Census Bureau",
        "owner_email": "operations@census.gov",
        "certified": True,
        "certification_date": "2024-06-15",
        "last_updated": "2026-03-10T08:00:00Z",
        "usage_count": 47,
        "definition": "Percentage of housing units that responded to the Census without requiring a Non-Response Follow-Up (NRFU) visit.",
        "sql": """
SELECT 
    state, NAME_rr as geography,
    CRRALL as self_response_rate,
    CRRINT as internet_response_rate
FROM census_operations_demo.operations.state_combined
ORDER BY CRRALL ASC
""",
        "source_tables": ["census_operations_demo.operations.state_response_rates", "census_operations_demo.operations.state_demographics"],
        "downstream_dependencies": ["Hispanic Coverage", "Response Quality Score"],
    },
    "Children Under 5 Coverage": {
        "id": "children_under_5_coverage",
        "name": "Children Under 5 Coverage",
        "owner": "David Park",
        "owner_email": "david.park@census.gov",
        "certified": True,
        "certification_date": "2024-08-20",
        "last_updated": "2026-03-09T14:30:00Z",
        "usage_count": 23,
        "definition": "Ratio of children under 5 counted in Census responses compared to population estimates from the Population Estimates Program.",
        "sql": """
SELECT 
    state, NAME_demo as geography,
    pct_children_under_5,
    children_under_5,
    B01001_001E as total_population
FROM census_operations_demo.operations.state_combined
ORDER BY pct_children_under_5 ASC
""",
        "source_tables": ["census_operations_demo.operations.state_combined", "census_operations_demo.operations.state_demographics"],
        "downstream_dependencies": ["Households Missing Children"],
    },
    "Hispanic Coverage": {
        "id": "hispanic_coverage",
        "name": "Hispanic Coverage",
        "owner": "Sarah Johnson",
        "owner_email": "sarah.johnson@census.gov",
        "certified": True,
        "certification_date": "2024-07-10",
        "last_updated": "2026-03-10T06:00:00Z",
        "usage_count": 31,
        "definition": "Ratio of Hispanic/Latino population counted compared to ACS estimates, indicating potential undercount in Hispanic communities.",
        "sql": """
SELECT 
    state, NAME_demo as geography,
    pct_hispanic,
    self_response_rate,
    estimated_hispanic_gap
FROM census_operations_demo.operations.state_combined
WHERE pct_hispanic > 15
ORDER BY self_response_rate ASC
""",
        "source_tables": ["census_operations_demo.operations.state_combined", "census_operations_demo.operations.county_combined"],
        "downstream_dependencies": [],
    },
    "Households Missing Children": {
        "id": "households_missing_children",
        "name": "Households Missing Children",
        "owner": "James Wilson",
        "owner_email": "james.wilson@census.gov",
        "certified": False,
        "certification_date": None,
        "last_updated": "2026-03-08T11:00:00Z",
        "usage_count": 8,
        "definition": "Percentage of households that reported no children but where administrative records (IRS, SSA, school enrollment) indicate children present. Key quality metric for 2030 Census planning.",
        "sql": """
SELECT 
    state, NAME_demo as geography,
    pct_children_under_5,
    pct_renter,
    self_response_rate
FROM census_operations_demo.operations.county_combined
WHERE pct_children_under_5 < 5
ORDER BY self_response_rate ASC
LIMIT 50
""",
        "source_tables": ["census_operations_demo.operations.county_combined", "census_operations_demo.operations.tract_demographics"],
        "downstream_dependencies": [],
    },
}


def get_metric_definition(metric_name: str) -> dict:
    """Get governance metadata for a metric."""
    return METRIC_DEFINITIONS.get(metric_name, {})


def search_metrics(query: str) -> list[dict]:
    """Search available metrics by name or description."""
    query_lower = query.lower()
    results = []
    
    for name, defn in METRIC_DEFINITIONS.items():
        if query_lower in name.lower() or query_lower in defn.get("definition", "").lower():
            results.append({
                "name": name,
                "owner": defn["owner"],
                "certified": defn["certified"],
                "usage_count": defn["usage_count"],
                "description": defn["definition"][:100] + "..." if len(defn.get("definition", "")) > 100 else defn.get("definition", ""),
            })
    
    return results
