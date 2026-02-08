import React, { useEffect, useState } from "react";
import type { HealthPayload } from "../api/health";
import { fetchHealth } from "../api/health";

const HealthStatus: React.FC = () => {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setLoading(true);
        const health = await fetchHealth();
        if (!cancelled) {
          setData(health);
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message ?? "Failed to load health status");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="health-card">
        <p>Checking system health…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="health-card health-card--error">
        <h2>System Health</h2>
        <p>Failed to fetch health status.</p>
        <pre>{error}</pre>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const db = data.database;

  return (
    <div className="health-card">
      <h2>System Health</h2>

      <div className="health-row">
        <span>Overall</span>
        <span className={data.status === "ok" ? "status-ok" : "status-bad"}>
          {data.status.toUpperCase()}
        </span>
      </div>

      <div className="health-row">
        <span>App</span>
        <span>{data.app}</span>
      </div>

      <div className="health-row">
        <span>Environment</span>
        <span>{data.env}</span>
      </div>

      <div className="health-row">
        <span>Version</span>
        <span>{data.version}</span>
      </div>

      <div className="health-row">
        <span>PHP</span>
        <span>{data.php}</span>
      </div>

      <div className="health-row">
        <span>Laravel</span>
        <span>{data.laravel}</span>
      </div>

      <div className="health-row">
        <span>Time</span>
        <span>{data.time}</span>
      </div>

      <hr />

      <div className="health-row">
        <span>Database</span>
        <span className={db.status === "ok" ? "status-ok" : "status-bad"}>
          {db.status.toUpperCase()}
        </span>
      </div>

      {db.driver && (
        <div className="health-row">
          <span>DB Driver</span>
          <span>{db.driver}</span>
        </div>
      )}

      {db.host && (
        <div className="health-row">
          <span>DB Host</span>
          <span>{db.host}</span>
        </div>
      )}

      {db.database && (
        <div className="health-row">
          <span>DB Name</span>
          <span>{db.database}</span>
        </div>
      )}

      {db.error && (
        <div className="health-row health-row--error">
          <span>Error</span>
          <span>{db.error}</span>
        </div>
      )}
    </div>
  );
};

export default HealthStatus;
