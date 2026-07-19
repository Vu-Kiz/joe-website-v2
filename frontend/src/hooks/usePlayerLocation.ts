import { useEffect, useState } from "react";
import { getMyCharacterLocation, type CharacterLocation } from "../api/member/characterLocation";

export function usePlayerLocation(enabled: boolean) {
  const [location, setLocation] = useState<CharacterLocation | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let cancelled = false;
    getMyCharacterLocation()
      .then((res) => {
        if (!cancelled && res.ok && res.data) setLocation(res.data);
      })
      .catch(() => { if (!cancelled) setLocation(null); });
    return () => { cancelled = true; };
  }, [enabled]);

  return enabled ? location : null;
}
