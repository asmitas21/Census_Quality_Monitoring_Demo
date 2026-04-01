"""Comprehensive mock data for Quality Monitoring System demo.

Generates realistic Census-like data across geography hierarchy,
time periods, KPI groups, demographics, collection modes, and quality bands.
"""
import random
import math
from datetime import datetime, timedelta
from typing import Any

random.seed(42)

# ---------------------------------------------------------------------------
# Geography hierarchy: State → County → Tract → Block Group
# ---------------------------------------------------------------------------
STATES = [
    {"id": "06", "name": "California", "abbr": "CA"},
    {"id": "12", "name": "Florida", "abbr": "FL"},
    {"id": "36", "name": "New York", "abbr": "NY"},
    {"id": "48", "name": "Texas", "abbr": "TX"},
    {"id": "17", "name": "Illinois", "abbr": "IL"},
    {"id": "42", "name": "Pennsylvania", "abbr": "PA"},
    {"id": "13", "name": "Georgia", "abbr": "GA"},
    {"id": "39", "name": "Ohio", "abbr": "OH"},
    {"id": "37", "name": "North Carolina", "abbr": "NC"},
    {"id": "26", "name": "Michigan", "abbr": "MI"},
    {"id": "04", "name": "Arizona", "abbr": "AZ"},
    {"id": "53", "name": "Washington", "abbr": "WA"},
]

COUNTIES: dict[str, list[dict]] = {
    "06": [
        {"id": "06037", "name": "Los Angeles County"},
        {"id": "06073", "name": "San Diego County"},
        {"id": "06075", "name": "San Francisco County"},
        {"id": "06085", "name": "Santa Clara County"},
    ],
    "12": [
        {"id": "12086", "name": "Miami-Dade County"},
        {"id": "12011", "name": "Broward County"},
        {"id": "12095", "name": "Orange County"},
        {"id": "12031", "name": "Duval County"},
    ],
    "36": [
        {"id": "36061", "name": "New York County"},
        {"id": "36047", "name": "Kings County"},
        {"id": "36081", "name": "Queens County"},
        {"id": "36005", "name": "Bronx County"},
    ],
    "48": [
        {"id": "48201", "name": "Harris County"},
        {"id": "48113", "name": "Dallas County"},
        {"id": "48029", "name": "Bexar County"},
        {"id": "48453", "name": "Travis County"},
    ],
    "17": [
        {"id": "17031", "name": "Cook County"},
        {"id": "17043", "name": "DuPage County"},
        {"id": "17089", "name": "Kane County"},
    ],
    "42": [
        {"id": "42101", "name": "Philadelphia County"},
        {"id": "42003", "name": "Allegheny County"},
        {"id": "42045", "name": "Delaware County"},
    ],
    "13": [
        {"id": "13121", "name": "Fulton County"},
        {"id": "13089", "name": "DeKalb County"},
        {"id": "13067", "name": "Cobb County"},
    ],
    "39": [
        {"id": "39035", "name": "Cuyahoga County"},
        {"id": "39049", "name": "Franklin County"},
        {"id": "39061", "name": "Hamilton County"},
    ],
    "37": [
        {"id": "37119", "name": "Mecklenburg County"},
        {"id": "37183", "name": "Wake County"},
        {"id": "37081", "name": "Guilford County"},
    ],
    "26": [
        {"id": "26163", "name": "Wayne County"},
        {"id": "26125", "name": "Oakland County"},
        {"id": "26099", "name": "Macomb County"},
    ],
    "04": [
        {"id": "04013", "name": "Maricopa County"},
        {"id": "04019", "name": "Pima County"},
    ],
    "53": [
        {"id": "53033", "name": "King County"},
        {"id": "53053", "name": "Pierce County"},
    ],
}

def _generate_tracts(county_id: str, count: int = 3) -> list[dict]:
    return [{"id": f"{county_id}{i:04d}", "name": f"Tract {county_id}.{i:02d}"} for i in range(1, count + 1)]

def _generate_block_groups(tract_id: str, count: int = 2) -> list[dict]:
    return [{"id": f"{tract_id}{i}", "name": f"Block Group {i}"} for i in range(1, count + 1)]


def get_geography_children(parent_id: str | None, level: str) -> list[dict]:
    """Return children at the requested level for the given parent."""
    if level == "state" or not parent_id:
        return [{"id": s["id"], "name": s["name"], "level": "state"} for s in STATES]
    if level == "county":
        counties = COUNTIES.get(parent_id, [])
        return [{"id": c["id"], "name": c["name"], "level": "county"} for c in counties]
    if level == "tract":
        return [{"id": t["id"], "name": t["name"], "level": "tract"} for t in _generate_tracts(parent_id)]
    if level == "block_group":
        return [{"id": b["id"], "name": b["name"], "level": "block_group"} for b in _generate_block_groups(parent_id)]
    return []


# ---------------------------------------------------------------------------
# Time periods
# ---------------------------------------------------------------------------
def _generate_weeks(n: int = 16) -> list[str]:
    base = datetime(2026, 2, 23)  # current-ish date
    return [(base - timedelta(weeks=n - i - 1)).strftime("%Y-W%02d" % (base - timedelta(weeks=n - i - 1)).isocalendar()[1]) for i in range(n)]

def generate_weeks(n: int = 16) -> list[str]:
    base = datetime(2026, 2, 23)
    weeks = []
    for i in range(n):
        dt = base - timedelta(weeks=n - i - 1)
        iso = dt.isocalendar()
        weeks.append(f"{iso[0]}-W{iso[1]:02d}")
    return weeks

WEEKS = generate_weeks(16)
MONTHS = ["2025-10", "2025-11", "2025-12", "2026-01", "2026-02"]

# ---------------------------------------------------------------------------
# KPI definitions across all 3 groups
# ---------------------------------------------------------------------------
KPI_GROUPS: dict[str, list[dict]] = {
    "quality": [
        {"name": "Completeness", "baseline": 97.5, "unit": "%"},
        {"name": "Valid Records", "baseline": 99.0, "unit": "%"},
        {"name": "Duplicate Rate", "baseline": 1.2, "unit": "%", "lower_is_better": True},
        {"name": "Edit Rate", "baseline": 3.5, "unit": "%", "lower_is_better": True},
        {"name": "Item Non-Response", "baseline": 4.8, "unit": "%", "lower_is_better": True},
    ],
    "response_rate": [
        {"name": "Self-Response Rate", "baseline": 67.0, "unit": "%"},
        {"name": "NRFU Response Rate", "baseline": 93.0, "unit": "%"},
        {"name": "Internet Response", "baseline": 52.1, "unit": "%"},
        {"name": "Mail Response", "baseline": 22.4, "unit": "%"},
        {"name": "Overall Response Rate", "baseline": 94.2, "unit": "%"},
    ],
    "operations": [
        {"name": "Workload Completion", "baseline": 88.5, "unit": "%"},
        {"name": "Enumerator Productivity", "baseline": 4.2, "unit": "cases/hr"},
        {"name": "Cost Per Case", "baseline": 48.60, "unit": "$", "lower_is_better": True},
        {"name": "Contact Attempt Rate", "baseline": 95.1, "unit": "%"},
        {"name": "Proxy Rate", "baseline": 11.2, "unit": "%", "lower_is_better": True},
    ],
}


def _jitter(value: float, pct: float = 3.0) -> float:
    return round(value * (1 + random.uniform(-pct / 100, pct / 100)), 2)


def get_kpis(kpi_group: str, time_window: str = "weekly") -> list[dict]:
    """Return current KPI values with benchmarks for a group."""
    kpis = KPI_GROUPS.get(kpi_group, KPI_GROUPS["quality"])
    result = []
    for kpi in kpis:
        current = _jitter(kpi["baseline"], 5)
        benchmark = kpi["baseline"]
        delta = round(((current - benchmark) / benchmark) * 100, 1)
        lower = kpi.get("lower_is_better", False)
        # Determine trend direction
        if lower:
            trend = "improving" if current < benchmark else ("worsening" if current > benchmark * 1.1 else "stable")
        else:
            trend = "improving" if current > benchmark else ("worsening" if current < benchmark * 0.9 else "stable")
        result.append({
            "name": kpi["name"],
            "value": current,
            "benchmark": benchmark,
            "delta_pct": delta,
            "unit": kpi["unit"],
            "lower_is_better": kpi.get("lower_is_better", False),
            "trend": trend,
            "sparkline": _generate_sparkline(kpi["baseline"], 12),
        })
    return result


def _generate_sparkline(baseline: float, points: int = 12) -> list[float]:
    """Generate mini trend values for sparkline display."""
    values = []
    v = baseline
    for _ in range(points):
        v = v + random.uniform(-1.5, 1.2)
        values.append(round(v, 1))
    return values


# ---------------------------------------------------------------------------
# Anomalies
# ---------------------------------------------------------------------------
_ANOMALY_POOL = [
    {"kpi": "Self-Response Rate", "kpi_group": "response_rate", "geography_id": "12086", "geography": "Miami-Dade County, FL", "delta_pct": -24.3, "severity": "high", "persistence_weeks": 3},
    {"kpi": "Completeness", "kpi_group": "quality", "geography_id": "06037", "geography": "Los Angeles County, CA", "delta_pct": -18.7, "severity": "high", "persistence_weeks": 2},
    {"kpi": "NRFU Response Rate", "kpi_group": "response_rate", "geography_id": "480290001", "geography": "Tract 48029.01, TX", "delta_pct": -32.1, "severity": "high", "persistence_weeks": 4},
    {"kpi": "Enumerator Productivity", "kpi_group": "operations", "geography_id": "36061", "geography": "New York County, NY", "delta_pct": -21.5, "severity": "high", "persistence_weeks": 2},
    {"kpi": "Duplicate Rate", "kpi_group": "quality", "geography_id": "17031", "geography": "Cook County, IL", "delta_pct": 45.2, "severity": "high", "persistence_weeks": 3},
    {"kpi": "Overall Response Rate", "kpi_group": "response_rate", "geography_id": "13121", "geography": "Fulton County, GA", "delta_pct": -15.8, "severity": "medium", "persistence_weeks": 2},
    {"kpi": "Cost Per Case", "kpi_group": "operations", "geography_id": "39035", "geography": "Cuyahoga County, OH", "delta_pct": 28.4, "severity": "medium", "persistence_weeks": 3},
    {"kpi": "Edit Rate", "kpi_group": "quality", "geography_id": "42101", "geography": "Philadelphia County, PA", "delta_pct": 22.1, "severity": "medium", "persistence_weeks": 1},
    {"kpi": "Item Non-Response", "kpi_group": "quality", "geography_id": "37119", "geography": "Mecklenburg County, NC", "delta_pct": 19.3, "severity": "medium", "persistence_weeks": 2},
    {"kpi": "Mail Response", "kpi_group": "response_rate", "geography_id": "26163", "geography": "Wayne County, MI", "delta_pct": -16.2, "severity": "medium", "persistence_weeks": 1},
    {"kpi": "Workload Completion", "kpi_group": "operations", "geography_id": "04013", "geography": "Maricopa County, AZ", "delta_pct": -12.4, "severity": "medium", "persistence_weeks": 2},
    {"kpi": "Internet Response", "kpi_group": "response_rate", "geography_id": "53033", "geography": "King County, WA", "delta_pct": 14.6, "severity": "low", "persistence_weeks": 1},
    {"kpi": "Valid Records", "kpi_group": "quality", "geography_id": "06073", "geography": "San Diego County, CA", "delta_pct": -8.3, "severity": "low", "persistence_weeks": 1},
    {"kpi": "Contact Attempt Rate", "kpi_group": "operations", "geography_id": "12011", "geography": "Broward County, FL", "delta_pct": -9.1, "severity": "low", "persistence_weeks": 1},
    {"kpi": "Proxy Rate", "kpi_group": "operations", "geography_id": "36047", "geography": "Kings County, NY", "delta_pct": 15.7, "severity": "medium", "persistence_weeks": 2},
    {"kpi": "Self-Response Rate", "kpi_group": "response_rate", "geography_id": "48201", "geography": "Harris County, TX", "delta_pct": -11.8, "severity": "low", "persistence_weeks": 1},
    {"kpi": "Completeness", "kpi_group": "quality", "geography_id": "390490002", "geography": "Tract 39049.02, OH", "delta_pct": -26.4, "severity": "high", "persistence_weeks": 3, "safe_to_display": False},
    {"kpi": "NRFU Response Rate", "kpi_group": "response_rate", "geography_id": "170310003", "geography": "Tract 17031.03, IL", "delta_pct": -19.8, "severity": "medium", "persistence_weeks": 2, "safe_to_display": False},
    {"kpi": "Enumerator Productivity", "kpi_group": "operations", "geography_id": "06085", "geography": "Santa Clara County, CA", "delta_pct": -13.2, "severity": "low", "persistence_weeks": 1},
    {"kpi": "Overall Response Rate", "kpi_group": "response_rate", "geography_id": "42003", "geography": "Allegheny County, PA", "delta_pct": -10.5, "severity": "low", "persistence_weeks": 1},
    {"kpi": "Duplicate Rate", "kpi_group": "quality", "geography_id": "360810004", "geography": "Tract 36081.04, NY", "delta_pct": 38.7, "severity": "high", "persistence_weeks": 2, "safe_to_display": False},
]

def get_anomalies(
    kpi_group: str | None = None,
    geography: str | None = None,
    severity: str | None = None,
    search: str | None = None,
    sort_by: str = "severity",
    sort_dir: str = "desc",
) -> list[dict]:
    """Return filtered/sorted anomaly list."""
    items = []
    for i, a in enumerate(_ANOMALY_POOL):
        item = {
            "id": f"a{i + 1}",
            "kpi": a["kpi"],
            "kpi_group": a["kpi_group"],
            "geography_id": a["geography_id"],
            "geography": a["geography"],
            "time_scope": WEEKS[-1],
            "delta_pct": a["delta_pct"],
            "severity": a["severity"],
            "persistence_weeks": a["persistence_weeks"],
            "safe_to_display": a.get("safe_to_display", True),
        }
        items.append(item)

    if kpi_group:
        items = [i for i in items if i["kpi_group"] == kpi_group]
    if geography:
        items = [i for i in items if geography.lower() in i["geography"].lower() or i["geography_id"].startswith(geography)]
    if severity:
        items = [i for i in items if i["severity"] == severity]
    if search:
        s = search.lower()
        items = [i for i in items if s in i["kpi"].lower() or s in i["geography"].lower()]

    sev_order = {"high": 0, "medium": 1, "low": 2}
    if sort_by == "severity":
        items.sort(key=lambda x: sev_order.get(x["severity"], 9), reverse=(sort_dir == "desc"))
    elif sort_by == "delta_pct":
        items.sort(key=lambda x: abs(x["delta_pct"]), reverse=(sort_dir == "desc"))
    elif sort_by == "kpi":
        items.sort(key=lambda x: x["kpi"], reverse=(sort_dir == "desc"))

    return items


def get_top_anomalies(kpi_group: str | None = None, limit: int = 5) -> list[dict]:
    """Top anomalies for the overview page."""
    all_a = get_anomalies(kpi_group=kpi_group)
    return all_a[:limit]


# ---------------------------------------------------------------------------
# Hotspots — geography-level aggregation
# ---------------------------------------------------------------------------
def get_hotspots(kpi_group: str | None = None, limit: int = 8) -> list[dict]:
    """Geographies with largest benchmark deltas."""
    hotspots = [
        {"geography_id": "12", "geography": "Florida", "level": "state", "delta_pct": -18.4, "kpi": "Self-Response Rate", "kpi_group": "response_rate"},
        {"geography_id": "48", "geography": "Texas", "level": "state", "delta_pct": -14.2, "kpi": "NRFU Response Rate", "kpi_group": "response_rate"},
        {"geography_id": "36", "geography": "New York", "level": "state", "delta_pct": -12.8, "kpi": "Enumerator Productivity", "kpi_group": "operations"},
        {"geography_id": "17", "geography": "Illinois", "level": "state", "delta_pct": 22.6, "kpi": "Duplicate Rate", "kpi_group": "quality"},
        {"geography_id": "06", "geography": "California", "level": "state", "delta_pct": -10.3, "kpi": "Completeness", "kpi_group": "quality"},
        {"geography_id": "39", "geography": "Ohio", "level": "state", "delta_pct": 16.1, "kpi": "Cost Per Case", "kpi_group": "operations"},
        {"geography_id": "42", "geography": "Pennsylvania", "level": "state", "delta_pct": 11.8, "kpi": "Edit Rate", "kpi_group": "quality"},
        {"geography_id": "13", "geography": "Georgia", "level": "state", "delta_pct": -9.4, "kpi": "Overall Response Rate", "kpi_group": "response_rate"},
        {"geography_id": "37", "geography": "North Carolina", "level": "state", "delta_pct": 8.7, "kpi": "Item Non-Response", "kpi_group": "quality"},
        {"geography_id": "26", "geography": "Michigan", "level": "state", "delta_pct": -7.6, "kpi": "Mail Response", "kpi_group": "response_rate"},
    ]
    if kpi_group:
        hotspots = [h for h in hotspots if h["kpi_group"] == kpi_group]
    return hotspots[:limit]


# ---------------------------------------------------------------------------
# Trend data for drilldown
# ---------------------------------------------------------------------------
def get_trend(anomaly_id: str, time_granularity: str = "weekly") -> list[dict]:
    """Generate plausible trend series that shows anomaly onset."""
    # Find the anomaly
    idx = int(anomaly_id.replace("a", "")) - 1 if anomaly_id.startswith("a") else 0
    anomaly = _ANOMALY_POOL[idx % len(_ANOMALY_POOL)]
    baseline = 90.0
    for group in KPI_GROUPS.values():
        for kpi in group:
            if kpi["name"] == anomaly["kpi"]:
                baseline = kpi["baseline"]
                break

    periods = WEEKS if time_granularity == "weekly" else MONTHS
    values = []
    v = baseline
    drop_start = len(periods) - anomaly["persistence_weeks"] - 1
    for i, period in enumerate(periods):
        if i < drop_start:
            v = _jitter(baseline, 2)
        elif i == drop_start:
            v = _jitter(baseline * (1 + anomaly["delta_pct"] / 200), 3)
        else:
            v = _jitter(baseline * (1 + anomaly["delta_pct"] / 100), 4)
        values.append({"period": period, "value": round(v, 1), "benchmark": baseline})
    return values


def get_top_contributors(anomaly_id: str) -> list[dict]:
    """Top sub-geographies contributing to the anomaly."""
    idx = int(anomaly_id.replace("a", "")) - 1 if anomaly_id.startswith("a") else 0
    anomaly = _ANOMALY_POOL[idx % len(_ANOMALY_POOL)]
    geo = anomaly["geography"]
    # Generate 4-6 sub-geography contributors
    contributors = []
    remaining = 100.0
    names = [f"Sub-area {i} of {geo}" for i in range(1, 7)]
    for i, name in enumerate(names):
        if i == len(names) - 1:
            pct = round(remaining, 1)
        else:
            pct = round(random.uniform(5, min(45, remaining - 5 * (len(names) - i - 1))), 1)
            remaining -= pct
        contributors.append({"geography": name, "contribution_pct": pct, "delta_pct": round(anomaly["delta_pct"] * pct / 100, 1)})
    contributors.sort(key=lambda x: x["contribution_pct"], reverse=True)
    return contributors


# ---------------------------------------------------------------------------
# Demographics
# ---------------------------------------------------------------------------
DEMOGRAPHIC_DIMENSIONS = {
    "age_group": ["Under 18", "18-34", "35-54", "55-64", "65+"],
    "sex": ["Male", "Female"],
    "race": ["White", "Black", "Hispanic/Latino", "Asian", "Other/Multi"],
    "tenure": ["Owner", "Renter"],
    "relationship": ["Householder", "Spouse", "Child", "Other relative", "Non-relative"],
}


def get_demographic_breakdown(kpi_name: str, dimension: str = "age_group") -> list[dict]:
    """Breakdown of a KPI by demographic dimension."""
    categories = DEMOGRAPHIC_DIMENSIONS.get(dimension, DEMOGRAPHIC_DIMENSIONS["age_group"])
    baseline = 90.0
    for group in KPI_GROUPS.values():
        for kpi in group:
            if kpi["name"] == kpi_name:
                baseline = kpi["baseline"]
                break
    result = []
    for cat in categories:
        val = _jitter(baseline, 8)
        result.append({
            "category": cat,
            "value": val,
            "benchmark": baseline,
            "delta_pct": round(((val - baseline) / baseline) * 100, 1),
        })
    return result


# ---------------------------------------------------------------------------
# Collection modes
# ---------------------------------------------------------------------------
COLLECTION_MODES = ["Internet", "Phone (CATI)", "Mail", "In-Person (NRFU)", "Proxy"]


def get_collection_mode_breakdown(kpi_name: str) -> list[dict]:
    """Breakdown of a KPI by collection mode."""
    baseline = 90.0
    for group in KPI_GROUPS.values():
        for kpi in group:
            if kpi["name"] == kpi_name:
                baseline = kpi["baseline"]
                break
    result = []
    mode_factors = {"Internet": 1.05, "Phone (CATI)": 0.97, "Mail": 0.92, "In-Person (NRFU)": 1.01, "Proxy": 0.85}
    for mode in COLLECTION_MODES:
        val = round(baseline * mode_factors.get(mode, 1.0) * random.uniform(0.97, 1.03), 2)
        result.append({
            "mode": mode,
            "value": val,
            "benchmark": baseline,
            "delta_pct": round(((val - baseline) / baseline) * 100, 1),
            "count": random.randint(1000, 50000),
        })
    return result


# ---------------------------------------------------------------------------
# Quality Bands
# ---------------------------------------------------------------------------
def get_quality_bands(geography_id: str | None = None) -> dict:
    """Quality band distribution: Gold, Silver, Bronze, No-Match."""
    base = {"Gold": 62, "Silver": 21, "Bronze": 11, "No-Match": 6}
    if geography_id:
        # Vary by geography
        seed = sum(ord(c) for c in geography_id)
        random.seed(seed)
        base = {
            "Gold": random.randint(45, 75),
            "Silver": random.randint(12, 28),
            "Bronze": random.randint(5, 18),
            "No-Match": random.randint(2, 12),
        }
        total = sum(base.values())
        base = {k: round(v / total * 100, 1) for k, v in base.items()}
        random.seed(42)  # Reset
    return {
        "bands": [
            {"band": "Gold", "pct": base["Gold"], "color": "#c9a227", "description": "High confidence, fully validated"},
            {"band": "Silver", "pct": base["Silver"], "color": "#9e9e9e", "description": "Moderate confidence, minor edits needed"},
            {"band": "Bronze", "pct": base["Bronze"], "color": "#cd7f32", "description": "Low confidence, significant edits applied"},
            {"band": "No-Match", "pct": base["No-Match"], "color": "#b71c1c", "description": "Unresolved, requires manual review"},
        ],
        "total_records": random.randint(50000, 500000),
    }


# ---------------------------------------------------------------------------
# Investigations (richer set)
# ---------------------------------------------------------------------------
INVESTIGATIONS: dict[str, dict[str, Any]] = {
    "inv1": {
        "id": "inv1",
        "title": "Miami-Dade self-response collapse",
        "status": "escalated",
        "view_id": "v1",
        "anomaly_ids": ["a1"],
        "notes": "Self-response rate in Miami-Dade dropped 24% over 3 weeks. Correlates with hurricane-related displacement in southern precincts. Escalated to regional director.",
        "escalation": True,
        "created_at": "2026-02-10T09:15:00Z",
        "updated_at": "2026-02-24T14:30:00Z",
        "assigned_to": "Maria Chen",
    },
    "inv2": {
        "id": "inv2",
        "title": "Cook County duplicate spike",
        "status": "monitoring",
        "view_id": "v2",
        "anomaly_ids": ["a5"],
        "notes": "Duplicate rate increased 45% in Cook County. Appears related to a batch processing error in the internet response pipeline. Engineering aware and monitoring.",
        "escalation": False,
        "created_at": "2026-02-15T11:00:00Z",
        "updated_at": "2026-02-22T16:45:00Z",
        "assigned_to": "James Wilson",
    },
    "inv3": {
        "id": "inv3",
        "title": "LA County completeness decline",
        "status": "open",
        "view_id": None,
        "anomaly_ids": ["a2"],
        "notes": "Investigating completeness drop in Los Angeles County. May be related to form translation issues in multilingual tracts.",
        "escalation": False,
        "created_at": "2026-02-20T08:30:00Z",
        "updated_at": "2026-02-20T08:30:00Z",
        "assigned_to": "Sarah Johnson",
    },
    "inv4": {
        "id": "inv4",
        "title": "Texas NRFU response anomaly",
        "status": "explained",
        "view_id": "v3",
        "anomaly_ids": ["a3"],
        "notes": "NRFU response rate drop in Bexar County Tract 01 was caused by incorrect address listings from the MAF update. Addresses have been corrected. Closing after one more week of monitoring.",
        "escalation": False,
        "created_at": "2026-02-05T14:00:00Z",
        "updated_at": "2026-02-25T10:00:00Z",
        "assigned_to": "David Park",
    },
    "inv5": {
        "id": "inv5",
        "title": "NYC enumerator productivity drop",
        "status": "open",
        "view_id": None,
        "anomaly_ids": ["a4"],
        "notes": "Enumerator productivity in New York County dropped 21.5%. Reviewing staffing schedules and training records.",
        "escalation": False,
        "created_at": "2026-02-22T10:00:00Z",
        "updated_at": "2026-02-22T10:00:00Z",
        "assigned_to": "Maria Chen",
    },
    "inv6": {
        "id": "inv6",
        "title": "Ohio cost per case increase",
        "status": "monitoring",
        "view_id": None,
        "anomaly_ids": ["a7"],
        "notes": "Cost per case in Cuyahoga County up 28%. Likely driven by increased proxy interviews and repeat visits. Monitoring for trend stabilization.",
        "escalation": False,
        "created_at": "2026-02-18T09:00:00Z",
        "updated_at": "2026-02-23T11:30:00Z",
        "assigned_to": "James Wilson",
    },
    "inv7": {
        "id": "inv7",
        "title": "Philadelphia edit rate resolved",
        "status": "closed",
        "view_id": None,
        "anomaly_ids": ["a8"],
        "notes": "Edit rate spike in Philadelphia was caused by a one-time data import with formatting inconsistencies. Issue resolved in W07 processing cycle.",
        "escalation": False,
        "created_at": "2026-02-08T13:00:00Z",
        "updated_at": "2026-02-19T15:00:00Z",
        "assigned_to": "Sarah Johnson",
    },
    "inv8": {
        "id": "inv8",
        "title": "Georgia response rate regional review",
        "status": "open",
        "view_id": None,
        "anomaly_ids": ["a6"],
        "notes": "Overall response rate in Fulton County is trending down. Scheduling call with regional coordinator to review outreach strategy.",
        "escalation": False,
        "created_at": "2026-02-24T08:00:00Z",
        "updated_at": "2026-02-24T08:00:00Z",
        "assigned_to": "David Park",
    },
}


# ---------------------------------------------------------------------------
# Saved views
# ---------------------------------------------------------------------------
SAVED_VIEWS: dict[str, dict[str, Any]] = {
    "v1": {
        "id": "v1",
        "name": "Florida Response Rate Watch",
        "filters": {"time_window": "weekly", "geography": "12", "kpi_group": "response_rate"},
        "kpi_group": "response_rate",
        "benchmark_set": "2020_census",
        "created_at": "2026-02-10T09:00:00Z",
    },
    "v2": {
        "id": "v2",
        "name": "National Quality Overview",
        "filters": {"time_window": "weekly", "kpi_group": "quality"},
        "kpi_group": "quality",
        "benchmark_set": "2020_census",
        "created_at": "2026-02-12T14:00:00Z",
    },
    "v3": {
        "id": "v3",
        "name": "Texas NRFU Deep Dive",
        "filters": {"time_window": "weekly", "geography": "48", "kpi_group": "response_rate"},
        "kpi_group": "response_rate",
        "benchmark_set": "rolling_avg",
        "created_at": "2026-02-05T11:00:00Z",
    },
    "v4": {
        "id": "v4",
        "name": "Operations Cost Monitor",
        "filters": {"time_window": "monthly", "kpi_group": "operations"},
        "kpi_group": "operations",
        "benchmark_set": "2020_census",
        "created_at": "2026-02-18T16:00:00Z",
    },
}


# ---------------------------------------------------------------------------
# Map data — per-state KPI values for choropleth
# ---------------------------------------------------------------------------
def get_map_data(kpi_group: str = "quality") -> list[dict]:
    """Return per-state KPI values for map visualisation."""
    kpis = KPI_GROUPS.get(kpi_group, KPI_GROUPS["quality"])
    # Count anomalies per state
    anomaly_counts: dict[str, int] = {}
    for a in _ANOMALY_POOL:
        if kpi_group and a["kpi_group"] != kpi_group:
            continue
        state_id = a["geography_id"][:2]
        anomaly_counts[state_id] = anomaly_counts.get(state_id, 0) + 1

    result = []
    for state in STATES:
        seed_val = sum(ord(c) for c in state["id"] + kpi_group)
        rng = random.Random(seed_val)
        kpi_values = []
        for kpi in kpis:
            baseline = kpi["baseline"]
            # Deterministic jitter per state+kpi
            current = round(baseline * (1 + rng.uniform(-0.08, 0.06)), 2)
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
        result.append({
            "geography_id": state["id"],
            "geography": state["name"],
            "abbr": state["abbr"],
            "kpis": kpi_values,
            "anomaly_count": anomaly_counts.get(state["id"], 0),
        })
    return result


# ---------------------------------------------------------------------------
# Audit log (in-memory, populated by middleware)
# ---------------------------------------------------------------------------
AUDIT_LOG: list[dict] = [
    {"timestamp": "2026-02-26T08:01:12Z", "user": "maria.chen@census.gov", "method": "GET", "path": "/api/snapshot/overview", "status": 200, "duration_ms": 42.3, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:02:45Z", "user": "maria.chen@census.gov", "method": "GET", "path": "/api/anomalies", "status": 200, "duration_ms": 38.1, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:05:30Z", "user": "james.wilson@census.gov", "method": "GET", "path": "/api/drilldown?anomaly_id=a5", "status": 200, "duration_ms": 55.7, "entitlement": "title_13_only"},
    {"timestamp": "2026-02-26T08:10:02Z", "user": "sarah.johnson@census.gov", "method": "GET", "path": "/api/snapshot/overview", "status": 200, "duration_ms": 40.2, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:12:18Z", "user": "james.wilson@census.gov", "method": "GET", "path": "/api/anomalies?kpi_group=quality", "status": 200, "duration_ms": 36.5, "entitlement": "title_13_only"},
    {"timestamp": "2026-02-26T08:15:44Z", "user": "david.park@census.gov", "method": "POST", "path": "/api/investigations", "status": 200, "duration_ms": 62.1, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:20:11Z", "user": "maria.chen@census.gov", "method": "GET", "path": "/api/drilldown?anomaly_id=a1", "status": 200, "duration_ms": 48.9, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:25:33Z", "user": "sarah.johnson@census.gov", "method": "GET", "path": "/api/export/summary?format=csv", "status": 200, "duration_ms": 71.4, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:30:05Z", "user": "david.park@census.gov", "method": "PATCH", "path": "/api/investigations/inv4", "status": 200, "duration_ms": 44.8, "entitlement": "title_13_and_26"},
    {"timestamp": "2026-02-26T08:35:22Z", "user": "james.wilson@census.gov", "method": "GET", "path": "/api/drilldown/demographics?anomaly_id=a5&dimension=race", "status": 403, "duration_ms": 12.3, "entitlement": "title_13_only"},
]
