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
      // that's closest to the current visual angle.
      const candidates = [
        normalizedHeading - 360,
        normalizedHeading,
        normalizedHeading + 360,
      ];
      let closest = candidates[0];
      let smallestDistance = Math.abs(candidates[0] - current);

      for (let i = 1; i < candidates.length; i += 1) {
        const candidate = candidates[i];
        const distance = Math.abs(candidate - current);
        if (distance < smallestDistance) {
          smallestDistance = distance;
          closest = candidate;
        }
      }

      return closest;
    });
  }, [normalizedHeading]);

  return (
    <div className="directional-compass">
      <div className="directional-compass__visual">
        <span
          className="directional-compass__bearing-marker"
          style={{
            transform: `translate(-50%, -50%) rotate(${displayHeading}deg) translateY(-2.95rem)`,
          }}
          aria-hidden="true"
        />
        <img
          src={imageSrc}
          alt="Ship heading"
          className="directional-compass__ship"
          style={{ transform: `rotate(${displayHeading + 180}deg)` }}
        />
      </div>
      <div className="directional-compass__readout">
        <span className="small">{bearingLabel}</span>
        <strong>{normalizedHeading}°</strong>
      </div>
    </div>
  );
};

export default DirectionalCompass;
