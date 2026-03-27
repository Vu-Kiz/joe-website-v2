import React, { useEffect, useState } from "react";
import { getLoadingTip } from "../api/loadingTips";
import ProgressLoadingCard from "../components/common/ProgressLoadingCard";

const LoadingScreen: React.FC = () => {
  const [tip, setTip] = useState<string>("Consulting Jawa archives for a loading tip…");
  const [skipped, setSkipped] = useState(false);

  useEffect(() => {
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

    // First tip right away
    fetchTip();

    tipTimer = window.setInterval(() => {
      fetchTip();
    }, 4500);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        cancelled = true;
        window.clearInterval(tipTimer!);
        setSkipped(true);
        setTimeout(() => (window.location.href = "/home"), 800);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => {
      cancelled = true;
      window.removeEventListener("keydown", onKey);
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
      ]}
      tip={
        skipped
          ? `${tip} You pressed Esc to skip; GNK will finish repairs in the background.`
          : tip
      }
    />
  );
};

export default LoadingScreen;
