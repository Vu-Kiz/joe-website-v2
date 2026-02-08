import client from "./client";

export interface DatabaseStatus {
  status: string;
  driver?: string;
  host?: string;
  database?: string;
  error?: string;
}

export interface HealthPayload {
  status: string;
  app: string;
  env: string;
  version: string;
  timezone: string;
  php: string;
  laravel: string;
  time: string;
  database: DatabaseStatus;
}

export async function fetchHealth(): Promise<HealthPayload> {
  const res = await client.get<HealthPayload>("/health");
  return res.data;
}
