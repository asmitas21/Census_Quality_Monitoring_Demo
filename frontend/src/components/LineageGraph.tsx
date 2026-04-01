import { useEffect, useState } from "react";
import { get } from "../api/client";
import { useWorkspaceHost, ucExploreUrl } from "../hooks/useWorkspaceHost";

type LineageNode = {
  id: string;
  label: string;
  type: "source_table" | "transformation" | "metric" | "downstream_metric";
  full_path?: string;
  certified?: boolean;
  owner?: string;
};

type LineageEdge = {
  from: string;
  to: string;
};

type LineageData = {
  nodes: LineageNode[];
  edges: LineageEdge[];
};

type Props = {
  metricName: string;
  compact?: boolean;
};

const nodeColors = {
  source_table: { bg: "bg-blue-500/20", border: "border-blue-500", text: "text-blue-400", icon: "📊" },
  transformation: { bg: "bg-purple-500/20", border: "border-purple-500", text: "text-purple-400", icon: "⚙️" },
  metric: { bg: "bg-primary-500/20", border: "border-primary-500", text: "text-primary-400", icon: "📈" },
  downstream_metric: { bg: "bg-green-500/20", border: "border-green-500", text: "text-green-400", icon: "📊" },
};

export default function LineageGraph({ metricName, compact = false }: Props) {
  const host = useWorkspaceHost();
  const [lineage, setLineage] = useState<LineageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<LineageNode | null>(null);

  useEffect(() => {
    setLoading(true);
    get<LineageData>(`/governance/lineage/${encodeURIComponent(metricName)}`)
      .then(setLineage)
      .catch(() => setLineage(null))
      .finally(() => setLoading(false));
  }, [metricName]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lineage) {
    return (
      <div className="text-center py-8 text-census-gray-500">
        Unable to load lineage data
      </div>
    );
  }

  const sourceNodes = lineage.nodes.filter(n => n.type === "source_table");
  const transformNodes = lineage.nodes.filter(n => n.type === "transformation");
  const metricNode = lineage.nodes.find(n => n.type === "metric");
  const downstreamNodes = lineage.nodes.filter(n => n.type === "downstream_metric");

  if (compact) {
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-census-gray-500">{sourceNodes.length} sources</span>
        <span className="text-census-gray-600">→</span>
        <span className="text-primary-400 font-medium">{metricName}</span>
        {downstreamNodes.length > 0 && (
          <>
            <span className="text-census-gray-600">→</span>
            <span className="text-census-gray-500">{downstreamNodes.length} downstream</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Lineage Flow Diagram */}
      <div className="flex items-stretch gap-4 overflow-x-auto py-4">
        {/* Source Tables Column */}
        <div className="flex flex-col gap-2 min-w-[160px]">
          <p className="text-xs text-census-gray-500 font-medium uppercase tracking-wide mb-1">Source Tables</p>
          {sourceNodes.map(node => (
            <button
              key={node.id}
              onClick={() => setSelectedNode(node)}
              className={`p-3 rounded-lg border ${nodeColors.source_table.bg} ${nodeColors.source_table.border} hover:scale-105 transition-transform text-left`}
            >
              <div className="flex items-center gap-2">
                <span>{nodeColors.source_table.icon}</span>
                <span className={`text-sm font-medium ${nodeColors.source_table.text}`}>{node.label}</span>
              </div>
              {node.full_path && (
                <p className="text-xs text-census-gray-500 mt-1 truncate">{node.full_path}</p>
              )}
            </button>
          ))}
        </div>

        {/* Arrow */}
        <div className="flex items-center">
          <div className="w-8 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500" />
          <svg className="w-3 h-3 text-purple-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </div>

        {/* Transformations Column */}
        {transformNodes.length > 0 && (
          <>
            <div className="flex flex-col gap-2 min-w-[140px]">
              <p className="text-xs text-census-gray-500 font-medium uppercase tracking-wide mb-1">Transforms</p>
              {transformNodes.map(node => (
                <button
                  key={node.id}
                  onClick={() => setSelectedNode(node)}
                  className={`p-3 rounded-lg border ${nodeColors.transformation.bg} ${nodeColors.transformation.border} hover:scale-105 transition-transform text-left`}
                >
                  <div className="flex items-center gap-2">
                    <span>{nodeColors.transformation.icon}</span>
                    <span className={`text-sm font-medium ${nodeColors.transformation.text}`}>{node.label}</span>
                  </div>
                </button>
              ))}
            </div>

            {/* Arrow */}
            <div className="flex items-center">
              <div className="w-8 h-0.5 bg-gradient-to-r from-purple-500 to-primary-500" />
              <svg className="w-3 h-3 text-primary-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </>
        )}

        {/* Current Metric */}
        {metricNode && (
          <div className="flex flex-col gap-2 min-w-[180px]">
            <p className="text-xs text-census-gray-500 font-medium uppercase tracking-wide mb-1">This Metric</p>
            <div
              className={`p-4 rounded-lg border-2 ${nodeColors.metric.bg} ${nodeColors.metric.border} ring-2 ring-primary-500/30 animate-glow`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{nodeColors.metric.icon}</span>
                <span className={`text-sm font-bold ${nodeColors.metric.text}`}>{metricNode.label}</span>
                {metricNode.certified && (
                  <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">✓</span>
                )}
              </div>
              {metricNode.owner && (
                <p className="text-xs text-census-gray-400 mt-2">Owner: {metricNode.owner}</p>
              )}
            </div>
          </div>
        )}

        {/* Arrow */}
        {downstreamNodes.length > 0 && (
          <div className="flex items-center">
            <div className="w-8 h-0.5 bg-gradient-to-r from-primary-500 to-green-500" />
            <svg className="w-3 h-3 text-green-500 -ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        )}

        {/* Downstream Metrics */}
        {downstreamNodes.length > 0 && (
          <div className="flex flex-col gap-2 min-w-[160px]">
            <p className="text-xs text-census-gray-500 font-medium uppercase tracking-wide mb-1">Downstream</p>
            {downstreamNodes.map(node => (
              <button
                key={node.id}
                onClick={() => setSelectedNode(node)}
                className={`p-3 rounded-lg border ${nodeColors.downstream_metric.bg} ${nodeColors.downstream_metric.border} hover:scale-105 transition-transform text-left`}
              >
                <div className="flex items-center gap-2">
                  <span>{nodeColors.downstream_metric.icon}</span>
                  <span className={`text-sm font-medium ${nodeColors.downstream_metric.text}`}>{node.label}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="mt-4 p-4 bg-slate-850 rounded-lg border border-white/10">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white">{selectedNode.label}</h4>
            <button onClick={() => setSelectedNode(null)} className="text-census-gray-500 hover:text-white">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {selectedNode.full_path && (
            <p className="text-sm text-census-gray-400 mt-2 font-mono">{selectedNode.full_path}</p>
          )}
          <div className="flex gap-2 mt-3">
            <a 
              href={ucExploreUrl(host, selectedNode.full_path || '')}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-primary-500/20 text-primary-400 text-xs rounded hover:bg-primary-500/30"
            >
              View in Unity Catalog →
            </a>
            <button 
              onClick={() => {
                navigator.clipboard.writeText(selectedNode.full_path || selectedNode.label);
              }}
              className="px-3 py-1.5 bg-white/5 text-census-gray-400 text-xs rounded hover:bg-white/10"
            >
              Copy Path
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
