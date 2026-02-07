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
      <h1>Jawa Offworld Enterprises v2 (Dev)</h1>

      {error && <p className={styles.error}>Error: {error}</p>}

      {health ? (
        <div className={styles.healthCard}>
          <p>Status: {health.status}</p>
          <p>App: {health.app}</p>
          <p>Version: {health.version}</p>
          <p>PHP: {health.php}</p>
          <p>Laravel: {health.laravel}</p>
          <p>Time: {health.time}</p>
        </div>
      ) : !error ? (
        <p>Loading health…</p>
      ) : null}
    </div>
  );
}

export default App;
