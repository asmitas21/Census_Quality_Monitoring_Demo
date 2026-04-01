import { useEffect, useState } from "react";
import { get } from "../api/client";

let _cached: string | null = null;
let _promise: Promise<string> | null = null;

function fetchHost(): Promise<string> {
  if (_cached) return Promise.resolve(_cached);
  if (!_promise) {
    _promise = get<{ workspace_host: string }>("/config")
      .then((r) => {
        _cached = (r.workspace_host || "").replace(/\/+$/, "");
        return _cached;
      })
      .catch(() => {
        _cached = "";
        return "";
      });
  }
  return _promise;
}

export function useWorkspaceHost(): string {
  const [host, setHost] = useState(_cached ?? "");
  useEffect(() => {
    fetchHost().then(setHost);
  }, []);
  return host;
}

export function ucExploreUrl(host: string, path: string): string {
  if (!host) return "#";
  const cleaned = path.replace(/\./g, "/");
  return `${host}/explore/data/${cleaned}`;
}

export function dashboardUrl(host: string, dashboardId: string): string {
  if (!host) return "#";
  return `${host}/sql/dashboardsv3/${dashboardId}`;
}

export function dashboardEmbedUrl(host: string, dashboardId: string, page?: number): string {
  if (!host) return "#";
  return `${host}/embed/dashboardsv3/${dashboardId}${page != null ? `?p=${page}` : ""}`;
}

export function volumeUrl(host: string, volumePath: string): string {
  if (!host) return "#";
  return `${host}/explore/data/volumes/${volumePath}`;
}
