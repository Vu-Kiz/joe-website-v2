import React, { useEffect, useMemo, useState } from "react";

type DirectionalCompassProps = {
  headingDegrees: number;
  imageSrc: string;
  bearingLabel?: string;
};

function normalizeDegrees(value: number) {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

const DirectionalCompass: React.FC<DirectionalCompassProps> = ({
  headingDegrees,
  imageSrc,
  bearingLabel = "Current Bearing",
}) => {
  const normalizedHeading = useMemo(
    () => normalizeDegrees(headingDegrees),
    [headingDegrees]
  );
  const [displayHeading, setDisplayHeading] = useState(normalizedHeading);

  useEffect(() => {
    setDisplayHeading((current) => {
      // Keep rotation continuous by choosing the equivalent target angle
      // closest to the current visual angle.
      const candidates = [normalizedHeading - 360, normalizedHeading, normalizedHeading + 360];
      let closest = candidates[0];
      let smallestDistance = Math.abs(candidates[0] - current);
      for (let i = 1; i < candidates.length; i += 1) {
        const distance = Math.abs(candidates[i] - current);
        if (distance < smallestDistance) { smallestDistance = distance; closest = candidates[i]; }
      }
      return closest;
    });
  }, [normalizedHeading]);

  return (
    <div className="grid gap-2 justify-items-center font-tektur">
      <div
        className="compass-visual relative w-[6.2rem] h-[6.2rem] grid place-items-center rounded-full border border-white/[0.12]"
        style={{
          background: "radial-gradient(circle at center, rgba(246,163,0,0.06), rgba(255,255,255,0.02) 62%, rgba(255,255,255,0.01))",
        }}
      >
        <span
          className="absolute w-[2px] h-[0.85rem] rounded-full pointer-events-none"
          style={{
            top: "50%",
            left: "50%",
            background: "rgba(246,163,0,0.95)",
            boxShadow: "0 0 12px rgba(246,163,0,0.5)",
            transform: `translate(-50%, -50%) rotate(${displayHeading}deg) translateY(-2.95rem)`,
          }}
          aria-hidden="true"
        />
        <img
          src={imageSrc}
          alt="Ship heading"
          className="w-[3.2rem] h-[3.2rem] object-contain transition-transform duration-[140ms] ease-in-out"
          style={{
            transformOrigin: "50% 50%",
            transform: `rotate(${displayHeading + 180}deg)`,
            filter: "drop-shadow(0 0 10px rgba(0,0,0,0.28))",
          }}
        />
      </div>
      <div className="grid justify-items-center gap-[0.1rem]">
        <span className="small">{bearingLabel}</span>
        <strong style={{ color: "rgba(246,163,0,0.95)", fontSize: "1.1rem" }}>{normalizedHeading}°</strong>
      </div>
    </div>
  );
};

export default DirectionalCompass;
