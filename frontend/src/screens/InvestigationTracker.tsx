import { useEffect, useState } from "react";
import Card from "../components/Card";
import Button from "../components/Button";
import StatusBadge from "../components/StatusBadge";
import AiChat from "../components/AiChat";
import Skeleton from "../components/Skeleton";
import { useToast } from "../components/Toast";
import { get, post, patch } from "../api/client";

type Investigation = {
  id: string;
  title: string;
  status: string;
  view_id: string | null;
  anomaly_ids: string[];
  notes: string;
  escalation: boolean;
  created_at: string;
  updated_at: string;
  assigned_to: string;
};

const STATUS_ORDER = ["open", "monitoring", "explained", "escalated", "closed"];
const STATUS_TRANSITIONS: Record<string, string[]> = {
  open: ["monitoring", "explained", "escalated"],
  monitoring: ["explained", "escalated", "closed"],
  explained: ["closed", "monitoring"],
  escalated: ["monitoring", "explained", "closed"],
  closed: ["open"],
};

export default function InvestigationTracker() {
  const [items, setItems] = useState<Investigation[] | null>(null);
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchText, setSearchText] = useState("");
  const [selected, setSelected] = useState<Investigation | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const { toast } = useToast();

  const load = () => {
    const params: Record<string, string> = {};
    if (statusFilter) params.status = statusFilter;
    if (searchText) params.search = searchText;
    get<{ items: Investigation[] }>("/investigations", params).then((r) => setItems(r.items));
  };

  useEffect(() => {
    load();
  }, [statusFilter]);

  const handleSearch = () => load();

  const handleCreate = async () => {
    if (!title.trim()) return;
    await post("/investigations", { title: title.trim(), notes, assigned_to: assignedTo || "Unassigned" });
    setTitle("");
    setNotes("");
    setAssignedTo("");
    toast("Investigation created", "success");
    load();
  };

  const handleStatusChange = async (inv: Investigation, newStatus: string) => {
    await patch(`/investigations/${inv.id}`, { status: newStatus });
    toast(`Status updated to ${newStatus}`, "success");
    load();
    if (selected?.id === inv.id) {
      setSelected({ ...inv, status: newStatus });
    }
  };

  const handleEscalate = async (inv: Investigation) => {
    await patch(`/investigations/${inv.id}`, { status: "escalated", escalation: true });
    toast("Investigation escalated", "info");
    load();
  };

  const handleSaveNotes = async () => {
    if (!selected) return;
    await patch(`/investigations/${selected.id}`, { notes: editNotes });
    toast("Notes saved", "success");
    load();
    setSelected({ ...selected, notes: editNotes });
  };

  const statusCounts = items
    ? STATUS_ORDER.reduce((acc, s) => {
        acc[s] = items.filter((i) => i.status === s).length;
        return acc;
      }, {} as Record<string, number>)
    : {};

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-census-gray-800">Investigation Tracker</h1>
        <p className="text-census-gray-500 text-sm mt-1">Track investigations: status, notes, escalation, and link to saved context.</p>
      </div>

      {/* Status summary pills */}
      {items && (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
              !statusFilter ? "bg-census-blue text-white" : "bg-census-gray-200 text-census-gray-600 hover:bg-census-gray-300"
            }`}
          >
            All ({items.length})
          </button>
          {STATUS_ORDER.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s === statusFilter ? "" : s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                statusFilter === s ? "bg-census-blue text-white" : "bg-census-gray-200 text-census-gray-600 hover:bg-census-gray-300"
              }`}
            >
              {s} ({statusCounts[s] || 0})
            </button>
          ))}
        </div>
      )}

      {/* Search bar */}
      <div className="flex gap-2 max-w-md">
        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search investigations..."
          className="flex-1 rounded border border-census-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-census-blue"
        />
        <Button onClick={handleSearch} className="text-sm px-3 py-2">Search</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Investigation list */}
        <div className="lg:col-span-2 space-y-3">
          {items === null ? (
            <Skeleton variant="table" rows={5} />
          ) : items.length === 0 ? (
            <Card>
              <p className="text-census-gray-500 text-sm py-4 text-center">No investigations found.</p>
            </Card>
          ) : (
            items.map((inv) => (
              <div
                key={inv.id}
                onClick={() => { setSelected(inv); setEditNotes(inv.notes); }}
                className={`bg-white rounded-lg border shadow-sm p-4 cursor-pointer transition hover:border-census-blue ${
                  selected?.id === inv.id ? "border-census-blue ring-1 ring-census-blue/30" : "border-census-gray-200"
                } ${inv.escalation ? "border-l-4 border-l-severity-high" : ""}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="font-medium text-census-gray-800 text-sm">{inv.title}</h4>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge status={inv.status} />
                      {inv.escalation && (
                        <span className="text-xs text-severity-high font-medium">ESCALATED</span>
                      )}
                      <span className="text-xs text-census-gray-400">{inv.assigned_to}</span>
                    </div>
                    <p className="text-xs text-census-gray-500 mt-1 line-clamp-2">{inv.notes}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-census-gray-400">{new Date(inv.updated_at).toLocaleDateString()}</p>
                    <p className="text-[10px] text-census-gray-400">{inv.anomaly_ids.length} anomaly(s)</p>
                  </div>
                </div>
                {/* Status transition buttons */}
                <div className="flex gap-1 mt-3" onClick={(e) => e.stopPropagation()}>
                  {(STATUS_TRANSITIONS[inv.status] || []).map((next) => (
                    <button
                      key={next}
                      onClick={() => handleStatusChange(inv, next)}
                      className="text-[11px] px-2 py-0.5 rounded border border-census-gray-300 text-census-gray-600 hover:bg-census-gray-100 transition"
                    >
                      &rarr; {next}
                    </button>
                  ))}
                  {inv.status !== "escalated" && (
                    <button
                      onClick={() => handleEscalate(inv)}
                      className="text-[11px] px-2 py-0.5 rounded border border-severity-high/30 text-severity-high hover:bg-severity-high/5 transition"
                    >
                      Escalate
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Detail panel / Create form */}
        <div className="space-y-4">
          {selected ? (
            <>
              <Card title={`Investigation: ${selected.id}`}>
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-census-gray-500">Title</dt>
                    <dd className="text-right font-medium">{selected.title}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-census-gray-500">Status</dt>
                    <dd><StatusBadge status={selected.status} /></dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-census-gray-500">Assigned</dt>
                    <dd>{selected.assigned_to}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-census-gray-500">Created</dt>
                    <dd>{new Date(selected.created_at).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-census-gray-500">Updated</dt>
                    <dd>{new Date(selected.updated_at).toLocaleDateString()}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-census-gray-500">Anomalies</dt>
                    <dd>{selected.anomaly_ids.map((a) => (
                      <a key={a} href={`/drilldown?anomaly_id=${a}`} className="text-census-blue hover:underline mr-1">{a}</a>
                    ))}</dd>
                  </div>
                </dl>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-census-gray-600 mb-1">Notes</label>
                  <textarea
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm"
                    rows={4}
                  />
                  <Button onClick={handleSaveNotes} className="mt-2 text-sm">Save Notes</Button>
                </div>
              </Card>
              <AiChat investigationId={selected.id} anomalyId={selected.anomaly_ids[0]} />
            </>
          ) : (
            <Card title="New Investigation">
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-census-gray-600 mb-1">Title</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Investigation title"
                    className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-census-gray-600 mb-1">Assigned to</label>
                  <input
                    type="text"
                    value={assignedTo}
                    onChange={(e) => setAssignedTo(e.target.value)}
                    placeholder="Analyst name"
                    className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-census-gray-600 mb-1">Notes</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Initial notes..."
                    className="block w-full rounded border border-census-gray-300 px-3 py-2 text-sm"
                    rows={3}
                  />
                </div>
                <Button onClick={handleCreate} disabled={!title.trim()}>Create Investigation</Button>
              </div>
            </Card>
          )}
          {selected && (
            <button onClick={() => setSelected(null)} className="text-sm text-census-blue hover:underline">
              &larr; Back to create form
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
