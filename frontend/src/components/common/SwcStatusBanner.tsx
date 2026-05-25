import React, { useEffect, useRef, useState } from "react";
import { fetchSwcStatus } from "../../api/core/swcStatus";

const POLL_INTERVAL_MS = 60_000;

const SwcStatusBanner: React.FC = () => {
  const [isDown, setIsDown] = useState(false);
  const timerRef = useRef<number | null>(null);

  const check = async () => {
    try {
      const data = await fetchSwcStatus();
      setIsDown(data.down === true);
    } catch {
      // If the status endpoint fails, don't falsely show the banner
      setIsDown(false);
    }
  };

  useEffect(() => {
    void check();

    timerRef.current = window.setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);

    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  if (!isDown) return null;

  return (
    <div className="page-shell">
      <div
        className="w-full mx-auto mb-2.5 px-3 py-2 sticky top-0 z-1100 rounded-lg border border-[rgba(220,40,40,0.65)] bg-[linear-gradient(90deg,rgba(95,0,0,0.9),rgba(160,10,10,0.9),rgba(95,0,0,0.9))] text-[#ffd5d5] font-tektur text-[18px] tracking-[0.22em] text-center uppercase"
        style={{
          animation: "var(--animate-swc-down)",
          animationDelay: `-${(performance.now() % 1100).toFixed(0)}ms`,
        }}
        role="status"
        aria-live="polite"
      >
        ⚠ SWC is currently unavailable ⚠
      </div>
    </div>
  );
};

export default SwcStatusBanner;
