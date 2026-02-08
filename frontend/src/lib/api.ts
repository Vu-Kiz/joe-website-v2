export interface DatabaseHealth {
  status: 'ok' | 'error';
  driver?: string;
  host?: string;
  database?: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  app: string;
  env?: string;
  version: string;
  timezone?: string;
  php: string;
  laravel: string;
  time: string;
  database: DatabaseHealth;
}