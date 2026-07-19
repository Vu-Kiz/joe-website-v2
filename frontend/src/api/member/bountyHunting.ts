import { apiFetch } from "../core/auth";

export type BountyContractType = "kill" | "rescue";
export type BountyContractStatus = "active" | "completed" | "failed";
export type BountyRangeBand = "bearing_only" | "inner" | "mid" | "outer" | "beyond_100";

export type BountyContractScan = {
  id: number;
  scan_galx: number;
  scan_galy: number;
  bearing_degrees: number;
  range_band: BountyRangeBand | null;
  created_at: string | null;
};

export type BountyContract = {
  id: number;
  target_name: string;
  difficulty: number;
  contract_type: BountyContractType;
  status: BountyContractStatus;
  deadline_at: string | null;
  notes: string | null;
  accepted_galx: number | null;
  accepted_galy: number | null;
  estimated_galx: number | null;
  estimated_galy: number | null;
  scans: BountyContractScan[];
  created_at: string | null;
  updated_at: string | null;
};

export type CandidateWorld = {
  id: number;
  name: string;
  owner_name: string;
  planet_type_name: string | null;
  galx: number;
  galy: number;
  distance: number;
  valid_cell_count: number;
  total_cell_count: number;
};

export function getBountyContracts() {
  return apiFetch<{ ok: boolean; data: BountyContract[] }>("/bounty-contracts");
}

export function createBountyContract(payload: {
  target_name: string;
  difficulty: number;
  contract_type: BountyContractType;
  deadline_at?: string | null;
  notes?: string | null;
  accepted_galx?: number | null;
  accepted_galy?: number | null;
}) {
  return apiFetch<{ ok: boolean; message: string; data: BountyContract }>("/bounty-contracts", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getCandidateBountyWorlds(params: { galx: number; galy: number; difficulty: number }) {
  const query = new URLSearchParams({
    galx: String(params.galx),
    galy: String(params.galy),
    difficulty: String(params.difficulty),
  });
  return apiFetch<{ ok: boolean; data: CandidateWorld[]; meta: { total_candidates: number; suggested_count: number } }>(
    `/bounty-contracts/candidate-worlds?${query.toString()}`
  );
}

export function updateBountyContract(
  contractId: number,
  payload: Partial<{
    target_name: string;
    difficulty: number;
    contract_type: BountyContractType;
    status: BountyContractStatus;
    deadline_at: string | null;
    notes: string | null;
    estimated_galx: number | null;
    estimated_galy: number | null;
  }>
) {
  return apiFetch<{ ok: boolean; message: string; data: BountyContract }>(`/bounty-contracts/${contractId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteBountyContract(contractId: number) {
  return apiFetch<{ ok: boolean; message: string }>(`/bounty-contracts/${contractId}`, {
    method: "DELETE",
  });
}

export function addBountyScan(
  contractId: number,
  payload: {
    scan_galx: number;
    scan_galy: number;
    bearing_degrees: number;
    range_band?: BountyRangeBand | null;
  }
) {
  return apiFetch<{ ok: boolean; message: string; data: BountyContract }>(`/bounty-contracts/${contractId}/scans`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateBountyScan(
  contractId: number,
  scanId: number,
  payload: {
    scan_galx: number;
    scan_galy: number;
    bearing_degrees: number;
    range_band?: BountyRangeBand | null;
  }
) {
  return apiFetch<{ ok: boolean; message: string; data: BountyContract }>(`/bounty-contracts/${contractId}/scans/${scanId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function deleteBountyScan(contractId: number, scanId: number) {
  return apiFetch<{ ok: boolean; message: string; data: BountyContract }>(
    `/bounty-contracts/${contractId}/scans/${scanId}`,
    { method: "DELETE" }
  );
}
