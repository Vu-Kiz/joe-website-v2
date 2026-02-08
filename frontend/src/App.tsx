// src/App.tsx
import { useEffect, useState } from 'react';
import styles from './App.module.sass';
import { getHealth } from './lib/api';
import type { HealthResponse } from './lib/api';

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch((err) => {
        console.error(err);
        setError(err.message || 'Failed to load health');
      });
  }, []);

  return (
    <div className={styles.app}>
      <h1>Jawa Offworld Enterprises v2</h1>

      {error && <p className={styles.error}>Error: {error}</p>}

      {!health && !error && <p>Loading health…</p>}

      {health && (
        <div className={styles.healthCard}>
          <p>
            <strong>Status:</strong>{' '}
            <span
              className={
                health.status === 'ok'
                  ? styles.statusOk
                  : styles.statusBad
              }
            >
              {health.status.toUpperCase()}
            </span>
          </p>

          <p><strong>App:</strong> {health.app}</p>
          <p><strong>Version:</strong> {health.version}</p>
          <p><strong>PHP:</strong> {health.php}</p>
          <p><strong>Laravel:</strong> {health.laravel}</p>
          <p><strong>Time:</strong> {health.time}</p>

          <hr />

          <p>
            <strong>Database:</strong>{' '}
            <span
              className={
                health.database.status === 'ok'
                  ? styles.statusOk
                  : styles.statusBad
              }
            >
              {health.database.status.toUpperCase()}
            </span>
          </p>

          {health.database.status === 'ok' && (
            <>
              <p><strong>Driver:</strong> {health.database.driver}</p>
              <p><strong>Host:</strong> {health.database.host}</p>
              <p><strong>DB Name:</strong> {health.database.database}</p>
            </>
          )}

          {health.database.status === 'error' && (
            <p className={styles.error}>
              DB Error: {health.database.error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
