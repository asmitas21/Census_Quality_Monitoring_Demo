import { create } from "zustand";

interface FilterState {
  timeWindow: string;
  geography: string;
  kpiGroup: string;
  benchmarkSet: string;
  demographicDimension: string;
  collectionMode: string;
  // User entitlement from /api/snapshot/me
  userEmail: string;
  entitlement: "title_13_only" | "title_13_and_26";
  entitlementLoaded: boolean;
  setTimeWindow: (v: string) => void;
  setGeography: (v: string) => void;
  setKpiGroup: (v: string) => void;
  setBenchmarkSet: (v: string) => void;
  setDemographicDimension: (v: string) => void;
  setCollectionMode: (v: string) => void;
  setEntitlement: (email: string, entitlement: "title_13_only" | "title_13_and_26") => void;
}

export const useFilterStore = create<FilterState>((set) => ({
  timeWindow: "weekly",
  geography: "",
  kpiGroup: "response_rate",
  benchmarkSet: "2020_census",
  demographicDimension: "",
  collectionMode: "",
  userEmail: "",
  entitlement: "title_13_and_26",
  entitlementLoaded: false,
  setTimeWindow: (v) => set({ timeWindow: v }),
  setGeography: (v) => set({ geography: v }),
  setKpiGroup: (v) => set({ kpiGroup: v }),
  setBenchmarkSet: (v) => set({ benchmarkSet: v }),
  setDemographicDimension: (v) => set({ demographicDimension: v }),
  setCollectionMode: (v) => set({ collectionMode: v }),
  setEntitlement: (email, entitlement) => set({ userEmail: email, entitlement, entitlementLoaded: true }),
}));
