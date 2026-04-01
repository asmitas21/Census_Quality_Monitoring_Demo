import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { get } from "../api/client";

interface AlertData {
  alert_type: string;
  severity: string;
  headline: string;
  description: string;
  affected_tracts: number;
  affected_counties: number;
  multiplier: number;
  action: string;
}

export function JourneyAlert() {
  const [alert, setAlert] = useState<AlertData | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    get<AlertData>("/journey/children-alert")
      .then(setAlert)
      .catch(() => {});
  }, []);

  if (!alert || dismissed) return null;

  return (
    <div className={`relative overflow-hidden rounded-xl ${
      alert.severity === "high" 
        ? "bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20" 
        : "bg-gradient-to-r from-orange-500/10 to-yellow-500/10 border border-orange-500/20"
    } p-4`}>
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-full transition"
      >
        <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div className="flex items-center gap-4">
        <div className="p-2 rounded-lg bg-red-500/20">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 text-xs font-medium rounded ${
              alert.severity === "high" ? "bg-red-500 text-white" : "bg-orange-500 text-white"
            }`}>
              NEW PATTERN
            </span>
            <span className="text-sm font-semibold text-white">{alert.headline}</span>
          </div>
          <p className="text-sm text-white/70 line-clamp-1">
            {alert.multiplier}x risk multiplier across {alert.affected_tracts?.toLocaleString()} tracts
          </p>
        </div>
        <Link
          to="/children"
          className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium rounded-lg transition flex items-center gap-2"
        >
          Investigate
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
