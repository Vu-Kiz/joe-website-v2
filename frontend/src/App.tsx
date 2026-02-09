// src/App.tsx
import { useEffect, useState } from "react";
import styles from "./App.module.sass";
import { getHealth, type HealthResponse } from "./api/health";

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err: unknown) => {
        console.error(err);
        const message =
          err instanceof Error ? err.message : "Failed to load health";
        setError(message);
      });
  }, []);

  return (
    <div className={styles.app}>
      <h1>Jawa Offworld Enterprises v2</h1>

      {error && <p className={styles.error}>Error: {error}</p>}

      {health ? (
        <div className={styles.healthCard}>
          <p>Status: {health.status}</p>
          <p>App: {health.app}</p>
          <p>Env: {health.env}</p>
          <p>Version: {health.version}</p>
          <p>PHP: {health.php}</p>
          <p>Laravel: {health.laravel}</p>
          <p>Time: {health.time}</p>

          <div className={styles.dbSection}>
            <h2>Database</h2>
            <p>Status: {health.database.status}</p>
            <p>
              {health.database.driver} @ {health.database.host} / {health.database.database}
            </p>
          </div>
        </div>
      ) : !error ? (
        <p>Loading health…</p>
      ) : null}
    </div>
  );
}

export default App;
