import React, { useEffect, useState } from "react";
import { getLoadingTip } from "../api/content/loadingTips";
import ProgressLoadingCard from "../components/common/ProgressLoadingCard";

const LoadingScreen: React.FC = () => {
  const [tip, setTip] = useState<string>("Consulting Jawa archives for a loading tip…");
  const [skipped, setSkipped] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let progressValue = 0;
    let progressTimer: number | null = null;
    let tipTimer: number | null = null;
    let cancelled = false;

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
        if (progressTimer) {
          window.clearInterval(progressTimer);
        }

        window.setTimeout(() => {
          if (!cancelled) {
            window.location.href = "/home";
          }
        }, 750);

        return;
      }

      let step = Math.random() * Math.max(1, Math.min(8, remaining / 10));
      if (remaining < 12) {
        step = Math.random() * 2;
      }

      progressValue = Math.min(100, +(progressValue + step).toFixed(2));
      setProgress(progressValue);
    }, 220);

    // First tip right away
    fetchTip();

    tipTimer = window.setInterval(() => {
      if (progressValue < 85) {
        fetchTip();
      } else if (tipTimer) {
        window.clearInterval(tipTimer);
      }
    }, 4500);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelled = true;
        if (progressTimer) window.clearInterval(progressTimer);
        window.clearInterval(tipTimer!);
        setSkipped(true);
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
    <ProgressLoadingCard
      title="Please wait while we repair the GNK powering the site..."
      stages={[
        "Spinning up droids…",
        "Aligning hyperdrives…",
        "Negotiating with Jawas…",
        "Sweeping sand out of circuits…",
        "Final checks…",
        "Done — redirecting…",
      ]}
      progress={progress}
      tip={
        skipped
          ? `${tip} You pressed Esc to skip; GNK will finish repairs in the background.`
          : tip
      }
    />
  );
};

export default LoadingScreen;
