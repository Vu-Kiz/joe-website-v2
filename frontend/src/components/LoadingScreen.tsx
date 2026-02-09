import React, { useEffect, useState } from "react";
import styles from "../styles/loading.module.sass";
import jawaLogo from "../assets/branding/jawalogo.png";
import { getLoadingTip } from "../api/loadingTips";

const LoadingScreen: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initializing...");
  const [tip, setTip] = useState<string>("Consulting Jawa archives for a loading tip…");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
    let progressValue = 0;
    let progressTimer: number | null = null;
    let tipTimer: number | null = null;
    let cancelled = false;

    const updateUI = (p: number) => {
      setProgress(p);

      if (p < 10) setStatus("Spinning up droids…");
      else if (p < 35) setStatus("Aligning hyperdrives…");
      else if (p < 60) setStatus("Negotiating with Jawas…");
      else if (p < 85) setStatus("Sweeping sand out of circuits…");
      else if (p < 100) setStatus("Final checks…");
      else setStatus("Done — redirecting…");
    };

    const fetchTip = async () => {
      try {
        const data = await getLoadingTip();
        if (!cancelled) {
          setTip(data.tip);
        }
      } catch (err) {
        if (!cancelled) {
          setTip("Could not fetch tip — check server.");
        }
      }
    };

    progressTimer = window.setInterval(() => {
      const remaining = 100 - progressValue;

      if (remaining <= 0) {
        window.clearInterval(progressTimer!);
        setTimeout(() => {
          if (!cancelled) window.location.href = "/home";
        }, 750);
        return;
      }

      let step = Math.random() * Math.max(1, Math.min(8, remaining / 10));
      if (remaining < 12) step = Math.random() * 2;

      progressValue = Math.min(100, +(progressValue + step).toFixed(2));
      updateUI(progressValue);
    }, 220);

    // First tip right away
    fetchTip();

    // Refresh the tip periodically while loading, up to ~85%
    tipTimer = window.setInterval(() => {
      if (progressValue < 85) fetchTip();
      else window.clearInterval(tipTimer!);
    }, 4500);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelled = true;
        window.clearInterval(progressTimer!);
        window.clearInterval(tipTimer!);
        setSkipped(true);
        setStatus("Cancelled — skipping loading…");
        setTimeout(() => (window.location.href = "/home"), 800);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
      if (progressTimer) window.clearInterval(progressTimer);
      if (tipTimer) window.clearInterval(tipTimer);
    };
  }, []);

  return (
    <div className={styles.root}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src={jawaLogo} alt="Jawa Offworld Enterprises" />
        </div>

        <h1 className={styles.title}>
          Please wait while we repair the GNK powering the site...
        </h1>

        <div className={styles.bar}>
          <div
            className={styles.fill}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className={styles.meta}>
          <div className={styles.value}>{progress.toFixed(0)}%</div>
          <div className={styles.hint}>{status}</div>
        </div>

        <div className={styles.tips}>
          <div className={styles.tipText}>{tip}</div>
          <span className={styles.tipSmall}>
            {skipped
              ? "You pressed Esc to skip; GNK will finish repairs in the background."
              : ""}
          </span>
        </div>
      </div>
    </div>
  );
};

export default LoadingScreen;
