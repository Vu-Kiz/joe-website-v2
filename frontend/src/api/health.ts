// src/api/health.ts
import { api } from "./client";

export interface DatabaseHealth {
  status: string;        // "ok" | "error"
  driver?: string | null;
  host?: string | null;
  database?: string | null;
  error?: string | null;
}

export interface HealthResponse {
  status: string;
  app: string;
  env: string;
  version: string;
  timezone: string;
  php: string;
  laravel: string;
  time: string;
  database: DatabaseHealth;
}

export async function getHealth(): Promise<HealthResponse> {
  const { data } = await api.get<HealthResponse>("/health");
  return data;
}
