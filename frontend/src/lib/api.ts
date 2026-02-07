// src/lib/api.ts
const API_BASE = import.meta.env.VITE_API_BASE_URL as string | undefined;

if (!API_BASE) {
  console.warn(
    'VITE_API_BASE_URL is not set – API calls will fail. ' +
      'Set it in a .env.local file (e.g. VITE_API_BASE_URL=http://66.23.202.2:9011/api).'
  );
}

// Generic request helper
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!API_BASE) {
    throw new Error('API base URL is not configured');
  }

  const res = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  });

  const text = await res.text();

  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (e) {
    console.error('Non-JSON response from API:', text);
    throw new Error('API did not return valid JSON');
  }

  if (!res.ok) {
    console.error('API error:', res.status, json);
    throw new Error(`API error ${res.status}`);
  }

  return json as T;
}

// ---- Types + endpoint wrappers ----

// Exactly what your /api/health returns
export type HealthResponse = {
  status: string;
  app: string;
  version: string;
  timezone: string;
  php: string;
  laravel: string;
  time: string;
};

export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

// You can extend with Jobs later:
export interface Job {
  id: number;
  title: string;
  description: string | null;
  status: string;
  // etc...
}

export function getJobs(): Promise<Job[]> {
  return request<Job[]>('/jobs');
}
export function getJob(id: number): Promise<Job> {
    return request<Job>(`/jobs/${id}`);
    } 