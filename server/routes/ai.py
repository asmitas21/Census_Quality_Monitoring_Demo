"""AI-powered explainability and investigation assistant using Foundation Model endpoint."""
import os
import json
from typing import Any

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from server.auth import Entitlement, require_auth
from server.config import get_workspace_host, get_oauth_token, IS_DATABRICKS_APP
from server.mock_data import (
    _ANOMALY_POOL,
    get_trend,
    get_top_contributors,
    get_collection_mode_breakdown,
    get_demographic_breakdown,
    INVESTIGATIONS,
)

router = APIRouter(prefix="/ai", tags=["ai"])

SERVING_ENDPOINT = os.environ.get("SERVING_ENDPOINT", "databricks-claude-sonnet-4-5")


def _get_openai_client():
    """Get OpenAI client configured for Databricks Model Serving."""
    from openai import OpenAI

    host = get_workspace_host()
    token = get_oauth_token()

    if host and token:
        return OpenAI(
            api_key=token,
            base_url=f"{host}/serving-endpoints",
        )
    return None


def _build_anomaly_context(anomaly_id: str) -> str:
    """Build rich context string about an anomaly for the AI."""
    idx = int(anomaly_id.replace("a", "")) - 1 if anomaly_id.startswith("a") else 0
    anomaly = _ANOMALY_POOL[idx % len(_ANOMALY_POOL)]
    trend = get_trend(anomaly_id)
    contributors = get_top_contributors(anomaly_id)
    collection_modes = get_collection_mode_breakdown(anomaly["kpi"])

    trend_str = ", ".join([f"{t['period']}: {t['value']}" for t in trend[-6:]])
    contrib_str = "\n".join([f"  - {c['geography']}: {c['contribution_pct']}% contribution ({c['delta_pct']}% delta)" for c in contributors[:4]])
    mode_str = "\n".join([f"  - {m['mode']}: {m['value']} ({m['delta_pct']:+.1f}% vs benchmark)" for m in collection_modes])

    return f"""Anomaly Details:
- KPI: {anomaly['kpi']}
- Geography: {anomaly['geography']}
- Delta vs Benchmark: {anomaly['delta_pct']:+.1f}%
- Severity: {anomaly['severity']}
- Persistence: {anomaly['persistence_weeks']} weeks

Recent Trend (last 6 periods):
  {trend_str}

Top Contributing Sub-Areas:
{contrib_str}

Collection Mode Breakdown:
{mode_str}
"""


EXPLAIN_SYSTEM_PROMPT = """You are a Census Bureau Quality Monitoring analyst AI assistant. You help analysts understand data quality anomalies in Census operations.

Your role:
- Explain anomalies in clear, actionable language
- Identify likely root causes based on the data patterns
- Suggest investigation steps
- Always note when data may be disclosure-sensitive (Title 13/26)
- Be concise but thorough — analysts need to act on your insights
- Use bullet points for clarity
- Reference specific geographies, time periods, and collection modes from the data

Important: You are analyzing aggregated, disclosure-safe data. Never suggest accessing individual-level records."""


class AiExplainRequest(BaseModel):
    anomaly_id: str


class AiChatRequest(BaseModel):
    message: str
    anomaly_id: str | None = None
    investigation_id: str | None = None
    history: list[dict[str, str]] = []


@router.post("/explain")
async def ai_explain_anomaly(
    body: AiExplainRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Generate AI explanation for an anomaly. Falls back to template if no endpoint."""
    context = _build_anomaly_context(body.anomaly_id)

    client = _get_openai_client()
    if client:
        try:
            response = client.chat.completions.create(
                model=SERVING_ENDPOINT,
                messages=[
                    {"role": "system", "content": EXPLAIN_SYSTEM_PROMPT},
                    {"role": "user", "content": f"Analyze this anomaly and provide a root cause analysis with recommended next steps:\n\n{context}"},
                ],
                max_tokens=800,
                temperature=0.3,
            )
            return {
                "anomaly_id": body.anomaly_id,
                "explanation": response.choices[0].message.content,
                "source": "ai",
            }
        except Exception as e:
            print(f"AI endpoint error: {e}")

    # Fallback: template-based explanation
    idx = int(body.anomaly_id.replace("a", "")) - 1 if body.anomaly_id.startswith("a") else 0
    anomaly = _ANOMALY_POOL[idx % len(_ANOMALY_POOL)]
    contributors = get_top_contributors(body.anomaly_id)

    explanation = f"""**Root Cause Analysis: {anomaly['kpi']} in {anomaly['geography']}**

**Summary**: {anomaly['kpi']} has deviated {anomaly['delta_pct']:+.1f}% from the benchmark over the past {anomaly['persistence_weeks']} week(s). This is classified as a **{anomaly['severity']} severity** anomaly.

**Key Findings**:
- The deviation is primarily {"localized" if anomaly['persistence_weeks'] <= 2 else "broad-based"}, with the top contributing sub-area ({contributors[0]['geography']}) accounting for {contributors[0]['contribution_pct']}% of the total impact.
- The onset appears to have begun approximately {anomaly['persistence_weeks']} weeks ago, suggesting a {"sudden" if anomaly['persistence_weeks'] <= 1 else "gradual"} shift rather than a one-time data error.
- Collection mode analysis indicates potential disparities across response channels that may be contributing to the anomaly.

**Recommended Next Steps**:
1. Review operational logs for {anomaly['geography']} during the onset period to identify process changes.
2. Compare enumerator assignment patterns in the top contributing sub-areas.
3. Check for external factors (weather events, local conditions) that may have affected data collection.
4. {"Escalate to regional coordinator for immediate attention." if anomaly['severity'] == 'high' else "Continue monitoring with weekly check-ins."}

**Disclosure Note**: This analysis is based on aggregated data only. All outputs comply with Title 13/26 safe output requirements."""

    return {
        "anomaly_id": body.anomaly_id,
        "explanation": explanation,
        "source": "template",
    }


@router.post("/chat")
async def ai_chat(
    body: AiChatRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Chat with AI about anomalies or investigations."""
    # Build context
    context_parts = []
    if body.anomaly_id:
        context_parts.append(_build_anomaly_context(body.anomaly_id))
    if body.investigation_id and body.investigation_id in INVESTIGATIONS:
        inv = INVESTIGATIONS[body.investigation_id]
        context_parts.append(f"""Investigation: {inv['title']}
Status: {inv['status']}
Notes: {inv['notes']}
Assigned to: {inv.get('assigned_to', 'Unassigned')}
Linked anomalies: {', '.join(inv.get('anomaly_ids', []))}""")

    context = "\n\n".join(context_parts) if context_parts else "No specific context provided."

    client = _get_openai_client()
    if client:
        try:
            messages = [
                {"role": "system", "content": EXPLAIN_SYSTEM_PROMPT + f"\n\nCurrent context:\n{context}"},
            ]
            for h in body.history[-10:]:  # Keep last 10 messages
                messages.append({"role": h.get("role", "user"), "content": h["content"]})
            messages.append({"role": "user", "content": body.message})

            response = client.chat.completions.create(
                model=SERVING_ENDPOINT,
                messages=messages,
                max_tokens=600,
                temperature=0.4,
            )
            return {
                "response": response.choices[0].message.content,
                "source": "ai",
            }
        except Exception as e:
            print(f"AI chat error: {e}")

    # Fallback: contextual template responses
    msg_lower = body.message.lower()
    if "similar" in msg_lower or "pattern" in msg_lower:
        response = "Based on the current data, I can see similar patterns in neighboring geographies. Counties within the same state often share operational characteristics (staffing, training, local conditions) that could produce correlated anomalies. I'd recommend comparing the trend data for adjacent counties to see if this is a regional pattern."
    elif "summar" in msg_lower:
        response = f"Here's a summary of the current context:\n\n{context}\n\nKey takeaway: The anomaly shows a deviation that warrants continued monitoring. The contributing factors appear to be concentrated in specific sub-areas rather than broadly distributed."
    elif "escalat" in msg_lower:
        response = "Based on the severity and persistence of this anomaly, I'd recommend escalation if:\n- The delta exceeds 20% for more than 2 consecutive weeks\n- Multiple KPIs in the same geography are affected\n- The pattern is spreading to neighboring areas\n\nYou can escalate by updating the investigation status and adding an escalation note."
    elif "recommend" in msg_lower or "suggest" in msg_lower or "next" in msg_lower:
        response = "Recommended next steps:\n1. Cross-reference with operational logs for the affected time period\n2. Check if staffing or training changes were made\n3. Review collection mode distribution for shifts\n4. Compare demographic breakdowns to identify disproportionately affected groups\n5. Set up an alert subscription for this KPI/geography combination"
    else:
        response = f"I understand you're asking about: \"{body.message}\"\n\nBased on the data context, the key metrics show deviations from benchmark values. The pattern analysis suggests this may be related to operational factors in the affected geography. Would you like me to:\n- Analyze specific contributing factors?\n- Compare with historical patterns?\n- Draft an escalation summary?\n- Suggest investigation steps?"

    return {
        "response": response,
        "source": "template",
    }


class GenieRequest(BaseModel):
    query: str


GENIE_SPACE_ID = os.environ.get("GENIE_SPACE_ID", "01f1291dedc31ae78c941d3faf167a52")


def _poll_genie_message(host: str, token: str, space_id: str, conversation_id: str, message_id: str, max_wait: int = 60) -> dict:
    """Poll a Genie message until it completes or times out."""
    import time
    import urllib.request
    headers = {"Authorization": f"Bearer {token}"}
    url = f"{host}/api/2.0/genie/spaces/{space_id}/conversations/{conversation_id}/messages/{message_id}"

    deadline = time.time() + max_wait
    while time.time() < deadline:
        req = urllib.request.Request(url, headers=headers, method="GET")
        resp = urllib.request.urlopen(req)
        data = json.loads(resp.read().decode())
        status = data.get("status", "")
        if status in ("COMPLETED", "FAILED", "CANCELLED"):
            return data
        time.sleep(2)
    return {"status": "TIMEOUT"}


@router.post("/genie")
async def genie_query(
    body: GenieRequest,
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Route questions through the fine-tuned Databricks Genie Space."""
    import urllib.request

    host = get_workspace_host()
    token = get_oauth_token()
    if not host or not token:
        return {"answer": "Workspace connection not configured.", "source": "error"}

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    try:
        start_payload = json.dumps({"content": body.query}).encode()
        req = urllib.request.Request(
            f"{host}/api/2.0/genie/spaces/{GENIE_SPACE_ID}/start-conversation",
            data=start_payload, headers=headers, method="POST",
        )
        resp = urllib.request.urlopen(req)
        conv = json.loads(resp.read().decode())
    except Exception as e:
        print(f"Genie start-conversation error: {e}")
        return {"answer": f"Could not start Genie conversation: {e}", "source": "error"}

    conversation_id = conv.get("conversation_id", "")
    message_id = conv.get("message_id", "")
    if not conversation_id or not message_id:
        return {"answer": "Genie returned an unexpected response.", "source": "error"}

    result = _poll_genie_message(host, token, GENIE_SPACE_ID, conversation_id, message_id)

    if result.get("status") == "TIMEOUT":
        return {"answer": "Genie is still thinking — try again in a moment.", "source": "timeout"}

    if result.get("status") == "FAILED":
        error_msg = result.get("error", {}).get("message", "Unknown error")
        return {"answer": f"Genie query failed: {error_msg}", "source": "error"}

    attachments = result.get("attachments", [])
    generated_sql = ""
    answer_text = ""
    rows: list[dict[str, Any]] = []

    for att in attachments:
        if att.get("text", {}).get("content"):
            answer_text = att["text"]["content"]
        if att.get("query", {}):
            generated_sql = att["query"].get("query", "")
            query_result = att["query"].get("result", {})
            columns = [c.get("name", f"col_{i}") for i, c in enumerate(query_result.get("columns", []))]
            for row_data in query_result.get("data_array", [])[:20]:
                rows.append(dict(zip(columns, row_data)))

    if not answer_text and not generated_sql:
        reply = result.get("reply", "")
        if reply:
            answer_text = reply

    if not answer_text and rows:
        answer_text = f"Query returned {len(rows)} row(s)."
    elif not answer_text:
        answer_text = "Genie processed your question but produced no output."

    return {
        "answer": answer_text,
        "sql": generated_sql or None,
        "data": rows,
        "row_count": len(rows),
        "source": "genie",
    }


@router.post("/summarize")
async def ai_summarize(
    kpi_group: str = Query("quality"),
    entitlement: Entitlement = Depends(require_auth),
) -> dict[str, Any]:
    """Generate AI executive summary for export."""
    from server.mock_data import get_kpis, get_hotspots, get_anomalies

    kpis = get_kpis(kpi_group)
    anomalies = get_anomalies(kpi_group=kpi_group)
    hotspots = get_hotspots(kpi_group=kpi_group)

    high_count = sum(1 for a in anomalies if a["severity"] == "high")
    medium_count = sum(1 for a in anomalies if a["severity"] == "medium")

    summary = f"""**Quality Monitoring Executive Summary — {kpi_group.replace('_', ' ').title()}**
*Generated: February 26, 2026*

**Overall Status**: {"Requires Attention" if high_count > 0 else "Stable"} — {high_count} high severity, {medium_count} medium severity anomalies detected.

**KPI Highlights**:
"""
    for k in kpis:
        icon = "improving" if k["trend"] == "improving" else ("declining" if k["trend"] == "worsening" else "stable")
        summary += f"- **{k['name']}**: {k['value']}{k['unit']} (benchmark: {k['benchmark']}{k['unit']}, {k['delta_pct']:+.1f}%) — {icon}\n"

    summary += f"\n**Top Geographies of Concern**:\n"
    for h in hotspots[:5]:
        summary += f"- {h['geography']}: {h['delta_pct']:+.1f}% on {h['kpi']}\n"

    summary += f"\n**Recommended Actions**:\n"
    if high_count > 0:
        summary += "1. Immediate review of high-severity anomalies by regional coordinators\n"
    summary += f"2. Continue monitoring {medium_count} medium-severity items\n"
    summary += "3. Schedule weekly review of trending metrics\n"
    summary += "\n*This summary is based on aggregated, disclosure-safe data. All outputs comply with Title 13/26 requirements.*"

    return {"summary": summary, "kpi_group": kpi_group}
