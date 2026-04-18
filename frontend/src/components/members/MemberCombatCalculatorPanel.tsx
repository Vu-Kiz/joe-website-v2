import React, { useEffect, useMemo, useState } from "react";
import { getDebugCombatSettings } from "../../api/sysDebug";
import {
  getStoredShipType,
  getStoredShipTypes,
  getStoredWeaponType,
  type StoredShipTypeDetail,
  type StoredShipTypeSummary,
  type StoredWeaponTypeDetail,
} from "../../api/universe";
import "../../styles/main.sass";
import "../../styles/_admin.sass";
import "../../styles/_weaponheatmap.sass";

type HeatmapBoardMode = "auto" | "space" | "ground";
type GridPoint = { x: number; y: number };

type ShipHeatCell = {
  x: number;
  y: number;
  distance: number;
  combinedHitChance: number;
  averageRoundsToHit: number | null;
  likelyRoundsToHit: number | null;
  expectedDamage: number | null;
  weaponBreakdowns: Array<{
    key: string;
    name: string | null;
    quantity: number;
    arc: string | null;
    hitChance: number;
    averageRoundsToHit: number | null;
    expectedDamage: number | null;
    optimumRange: number | null;
    dropOff: number | null;
    actualTracking: number;
  }>;
};

type ResolvedShipWeapon = {
  key: string;
  uid: string | null;
  name: string | null;
  className: string | null;
  quantity: number;
  arc: string | null;
  actualTracking: number;
  weapon: StoredWeaponTypeDetail;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function formatNumber(value: number | null | undefined, digits = 2, fallback = "Unknown") {
  if (value == null || Number.isNaN(value)) {
    return fallback;
  }

  return Number(value)
    .toFixed(digits)
    .replace(/\.00$/, "")
    .replace(/(\.\d*[1-9])0+$/, "$1");
}

function roundsToFirstHit(hitChance: number, attacksPerRound: number) {
  const normalizedHitChance = clamp01(hitChance);
  const normalizedAttacks = Math.max(1, attacksPerRound);
  const roundHitChance = 1 - Math.pow(1 - normalizedHitChance, normalizedAttacks);

  if (roundHitChance <= 0) {
    return null;
  }

  return 1 / roundHitChance;
}

function roundsToLikelyHit(hitChance: number, attacksPerRound: number, targetConfidence = 0.9) {
  const normalizedHitChance = clamp01(hitChance);
  const normalizedAttacks = Math.max(1, attacksPerRound);
  const roundHitChance = 1 - Math.pow(1 - normalizedHitChance, normalizedAttacks);

  if (roundHitChance <= 0) {
    return null;
  }

  if (roundHitChance >= 1) {
    return 1;
  }

  return Math.log(1 - targetConfidence) / Math.log(1 - roundHitChance);
}

function averageDamage(weapon: StoredWeaponTypeDetail | null) {
  if (!weapon) {
    return null;
  }

  const min = weapon.min_damage;
  const max = weapon.max_damage;

  if (min == null && max == null) {
    return null;
  }

  if (min == null) {
    return max;
  }

  if (max == null) {
    return min;
  }

  return (min + max) / 2;
}

function applyArmorReduction(
  baseDamage: number,
  firepower: number | null | undefined,
  armor: number | null | undefined
) {
  const normalizedDamage = Math.max(0, Number(baseDamage ?? 0));
  const normalizedFirepower = Math.max(0, Number(firepower ?? 0));
  const normalizedArmor = Math.max(0, Number(armor ?? 0));

  if (normalizedDamage <= 0) {
    return 0;
  }

  if (normalizedFirepower <= 0) {
    return 0;
  }

  return normalizedDamage * (normalizedFirepower / (normalizedFirepower + normalizedArmor));
}

function resolveShipTargetDamageTypeModifier(
  damageType: string | null | undefined,
  modifiers: Record<string, number>
) {
  const normalized = (damageType ?? "").trim().toLowerCase();

  if (!normalized) {
    return 1;
  }

  return modifiers[normalized] ?? 1;
}

function resolveShipClassModifier(
  damageType: string | null | undefined,
  attackerClassName: string | null | undefined,
  defenderClassName: string | null | undefined,
  matrix: Record<string, Record<string, Record<string, number>>>
) {
  const damageTypeKey = (damageType ?? "").trim().toLowerCase();
  const attackerClassKey = (attackerClassName ?? "").trim().toLowerCase();
  const defenderClassKey = (defenderClassName ?? "").trim().toLowerCase();

  if (!damageTypeKey || !attackerClassKey || !defenderClassKey) {
    return 1;
  }

  return matrix[damageTypeKey]?.[attackerClassKey]?.[defenderClassKey] ?? 1;
}

function getBoardDimensions(maxRange: number, boardMode: HeatmapBoardMode) {
  const autoRadius = Math.max(4, Math.min(18, Math.ceil(maxRange)));
  const width = boardMode === "space" ? 20 : boardMode === "ground" ? 21 : autoRadius * 2 + 1;
  const height = boardMode === "space" ? 20 : boardMode === "ground" ? 21 : autoRadius * 2 + 1;
  const centerX = boardMode === "space" ? 9.5 : boardMode === "ground" ? 10 : autoRadius;
  const centerY = boardMode === "space" ? 9.5 : boardMode === "ground" ? 10 : autoRadius;

  return { width, height, centerX, centerY };
}

function defaultOriginForBoard(maxRange: number, boardMode: HeatmapBoardMode): GridPoint {
  const { centerX, centerY } = getBoardDimensions(maxRange, boardMode);
  return { x: Math.round(centerX), y: Math.round(centerY) };
}

function clampPointToBoard(point: GridPoint | null, maxRange: number, boardMode: HeatmapBoardMode): GridPoint {
  const { width, height } = getBoardDimensions(maxRange, boardMode);
  const fallback = defaultOriginForBoard(maxRange, boardMode);
  const nextPoint = point ?? fallback;

  return {
    x: Math.max(0, Math.min(width - 1, nextPoint.x)),
    y: Math.max(0, Math.min(height - 1, nextPoint.y)),
  };
}

function rangeHitChanceForWeapon(weapon: StoredWeaponTypeDetail, distance: number) {
  const optimum = Math.max(0, Number(weapon.optimum_range ?? 0));
  const dropOff = Math.max(0, Number(weapon.drop_off ?? 0));
  const maxRange = Math.max(optimum, optimum + dropOff);
  const deltaRange = Math.abs(optimum - distance);

  let hitChance = 0;

  if (maxRange === 0) {
    hitChance = 0;
  } else if (dropOff <= 0) {
    hitChance = deltaRange === 0 ? 1 : Math.max(0, 1 - 0.003 * deltaRange);
  } else {
    const logisticPenalty = 0.95 / (1 + Math.exp(-2 * (deltaRange - dropOff)));
    hitChance = (1 - logisticPenalty) - (0.003 * deltaRange);
  }

  return clamp01(hitChance);
}

function buildLinkedWeaponKey(item: Record<string, unknown>) {
  return [
    typeof item.uid === "string" ? item.uid : "",
    typeof item.name === "string" ? item.name : "",
    item.quantity == null ? "" : String(item.quantity),
    typeof item.arc === "string" ? item.arc : "",
  ].join("|");
}

function resolveLinkedWeaponIdentifier(item: Record<string, unknown>) {
  if (typeof item.uid === "string" && item.uid) {
    return item.uid;
  }

  if (typeof item.name === "string" && item.name) {
    return item.name;
  }

  return null;
}

function resolveQuantity(item: Record<string, unknown>) {
  const quantity = Number(item.quantity ?? 1);
  if (Number.isNaN(quantity) || quantity <= 0) {
    return 1;
  }
  return quantity;
}

function resolveActualTracking(baseTracking: number | null | undefined, combatSkill: number) {
  return Math.max(0, Number(baseTracking ?? 0) + (combatSkill / 2));
}

function resolveActualManeuverability(baseManeuverability: number, pilotingSkill: number) {
  const requiredPilotingSkill = Math.max(0, baseManeuverability - 5);
  return baseManeuverability + ((pilotingSkill - requiredPilotingSkill) / 2);
}

function resolveManeuverComparisonModifier(
  attackerManeuverability: number | null | undefined,
  defenderManeuverability: number | null | undefined
) {
  const attacker = Math.max(0, Number(attackerManeuverability ?? 0));
  const defender = Math.max(0, Number(defenderManeuverability ?? 0));
  const divisor = Math.max(attacker, defender);

  if (divisor <= 0) {
    return 1;
  }

  const deltaManeuver = attacker - defender;
  return Math.max(0, 1 + (deltaManeuver / divisor));
}

function resolveLengthModifier(attackerLength: number | null | undefined, defenderLength: number | null | undefined) {
  const attacker = Math.max(0, Number(attackerLength ?? 0));
  const defender = Math.max(0, Number(defenderLength ?? 0));

  if (attacker <= 0 || defender <= 0 || attacker === defender) {
    return 1;
  }

  const thresholds = [
    { ratio: 200, multiplier: { smaller: 3, larger: 0.55 } },
    { ratio: 150, multiplier: { smaller: 2, larger: 0.6 } },
    { ratio: 100, multiplier: { smaller: 1.5, larger: 0.65 } },
    { ratio: 75, multiplier: { smaller: 1.3, larger: 0.7 } },
    { ratio: 50, multiplier: { smaller: 1.25, larger: 0.75 } },
    { ratio: 25, multiplier: { smaller: 1.2, larger: 0.8 } },
    { ratio: 10, multiplier: { smaller: 1.15, larger: 0.85 } },
    { ratio: 5, multiplier: { smaller: 1.1, larger: 0.9 } },
    { ratio: 2, multiplier: { smaller: 1.05, larger: 0.95 } },
  ];

  if (attacker < defender) {
    const ratio = defender / attacker;
    const match = thresholds.find((entry) => ratio > entry.ratio);
    return match ? match.multiplier.smaller : 1;
  }

  const ratio = attacker / defender;
  const match = thresholds.find((entry) => ratio > entry.ratio);
  return match ? match.multiplier.larger : 1;
}

function buildShipHeatCells(
  resolvedWeapons: ResolvedShipWeapon[],
  boardMode: HeatmapBoardMode,
  origin: GridPoint | null,
  attackerLength: number | null | undefined,
  defenderLength: number | null | undefined,
  attackerManeuverability: number | null | undefined,
  defenderManeuverability: number | null | undefined,
  defenderArmor: number | null | undefined,
  shipDamageTypeModifiers: Record<string, number>,
  shipClassModifiers: Record<string, Record<string, Record<string, number>>>,
  attackerClassName: string | null | undefined,
  defenderClassName: string | null | undefined
): ShipHeatCell[] {
  if (!resolvedWeapons.length) {
    return [];
  }

  const maxRange = resolvedWeapons.reduce((highest, entry) => {
    const optimum = Math.max(0, Number(entry.weapon.optimum_range ?? 0));
    const dropOff = Math.max(0, Number(entry.weapon.drop_off ?? 0));
    return Math.max(highest, optimum + dropOff);
  }, 0);

  const { width, height, centerX, centerY } = getBoardDimensions(maxRange, boardMode);
  const originX = origin?.x ?? Math.round(centerX);
  const originY = origin?.y ?? Math.round(centerY);
  const lengthModifier = resolveLengthModifier(attackerLength, defenderLength);
  const maneuverComparisonModifier = resolveManeuverComparisonModifier(attackerManeuverability, defenderManeuverability);
  const cells: ShipHeatCell[] = [];

  for (let row = 0; row < height; row += 1) {
    for (let col = 0; col < width; col += 1) {
      const offsetX = col - originX;
      const offsetY = row - originY;
      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);

      let combinedMissChance = 1;
      let attacksPerRound = 0;
      let expectedDamage = 0;
      const weaponBreakdowns: ShipHeatCell["weaponBreakdowns"] = [];

      resolvedWeapons.forEach((entry) => {
        const perShotHitChance = clamp01(
          rangeHitChanceForWeapon(entry.weapon, distance) * lengthModifier * maneuverComparisonModifier
        );
        const perMountHits = entry.weapon.max_hits == null || Number.isNaN(Number(entry.weapon.max_hits))
          ? 1
          : Math.max(1, Number(entry.weapon.max_hits));
        const attackCount = entry.quantity * perMountHits;
        const avgDamage = averageDamage(entry.weapon) ?? 0;
        const mitigatedDamage = applyArmorReduction(avgDamage, entry.weapon.firepower, defenderArmor);
        const damageTypeModifier = resolveShipTargetDamageTypeModifier(entry.weapon.damage_type, shipDamageTypeModifiers);
        const shipClassModifier = resolveShipClassModifier(entry.weapon.damage_type, attackerClassName, defenderClassName, shipClassModifiers);
        const finalPerHitDamage = mitigatedDamage * damageTypeModifier * shipClassModifier;

        attacksPerRound += attackCount;
        combinedMissChance *= Math.pow(1 - perShotHitChance, attackCount);
        expectedDamage += finalPerHitDamage * attackCount * perShotHitChance;
        weaponBreakdowns.push({
          key: entry.key,
          name: entry.name ?? entry.uid ?? entry.weapon.name ?? entry.weapon.uid,
          quantity: entry.quantity,
          arc: entry.arc,
          hitChance: perShotHitChance,
          averageRoundsToHit: roundsToFirstHit(perShotHitChance, attackCount),
          expectedDamage: finalPerHitDamage * attackCount * perShotHitChance,
          optimumRange: entry.weapon.optimum_range,
          dropOff: entry.weapon.drop_off,
          actualTracking: entry.actualTracking,
        });
      });

      const combinedHitChance = clamp01(1 - combinedMissChance);

      cells.push({
        x: col,
        y: row,
        distance,
        combinedHitChance,
        averageRoundsToHit: roundsToFirstHit(combinedHitChance, 1),
        likelyRoundsToHit: roundsToLikelyHit(combinedHitChance, 1),
        expectedDamage: attacksPerRound > 0 ? expectedDamage : null,
        weaponBreakdowns,
      });
    }
  }

  return cells;
}

function roundDistanceBucket(distance: number) {
  return Math.max(0, Math.round(distance));
}

function summarizeDamageBand(value: number | null | undefined) {
  const normalized = Math.max(0, Number(value ?? 0));

  if (normalized >= 150) return "Crippling pressure";
  if (normalized >= 75) return "Heavy pressure";
  if (normalized >= 30) return "Solid pressure";
  if (normalized > 0) return "Light pressure";
  return "No practical pressure";
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(sortedValues: number[], value: number) {
  if (!sortedValues.length) {
    return null;
  }

  const index = Math.max(0, Math.min(sortedValues.length - 1, Math.ceil(sortedValues.length * value) - 1));
  return sortedValues[index] ?? null;
}

function isIonicDamageType(damageType: string | null | undefined) {
  return (damageType ?? "").toLowerCase().includes("ionic");
}

const MemberCombatCalculatorPanel: React.FC = () => {
  const [ships, setShips] = useState<StoredShipTypeSummary[]>([]);
  const [shipsLoading, setShipsLoading] = useState(true);
  const [shipsError, setShipsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedShipUid, setSelectedShipUid] = useState<string | null>(null);
  const [selectedShipDetail, setSelectedShipDetail] = useState<StoredShipTypeDetail | null>(null);
  const [targetShipUid, setTargetShipUid] = useState<string | null>(null);
  const [targetShipDetail, setTargetShipDetail] = useState<StoredShipTypeDetail | null>(null);
  const [shipDetailLoading, setShipDetailLoading] = useState(false);
  const [targetShipDetailLoading, setTargetShipDetailLoading] = useState(false);
  const [boardMode] = useState<HeatmapBoardMode>("space");
  const [combatSkill, setCombatSkill] = useState(5);
  const [attackerPilotingSkill, setAttackerPilotingSkill] = useState(5);
  const [targetPilotingSkill, setTargetPilotingSkill] = useState(5);
  const [engagementRange, setEngagementRange] = useState(0);
  const [scenarioRuns, setScenarioRuns] = useState(100);
  const [visibleSections, setVisibleSections] = useState<Record<string, boolean>>({
    setup: true,
    matchup: true,
    engagement: true,
    weapon: false,
    maneuver: false,
    ranges: false,
    scenarios: false,
  });
  const [expandedScenarioRuns, setExpandedScenarioRuns] = useState<Record<number, boolean>>({});
  const [scenarioPage, setScenarioPage] = useState(1);
  const [resolvedWeapons, setResolvedWeapons] = useState<ResolvedShipWeapon[]>([]);
  const [resolvedWeaponsLoading, setResolvedWeaponsLoading] = useState(false);
  const [targetResolvedWeapons, setTargetResolvedWeapons] = useState<ResolvedShipWeapon[]>([]);
  const [targetResolvedWeaponsLoading, setTargetResolvedWeaponsLoading] = useState(false);
  const [focusedWeaponKey, setFocusedWeaponKey] = useState<string | null>(null);
  const [shipDamageTypeModifiers, setShipDamageTypeModifiers] = useState<Record<string, number>>({});
  const [shipClassModifiers, setShipClassModifiers] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const scenarioPageSize = 25;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setShipsLoading(true);
        const response = await getStoredShipTypes();

        if (cancelled) return;

        const nextShips = Array.isArray(response.data) ? response.data : [];
        setShips(nextShips);
        setShipsError(null);
        setSelectedShipUid((current) => current ?? nextShips[0]?.uid ?? null);
        setTargetShipUid((current) => current ?? nextShips[1]?.uid ?? nextShips[0]?.uid ?? null);
      } catch (error: any) {
        if (!cancelled) {
          setShips([]);
          setShipsError(error?.message ?? "Failed to load stored ship types.");
        }
      } finally {
        if (!cancelled) {
          setShipsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await getDebugCombatSettings();

        if (cancelled) return;

        setShipDamageTypeModifiers(response.data?.ship_damage_type_modifiers ?? {});
        setShipClassModifiers(response.data?.ship_class_modifiers ?? {});
      } catch {
        if (!cancelled) {
          setShipDamageTypeModifiers({});
          setShipClassModifiers({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredShips = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return ships;
    }

    return ships.filter((ship) =>
      [ship.name ?? "", ship.class_name ?? "", ship.uid ?? ""].some((value) =>
        value.toLowerCase().includes(normalized)
      )
    );
  }, [ships, query]);

  useEffect(() => {
    if (!filteredShips.length) {
      setSelectedShipUid(null);
      return;
    }

    const stillVisible = filteredShips.some((ship) => ship.uid === selectedShipUid);
    if (!stillVisible) {
      setSelectedShipUid(filteredShips[0]?.uid ?? null);
    }
  }, [filteredShips, selectedShipUid]);

  useEffect(() => {
    if (!selectedShipUid) {
      setSelectedShipDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setShipDetailLoading(true);
        const response = await getStoredShipType(selectedShipUid);

        if (cancelled) return;

        setSelectedShipDetail(response.data ?? null);
      } catch (error: any) {
        if (!cancelled) {
          setSelectedShipDetail(null);
          setShipsError(error?.message ?? "Failed to load ship detail.");
        }
      } finally {
        if (!cancelled) {
          setShipDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedShipUid]);

  useEffect(() => {
    if (!targetShipUid) {
      setTargetShipDetail(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setTargetShipDetailLoading(true);
        const response = await getStoredShipType(targetShipUid);

        if (cancelled) return;

        setTargetShipDetail(response.data ?? null);
      } catch (error: any) {
        if (!cancelled) {
          setTargetShipDetail(null);
          setShipsError(error?.message ?? "Failed to load target ship detail.");
        }
      } finally {
        if (!cancelled) {
          setTargetShipDetailLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetShipUid]);

  useEffect(() => {
    const linkedWeapons = Array.isArray(selectedShipDetail?.weapons)
      ? selectedShipDetail.weapons.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      : [];

    if (!linkedWeapons.length) {
      setResolvedWeapons([]);
      setResolvedWeaponsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setResolvedWeaponsLoading(true);
        const nextWeapons: Array<ResolvedShipWeapon | null> = await Promise.all(
          linkedWeapons.map(async (item) => {
            const identifier = resolveLinkedWeaponIdentifier(item);
            if (!identifier) {
              return null;
            }

            const response = await getStoredWeaponType(identifier);
            const weapon = response.data ?? null;
            if (!weapon) {
              return null;
            }

            return {
              key: buildLinkedWeaponKey(item),
              uid: (typeof item.uid === "string" ? item.uid : (weapon.uid ?? null)) as string | null,
              name: typeof item.name === "string" ? item.name : weapon.name ?? null,
              className: weapon.class_name ?? null,
              quantity: resolveQuantity(item),
              arc: typeof item.arc === "string" ? item.arc : null,
              actualTracking: resolveActualTracking(weapon.tracking, combatSkill),
              weapon,
            } satisfies ResolvedShipWeapon;
          })
        );

        if (cancelled) return;

        setResolvedWeapons(nextWeapons.filter((item): item is ResolvedShipWeapon => !!item));
      } catch {
        if (!cancelled) {
          setResolvedWeapons([]);
        }
      } finally {
        if (!cancelled) {
          setResolvedWeaponsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedShipDetail, combatSkill]);

  useEffect(() => {
    const linkedWeapons = Array.isArray(targetShipDetail?.weapons)
      ? targetShipDetail.weapons.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
      : [];

    if (!linkedWeapons.length) {
      setTargetResolvedWeapons([]);
      setTargetResolvedWeaponsLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        setTargetResolvedWeaponsLoading(true);
        const nextWeapons: Array<ResolvedShipWeapon | null> = await Promise.all(
          linkedWeapons.map(async (item) => {
            const identifier = resolveLinkedWeaponIdentifier(item);
            if (!identifier) {
              return null;
            }

            const response = await getStoredWeaponType(identifier);
            const weapon = response.data ?? null;
            if (!weapon) {
              return null;
            }

            return {
              key: buildLinkedWeaponKey(item),
              uid: (typeof item.uid === "string" ? item.uid : (weapon.uid ?? null)) as string | null,
              name: typeof item.name === "string" ? item.name : weapon.name ?? null,
              className: weapon.class_name ?? null,
              quantity: resolveQuantity(item),
              arc: typeof item.arc === "string" ? item.arc : null,
              actualTracking: resolveActualTracking(weapon.tracking, combatSkill),
              weapon,
            } satisfies ResolvedShipWeapon;
          })
        );

        if (cancelled) return;

        setTargetResolvedWeapons(nextWeapons.filter((item): item is ResolvedShipWeapon => !!item));
      } catch {
        if (!cancelled) {
          setTargetResolvedWeapons([]);
        }
      } finally {
        if (!cancelled) {
          setTargetResolvedWeaponsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetShipDetail, combatSkill]);

  useEffect(() => {
    if (!resolvedWeapons.length) {
      setFocusedWeaponKey(null);
      return;
    }

    if (!focusedWeaponKey) {
      setFocusedWeaponKey(resolvedWeapons[0]?.key ?? null);
      return;
    }

    const stillExists = resolvedWeapons.some((entry) => entry.key === focusedWeaponKey);
    if (!stillExists) {
      setFocusedWeaponKey(resolvedWeapons[0]?.key ?? null);
    }
  }, [resolvedWeapons, focusedWeaponKey]);

  const selectedShip = useMemo(
    () => filteredShips.find((ship) => ship.uid === selectedShipUid) ?? null,
    [filteredShips, selectedShipUid]
  );
  const focusedWeapon = useMemo(
    () => resolvedWeapons.find((entry) => entry.key === focusedWeaponKey) ?? resolvedWeapons[0] ?? null,
    [resolvedWeapons, focusedWeaponKey]
  );
  const selectedMaxRange = useMemo(() => {
    return resolvedWeapons.reduce((highest, entry) => {
      const optimum = Math.max(0, Number(entry.weapon.optimum_range ?? 0));
      const dropOff = Math.max(0, Number(entry.weapon.drop_off ?? 0));
      return Math.max(highest, optimum + dropOff);
    }, 0);
  }, [resolvedWeapons]);
  const defaultOrigin = useMemo(
    () => defaultOriginForBoard(selectedMaxRange, boardMode),
    [selectedMaxRange, boardMode]
  );
  const actualTargetManeuverability = useMemo(() => {
    const baseManeuverability = Math.max(0, Number(targetShipDetail?.manoeuvrability ?? 0));
    return resolveActualManeuverability(baseManeuverability, targetPilotingSkill);
  }, [targetShipDetail, targetPilotingSkill]);
  const actualAttackerManeuverability = useMemo(() => {
    const baseManeuverability = Math.max(0, Number(selectedShipDetail?.manoeuvrability ?? 0));
    return resolveActualManeuverability(baseManeuverability, attackerPilotingSkill);
  }, [selectedShipDetail, attackerPilotingSkill]);
  const lengthModifier = useMemo(
    () => resolveLengthModifier(selectedShipDetail?.length, targetShipDetail?.length),
    [selectedShipDetail, targetShipDetail]
  );
  const maneuverComparisonModifier = useMemo(
    () => resolveManeuverComparisonModifier(actualAttackerManeuverability, actualTargetManeuverability),
    [actualAttackerManeuverability, actualTargetManeuverability]
  );
  const focusedDamageTypeModifier = useMemo(
    () => resolveShipTargetDamageTypeModifier(focusedWeapon?.weapon.damage_type, shipDamageTypeModifiers),
    [focusedWeapon, shipDamageTypeModifiers]
  );
  const focusedShipClassModifier = useMemo(
    () => resolveShipClassModifier(
      focusedWeapon?.weapon.damage_type,
      selectedShipDetail?.class_name,
      targetShipDetail?.class_name,
      shipClassModifiers
    ),
    [focusedWeapon, selectedShipDetail, targetShipDetail, shipClassModifiers]
  );
  const totalAttackCount = useMemo(
    () =>
      resolvedWeapons.reduce((sum, entry) => {
        const maxHits = entry.weapon.max_hits == null || Number.isNaN(Number(entry.weapon.max_hits))
          ? 1
          : Math.max(1, Number(entry.weapon.max_hits));
        return sum + (entry.quantity * maxHits);
      }, 0),
    [resolvedWeapons]
  );

  const selectedOrigin = useMemo(
    () => clampPointToBoard(defaultOrigin, selectedMaxRange, boardMode),
    [defaultOrigin, selectedMaxRange, boardMode]
  );
  useEffect(() => {
    setEngagementRange((current) => {
      const nextMax = Math.max(0, Math.round(selectedMaxRange));
      return Math.max(0, Math.min(nextMax, current));
    });
  }, [selectedMaxRange]);

  const heatCells = useMemo(
    () => buildShipHeatCells(
      resolvedWeapons,
      boardMode,
      selectedOrigin,
      selectedShipDetail?.length,
      targetShipDetail?.length,
      actualAttackerManeuverability,
      actualTargetManeuverability,
      targetShipDetail?.armour,
      shipDamageTypeModifiers,
      shipClassModifiers,
      selectedShipDetail?.class_name,
      targetShipDetail?.class_name
    ),
    [resolvedWeapons, boardMode, selectedOrigin, selectedShipDetail, targetShipDetail, actualAttackerManeuverability, actualTargetManeuverability, shipDamageTypeModifiers, shipClassModifiers]
  );
  const rangeRecommendations = useMemo(() => {
    const byBucket = new Map<number, { totalDamage: number; totalHitChance: number; totalAverageRounds: number; totalLikelyRounds: number; count: number }>();

    heatCells.forEach((cell) => {
      const bucket = roundDistanceBucket(cell.distance);
      const current = byBucket.get(bucket) ?? { totalDamage: 0, totalHitChance: 0, totalAverageRounds: 0, totalLikelyRounds: 0, count: 0 };

      current.totalDamage += cell.expectedDamage ?? 0;
      current.totalHitChance += cell.combinedHitChance;
      current.totalAverageRounds += cell.averageRoundsToHit ?? 0;
      current.totalLikelyRounds += cell.likelyRoundsToHit ?? 0;
      current.count += 1;
      byBucket.set(bucket, current);
    });

    const ranked = Array.from(byBucket.entries())
      .map(([range, stats]) => ({
        range,
        averageDamage: stats.count > 0 ? stats.totalDamage / stats.count : 0,
        averageHitChance: stats.count > 0 ? stats.totalHitChance / stats.count : 0,
        averageRoundsToHit: stats.count > 0 ? stats.totalAverageRounds / stats.count : null,
        likelyRoundsToHit: stats.count > 0 ? stats.totalLikelyRounds / stats.count : null,
      }))
      .sort((left, right) => {
        if (right.averageDamage !== left.averageDamage) {
          return right.averageDamage - left.averageDamage;
        }

        if (right.averageHitChance !== left.averageHitChance) {
          return right.averageHitChance - left.averageHitChance;
        }

        return left.range - right.range;
      });

    return {
      bestOverall: ranked[0] ?? null,
      topRanges: ranked.slice(0, 3),
      byRange: ranked,
    };
  }, [heatCells]);
  const currentTargetSummary = useMemo(() => {
    const match = rangeRecommendations.byRange.find((entry) => entry.range === Math.round(engagementRange));

    if (!match) {
      return null;
    }

    return {
      range: match.range,
      hitChance: match.averageHitChance,
      averageRoundsToHit: match.averageRoundsToHit,
      likelyRoundsToHit: match.likelyRoundsToHit,
      expectedDamage: match.averageDamage,
      damageBand: summarizeDamageBand(match.averageDamage),
    };
  }, [engagementRange, rangeRecommendations.byRange]);
  const focusedWeaponAverageDamage = useMemo(
    () => averageDamage(focusedWeapon?.weapon ?? null),
    [focusedWeapon]
  );
  const recommendationDelta = useMemo(() => {
    if (!rangeRecommendations.bestOverall || !currentTargetSummary) {
      return null;
    }

    return rangeRecommendations.bestOverall.averageDamage - (currentTargetSummary.expectedDamage ?? 0);
  }, [rangeRecommendations.bestOverall, currentTargetSummary]);
  const currentScenarioProjection = useMemo(() => {
    if (!currentTargetSummary || !resolvedWeapons.length || !targetShipDetail || !selectedShipDetail) {
      return null;
    }

    const runs = Math.max(1, Math.min(9999, Math.floor(scenarioRuns || 1)));
    const maxCombatCycles = 9999;
    const attackerInitialShield = Math.max(0, Number(selectedShipDetail.shield ?? 0));
    const attackerInitialHull = Math.max(0, Number(selectedShipDetail.hull ?? 0));
    const attackerInitialIonic = Math.max(0, Number(selectedShipDetail.ionic_capacity ?? 0));
    const targetInitialShield = Math.max(0, Number(targetShipDetail.shield ?? 0));
    const targetInitialHull = Math.max(0, Number(targetShipDetail.hull ?? 0));
    const targetInitialIonic = Math.max(0, Number(targetShipDetail.ionic_capacity ?? 0));
    const attackerArmor = Math.max(0, Number(selectedShipDetail.armour ?? 0));
    const targetArmor = Math.max(0, Number(targetShipDetail.armour ?? 0));
    const attackerKillRounds: number[] = [];
    const defenderKillRounds: number[] = [];
    let attackerWinCount = 0;
    let defenderWinCount = 0;
    let mutualKillCount = 0;
    let stalemateCount = 0;
    let damageToDefenderTotal = 0;
    let damageToAttackerTotal = 0;
    let remainingAttackerShieldTotal = 0;
    let remainingAttackerHullTotal = 0;
    let remainingAttackerIonicTotal = 0;
    let remainingDefenderShieldTotal = 0;
    let remainingDefenderHullTotal = 0;
    let remainingDefenderIonicTotal = 0;
    const outcomeRounds = new Map<number, number>();
    const attackerKillRoundsMap = new Map<number, number>();
    const defenderKillRoundsMap = new Map<number, number>();
    const sampleRuns: Array<{
      run: number;
      seed: number;
      attackerDestroyedAtRound: number | null;
      defenderDestroyedAtRound: number | null;
      winner: "attacker" | "defender" | "mutual" | "stalemate";
      damageToDefender: number;
      damageToAttacker: number;
      attackerRemainingShield: number;
      attackerRemainingHull: number;
      attackerRemainingIonic: number;
      defenderRemainingShield: number;
      defenderRemainingHull: number;
      defenderRemainingIonic: number;
    }> = [];

    const applyVolley = (
      seededRandom: () => number,
      weaponEntries: ResolvedShipWeapon[],
      range: number,
      attackingClassName: string | null | undefined,
      defendingClassName: string | null | undefined,
      lengthMod: number,
      maneuverMod: number,
      defenderArmorValue: number,
      state: { shield: number; hull: number; ionic: number }
    ) => {
      for (const weaponEntry of weaponEntries) {
        const maxHits = weaponEntry.weapon.max_hits == null || Number.isNaN(Number(weaponEntry.weapon.max_hits))
          ? 1
          : Math.max(1, Number(weaponEntry.weapon.max_hits));
        const attacksPerCycle = Math.max(1, weaponEntry.quantity * maxHits);
        const baseHitChance = clamp01(
          rangeHitChanceForWeapon(weaponEntry.weapon, range) * lengthMod * maneuverMod
        );
        const damageTypeModifier = resolveShipTargetDamageTypeModifier(weaponEntry.weapon.damage_type, shipDamageTypeModifiers);
        const shipClassModifier = resolveShipClassModifier(
          weaponEntry.weapon.damage_type,
          attackingClassName,
          defendingClassName,
          shipClassModifiers
        );
        const minDamage = Math.max(0, Number(weaponEntry.weapon.min_damage ?? weaponEntry.weapon.max_damage ?? 0));
        const maxDamage = Math.max(minDamage, Number(weaponEntry.weapon.max_damage ?? weaponEntry.weapon.min_damage ?? 0));
        const isIonic = isIonicDamageType(weaponEntry.weapon.damage_type);

        for (let attack = 0; attack < attacksPerCycle; attack += 1) {
          if (seededRandom() > baseHitChance) {
            continue;
          }

          const baseDamage = minDamage + ((maxDamage - minDamage) * seededRandom());
          const reducedDamage = applyArmorReduction(baseDamage, weaponEntry.weapon.firepower, defenderArmorValue);
          let damage = reducedDamage * damageTypeModifier * shipClassModifier;

          if (damage <= 0) {
            continue;
          }

          if (isIonic) {
            state.ionic = Math.max(0, state.ionic - damage);
            continue;
          }

          if (state.shield > 0) {
            const shieldDamage = Math.min(state.shield, damage);
            state.shield -= shieldDamage;
            damage -= shieldDamage;
          }

          if (damage > 0) {
            state.hull = Math.max(0, state.hull - damage);
          }

        }
      }
    };

    for (let run = 0; run < runs; run += 1) {
      const seed = hashString([
        selectedShipDetail.uid ?? "",
        targetShipDetail.uid ?? "",
        ...resolvedWeapons.map((weapon) => weapon.key),
        ...targetResolvedWeapons.map((weapon) => weapon.key),
        currentTargetSummary.range,
        run,
        totalAttackCount,
      ].join("|"));
      const attackerState = {
        shield: attackerInitialShield,
        hull: attackerInitialHull,
        ionic: attackerInitialIonic,
      };
      const defenderState = {
        shield: targetInitialShield,
        hull: targetInitialHull,
        ionic: targetInitialIonic,
      };
      let attackerDestroyedAtRound: number | null = null;
      let defenderDestroyedAtRound: number | null = null;

      for (let round = 1; round <= maxCombatCycles; round += 1) {
        const roundRandom = createSeededRandom(
          hashString([
            seed,
            round,
            currentTargetSummary.range,
            attackerState.shield,
            attackerState.hull,
            attackerState.ionic,
            defenderState.shield,
            defenderState.hull,
            defenderState.ionic,
          ].join("|"))
        );

        applyVolley(
          roundRandom,
          resolvedWeapons,
          currentTargetSummary.range,
          selectedShipDetail.class_name,
          targetShipDetail.class_name,
          lengthModifier,
          maneuverComparisonModifier,
          targetArmor,
          defenderState
        );
        if (defenderState.hull <= 0) {
          defenderDestroyedAtRound = round;
        }

        if (targetResolvedWeapons.length) {
          const defenderLengthModifier = resolveLengthModifier(targetShipDetail.length, selectedShipDetail.length);
          const defenderManeuverModifier = resolveManeuverComparisonModifier(actualTargetManeuverability, actualAttackerManeuverability);
          applyVolley(
            roundRandom,
            targetResolvedWeapons,
            currentTargetSummary.range,
            targetShipDetail.class_name,
            selectedShipDetail.class_name,
            defenderLengthModifier,
            defenderManeuverModifier,
            attackerArmor,
            attackerState
          );
          if (attackerState.hull <= 0) {
            attackerDestroyedAtRound = round;
          }
        }

        if (attackerDestroyedAtRound != null || defenderDestroyedAtRound != null) {
          break;
        }
      }

      if (defenderDestroyedAtRound != null) {
        defenderKillRounds.push(defenderDestroyedAtRound);
        defenderKillRoundsMap.set(defenderDestroyedAtRound, (defenderKillRoundsMap.get(defenderDestroyedAtRound) ?? 0) + 1);
      }
      if (attackerDestroyedAtRound != null) {
        attackerKillRounds.push(attackerDestroyedAtRound);
        attackerKillRoundsMap.set(attackerDestroyedAtRound, (attackerKillRoundsMap.get(attackerDestroyedAtRound) ?? 0) + 1);
      }

      let winner: "attacker" | "defender" | "mutual" | "stalemate" = "stalemate";
      if (attackerDestroyedAtRound != null && defenderDestroyedAtRound != null) {
        mutualKillCount += 1;
        winner = "mutual";
        const decisiveRound = Math.max(attackerDestroyedAtRound, defenderDestroyedAtRound);
        outcomeRounds.set(decisiveRound, (outcomeRounds.get(decisiveRound) ?? 0) + 1);
      } else if (defenderDestroyedAtRound != null) {
        attackerWinCount += 1;
        winner = "attacker";
        outcomeRounds.set(defenderDestroyedAtRound, (outcomeRounds.get(defenderDestroyedAtRound) ?? 0) + 1);
      } else if (attackerDestroyedAtRound != null) {
        defenderWinCount += 1;
        winner = "defender";
        outcomeRounds.set(attackerDestroyedAtRound, (outcomeRounds.get(attackerDestroyedAtRound) ?? 0) + 1);
      } else {
        stalemateCount += 1;
      }

      damageToDefenderTotal += (targetInitialShield - defenderState.shield) + (targetInitialHull - defenderState.hull) + (targetInitialIonic - defenderState.ionic);
      damageToAttackerTotal += (attackerInitialShield - attackerState.shield) + (attackerInitialHull - attackerState.hull) + (attackerInitialIonic - attackerState.ionic);
      remainingDefenderShieldTotal += defenderState.shield;
      remainingDefenderHullTotal += defenderState.hull;
      remainingDefenderIonicTotal += defenderState.ionic;
      remainingAttackerShieldTotal += attackerState.shield;
      remainingAttackerHullTotal += attackerState.hull;
      remainingAttackerIonicTotal += attackerState.ionic;

      if (sampleRuns.length < runs) {
        sampleRuns.push({
          run: run + 1,
          seed,
          attackerDestroyedAtRound,
          defenderDestroyedAtRound,
          winner,
          damageToDefender: (targetInitialShield - defenderState.shield) + (targetInitialHull - defenderState.hull) + (targetInitialIonic - defenderState.ionic),
          damageToAttacker: (attackerInitialShield - attackerState.shield) + (attackerInitialHull - attackerState.hull) + (attackerInitialIonic - attackerState.ionic),
          attackerRemainingShield: attackerState.shield,
          attackerRemainingHull: attackerState.hull,
          attackerRemainingIonic: attackerState.ionic,
          defenderRemainingShield: defenderState.shield,
          defenderRemainingHull: defenderState.hull,
          defenderRemainingIonic: defenderState.ionic,
        });
      }
    }

    const sortedDefenderKillRounds = [...defenderKillRounds].sort((left, right) => left - right);
    const sortedAttackerKillRounds = [...attackerKillRounds].sort((left, right) => left - right);
    const defenderKillRate = runs > 0 ? (defenderKillRounds.length / runs) : 0;
    const attackerKillRate = runs > 0 ? (attackerKillRounds.length / runs) : 0;
    const averageRoundsToKillDefender = defenderKillRounds.length
      ? defenderKillRounds.reduce((sum, value) => sum + value, 0) / defenderKillRounds.length
      : null;
    const averageRoundsToKillAttacker = attackerKillRounds.length
      ? attackerKillRounds.reduce((sum, value) => sum + value, 0) / attackerKillRounds.length
      : null;
    const outcomeRoundBreakdown = Array.from(outcomeRounds.entries())
      .map(([round, count]) => ({ round, count, percent: runs > 0 ? (count / runs) : 0 }))
      .sort((left, right) => left.round - right.round);
    const defenderRoundBreakdown = Array.from(defenderKillRoundsMap.entries())
      .map(([round, count]) => ({ round, count, percent: runs > 0 ? (count / runs) : 0 }))
      .sort((left, right) => left.round - right.round);
    const attackerRoundBreakdown = Array.from(attackerKillRoundsMap.entries())
      .map(([round, count]) => ({ round, count, percent: runs > 0 ? (count / runs) : 0 }))
      .sort((left, right) => left.round - right.round);

    return {
      runs,
      maxCombatCycles,
      attackerWinRate: runs > 0 ? attackerWinCount / runs : 0,
      defenderWinRate: runs > 0 ? defenderWinCount / runs : 0,
      mutualKillRate: runs > 0 ? mutualKillCount / runs : 0,
      stalemateRate: runs > 0 ? stalemateCount / runs : 0,
      defenderKillRate,
      attackerKillRate,
      averageRoundsToKillDefender,
      averageRoundsToKillAttacker,
      likelyRoundsToKillDefender: percentile(sortedDefenderKillRounds, 0.9),
      likelyRoundsToKillAttacker: percentile(sortedAttackerKillRounds, 0.9),
      averageDamageToDefender: runs > 0 ? damageToDefenderTotal / runs : null,
      averageDamageToAttacker: runs > 0 ? damageToAttackerTotal / runs : null,
      averageRemainingDefenderShield: runs > 0 ? remainingDefenderShieldTotal / runs : null,
      averageRemainingDefenderHull: runs > 0 ? remainingDefenderHullTotal / runs : null,
      averageRemainingDefenderIonic: runs > 0 ? remainingDefenderIonicTotal / runs : null,
      averageRemainingAttackerShield: runs > 0 ? remainingAttackerShieldTotal / runs : null,
      averageRemainingAttackerHull: runs > 0 ? remainingAttackerHullTotal / runs : null,
      averageRemainingAttackerIonic: runs > 0 ? remainingAttackerIonicTotal / runs : null,
      outcomeRoundBreakdown,
      defenderRoundBreakdown,
      attackerRoundBreakdown,
      sampleRuns,
    };
  }, [
    currentTargetSummary,
    resolvedWeapons,
    targetResolvedWeapons,
    targetShipDetail,
    selectedShipDetail,
    scenarioRuns,
    lengthModifier,
    maneuverComparisonModifier,
    shipDamageTypeModifiers,
    shipClassModifiers,
    totalAttackCount,
    actualTargetManeuverability,
    actualAttackerManeuverability,
  ]);

  const toggleSection = (key: string) => {
    setVisibleSections((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const toggleScenarioRun = (run: number) => {
    setExpandedScenarioRuns((current) => ({
      ...current,
      [run]: !current[run],
    }));
  };

  useEffect(() => {
    setScenarioPage(1);
    setExpandedScenarioRuns({});
  }, [selectedShipUid, targetShipUid, engagementRange, scenarioRuns]);

  const scenarioPageCount = useMemo(() => {
    const total = currentScenarioProjection?.sampleRuns?.length ?? 0;
    return Math.max(1, Math.ceil(total / scenarioPageSize));
  }, [currentScenarioProjection, scenarioPageSize]);

  const pagedScenarioRuns = useMemo(() => {
    const allRuns = currentScenarioProjection?.sampleRuns ?? [];
    const start = (scenarioPage - 1) * scenarioPageSize;
    return allRuns.slice(start, start + scenarioPageSize);
  }, [currentScenarioProjection, scenarioPage, scenarioPageSize]);

  return (
    <div className="members-combat-calc">
      <section className="panel admin-panel members-combat-calc__hero">
        <div className="admin-panel__header members-combat-calc__hero-head">
          <div>
            <h2>Combat Calculator</h2>
            <p className="small">
              Sysadmin-only combat brief for working out where a ship should fight, how hard it should hit, and how quickly it is likely to connect before we turn this into the full fleet tool.
            </p>
          </div>
          <div className="members-combat-calc__hero-badges">
            <span className="members-combat-calc__badge">Ship vs Ship</span>
            <span className="members-combat-calc__badge">Range Math Live</span>
            <span className="members-combat-calc__badge">Combat Tables Active</span>
          </div>
        </div>
        {visibleSections.engagement ? (
          <div className="admin-panel__body members-combat-calc__headline-grid">
            <article className="members-combat-calc__headline-card">
              <span className="small">Best Holding Range</span>
              <strong>{rangeRecommendations.bestOverall ? `${formatNumber(rangeRecommendations.bestOverall.range, 0)}` : "Unknown"}</strong>
              <span className="small">Best sustained average damage band</span>
            </article>
            <article className="members-combat-calc__headline-card">
              <span className="small">Damage At Best Range</span>
              <strong>{rangeRecommendations.bestOverall ? formatNumber(rangeRecommendations.bestOverall.averageDamage, 1) : "Unknown"}</strong>
              <span className="small">{rangeRecommendations.bestOverall ? `${formatNumber(rangeRecommendations.bestOverall.averageHitChance * 100, 0)}% average hit chance` : "Awaiting profile"}</span>
            </article>
            <article className="members-combat-calc__headline-card">
              <span className="small">Current Range Outlook</span>
              <strong>{currentTargetSummary?.damageBand ?? "Unknown"}</strong>
              <span className="small">{recommendationDelta == null ? "Awaiting target profile" : `${recommendationDelta >= 0 ? "+" : ""}${formatNumber(recommendationDelta, 1)} damage swing to best range`}</span>
            </article>
          </div>
        ) : null}
      </section>

      <div className="members-combat-calc__layout">
        <section className="panel admin-panel members-combat-calc__sidebar">
          <div className="admin-panel__header">
            <h3>Combat Setup</h3>
          </div>
          <div className="admin-panel__body members-combat-calc__sidebar-body">
            <div className="members-combat-calc__section-pills">
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.setup ? " is-active" : ""}`} onClick={() => toggleSection("setup")}>Setup</button>
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.matchup ? " is-active" : ""}`} onClick={() => toggleSection("matchup")}>Matchup</button>
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.engagement ? " is-active" : ""}`} onClick={() => toggleSection("engagement")}>Engagement</button>
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.weapon ? " is-active" : ""}`} onClick={() => toggleSection("weapon")}>Weapon</button>
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.maneuver ? " is-active" : ""}`} onClick={() => toggleSection("maneuver")}>Maneuver</button>
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.ranges ? " is-active" : ""}`} onClick={() => toggleSection("ranges")}>Ranges</button>
              <button type="button" className={`members-combat-calc__section-pill${visibleSections.scenarios ? " is-active" : ""}`} onClick={() => toggleSection("scenarios")}>Scenarios</button>
            </div>

            {visibleSections.setup ? (
            <div className="members-combat-calc__field-group">
              <h4>Attacker Search</h4>

              <label className="small" htmlFor="ship-heatmap-query">
                Search
              </label>
              <input
                id="ship-heatmap-query"
                className="admin-input"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, class, or UID"
              />
            </div>
            ) : null}

            {visibleSections.setup ? (
            <div className="members-combat-calc__field-group">
              <h4>Combat Inputs</h4>
              <label className="small" htmlFor="ship-heatmap-combat-skill">Combat Skill</label>
              <input id="ship-heatmap-combat-skill" className="admin-input" type="number" min={0} max={10} step={1} value={combatSkill} onChange={(event) => setCombatSkill(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
              <label className="small" htmlFor="ship-heatmap-attacker-piloting-skill">Attacker Piloting Skill</label>
              <input id="ship-heatmap-attacker-piloting-skill" className="admin-input" type="number" min={0} max={10} step={1} value={attackerPilotingSkill} onChange={(event) => setAttackerPilotingSkill(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
              <label className="small" htmlFor="ship-heatmap-target-ship">Target Ship</label>
              <select
                id="ship-heatmap-target-ship"
                className="admin-input"
                value={targetShipUid ?? ""}
                onChange={(event) => setTargetShipUid(event.target.value || null)}
              >
                {ships.map((ship) => (
                  <option key={ship.uid} value={ship.uid}>
                    {ship.name ?? ship.uid}
                  </option>
                ))}
              </select>
              <label className="small" htmlFor="ship-heatmap-piloting-skill">Target Piloting Skill</label>
              <input id="ship-heatmap-piloting-skill" className="admin-input" type="number" min={0} max={10} step={1} value={targetPilotingSkill} onChange={(event) => setTargetPilotingSkill(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
              <label className="small" htmlFor="ship-heatmap-range">Current Engagement Range</label>
              <input
                id="ship-heatmap-range"
                className="admin-input"
                type="number"
                min={0}
                max={Math.max(0, Math.round(selectedMaxRange))}
                step={1}
                value={engagementRange}
                onChange={(event) =>
                  setEngagementRange(
                    Math.max(0, Math.min(Math.max(0, Math.round(selectedMaxRange)), Number(event.target.value) || 0))
                  )
                }
              />
              <label className="small" htmlFor="ship-heatmap-rounds">Scenario Runs</label>
              <input
                id="ship-heatmap-rounds"
                className="admin-input"
                type="number"
                min={1}
                max={9999}
                step={1}
                value={scenarioRuns}
                onChange={(event) =>
                  setScenarioRuns(
                    Math.max(1, Math.min(9999, Math.floor(Number(event.target.value) || 1)))
                  )
                }
              />
            </div>
            ) : null}

            {shipsLoading ? <p className="small">Loading stored ships…</p> : null}
            {shipsError ? <p className="small">{shipsError}</p> : null}

            {visibleSections.setup ? (
            <div className="members-combat-calc__field-group">
              <h4>Attacker Ship</h4>
              <div className="weapon-heatmap-page__weapon-list">
                {filteredShips.map((ship) => (
                  <button
                    key={ship.uid}
                    type="button"
                    className={`weapon-heatmap-page__weapon-button${selectedShipUid === ship.uid ? " is-active" : ""}`}
                    onClick={() => setSelectedShipUid(ship.uid)}
                  >
                    <strong>{ship.name ?? ship.uid}</strong>
                    <span className="small">{ship.class_name ?? "Unknown class"}</span>
                  </button>
                ))}
              </div>
            </div>
            ) : null}
          </div>
        </section>

        <section className="members-combat-calc__main">
          {selectedShip ? (
            <>
              <section className="panel admin-panel members-combat-calc__focus">
                <div className="admin-panel__header members-combat-calc__focus-head">
                  <div>
                    <h3>{selectedShip.name ?? selectedShip.uid}</h3>
                    <p className="small">{selectedShip.class_name ?? "Unknown class"}</p>
                  </div>
                  <div className="members-combat-calc__focus-vs">
                    <span className="small">Against</span>
                    <strong>{targetShipDetail?.name ?? targetShipUid ?? "Unknown target"}</strong>
                  </div>
                </div>
              </section>

              <div className="weapon-heatmap-page__stats">
                <article className="weapon-heatmap-page__stat"><span className="small">Recommended Range</span><strong>{rangeRecommendations.bestOverall ? `${formatNumber(rangeRecommendations.bestOverall.range, 0)}` : "Unknown"}</strong></article>
                <article className="weapon-heatmap-page__stat"><span className="small">Expected Damage At Best Range</span><strong>{rangeRecommendations.bestOverall ? formatNumber(rangeRecommendations.bestOverall.averageDamage, 1) : "Unknown"}</strong></article>
                <article className="weapon-heatmap-page__stat"><span className="small">Current Engagement Range</span><strong>{currentTargetSummary ? `${formatNumber(currentTargetSummary.range, 0)}` : formatNumber(engagementRange, 0)}</strong></article>
                <article className="weapon-heatmap-page__stat"><span className="small">Current Damage Outlook</span><strong>{currentTargetSummary?.damageBand ?? "Unknown"}</strong></article>
                <article className="weapon-heatmap-page__stat"><span className="small">Scenario Runs</span><strong>{formatNumber(scenarioRuns, 0)}</strong></article>
                <article className="weapon-heatmap-page__stat"><span className="small">Average Damage To Defender</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageDamageToDefender, 1) : "Unknown"}</strong></article>
                <article className="weapon-heatmap-page__stat"><span className="small">Average Damage To Attacker</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageDamageToAttacker, 1) : "Unknown"}</strong></article>
              </div>

              <div className="weapon-heatmap-page__report-grid">
                {visibleSections.matchup ? (
                <section className="panel admin-panel weapon-heatmap-page__report-card">
                  <div className="weapon-heatmap-page__section-head">
                    <h4>Matchup Summary</h4>
                    <span className="small">Attacker vs target</span>
                  </div>
                  <div className="weapon-heatmap-page__inspector-list">
                    <div><span className="small">Attacker</span><strong>{selectedShipDetail?.name ?? selectedShipUid ?? "Unknown"}</strong></div>
                    <div><span className="small">Target</span><strong>{targetShipDetail?.name ?? targetShipUid ?? "Unknown"}</strong></div>
                    <div><span className="small">Attacker Class</span><strong>{selectedShipDetail?.class_name ?? "Unknown"}</strong></div>
                    <div><span className="small">Target Class</span><strong>{targetShipDetail?.class_name ?? "Unknown"}</strong></div>
                    <div><span className="small">Attacker Length</span><strong>{formatNumber(selectedShipDetail?.length, 0)}</strong></div>
                    <div><span className="small">Target Length</span><strong>{formatNumber(targetShipDetail?.length, 0)}</strong></div>
                    <div><span className="small">Length Modifier</span><strong>{`${formatNumber(lengthModifier * 100, 0)}%`}</strong></div>
                    <div><span className="small">Target Armor</span><strong>{formatNumber(targetShipDetail?.armour, 0)}</strong></div>
                  </div>
                </section>
                ) : null}

                {visibleSections.engagement ? (
                <section className="panel admin-panel weapon-heatmap-page__report-card">
                  <div className="weapon-heatmap-page__section-head">
                    <h4>Engagement Summary</h4>
                    <span className="small">What the maths is saying</span>
                  </div>
                  <div className="weapon-heatmap-page__inspector-list">
                    <div><span className="small">Recommended Range</span><strong>{rangeRecommendations.bestOverall ? `${formatNumber(rangeRecommendations.bestOverall.range, 0)}` : "Unknown"}</strong></div>
                    <div><span className="small">Best Average Hit Chance</span><strong>{rangeRecommendations.bestOverall ? `${formatNumber(rangeRecommendations.bestOverall.averageHitChance * 100, 0)}%` : "Unknown"}</strong></div>
                    <div><span className="small">Best Average Damage</span><strong>{rangeRecommendations.bestOverall ? `${formatNumber(rangeRecommendations.bestOverall.averageDamage, 1)}/round` : "Unknown"}</strong></div>
                    <div><span className="small">Current Range</span><strong>{currentTargetSummary ? `${formatNumber(currentTargetSummary.range, 0)}` : "Unknown"}</strong></div>
                    <div><span className="small">Current Hit Chance</span><strong>{currentTargetSummary ? `${formatNumber(currentTargetSummary.hitChance * 100, 0)}%` : "Unknown"}</strong></div>
                    <div><span className="small">Current Damage</span><strong>{currentTargetSummary ? `${formatNumber(currentTargetSummary.expectedDamage, 1)}/round` : "Unknown"}</strong></div>
                    <div><span className="small">Avg Rounds To Hit</span><strong>{currentTargetSummary ? formatNumber(currentTargetSummary.averageRoundsToHit, 2, "No Hit") : "Unknown"}</strong></div>
                    <div><span className="small">Likely By Round</span><strong>{currentTargetSummary ? formatNumber(currentTargetSummary.likelyRoundsToHit, 2, "No Hit") : "Unknown"}</strong></div>
                    <div><span className="small">Scenario Runs</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.runs, 0) : "Unknown"}</strong></div>
                    <div><span className="small">Attacker Win Rate</span><strong>{currentScenarioProjection ? `${formatNumber(currentScenarioProjection.attackerWinRate * 100, 0)}%` : "Unknown"}</strong></div>
                    <div><span className="small">Defender Win Rate</span><strong>{currentScenarioProjection ? `${formatNumber(currentScenarioProjection.defenderWinRate * 100, 0)}%` : "Unknown"}</strong></div>
                    <div><span className="small">Mutual Kill Rate</span><strong>{currentScenarioProjection ? `${formatNumber(currentScenarioProjection.mutualKillRate * 100, 0)}%` : "Unknown"}</strong></div>
                    <div><span className="small">Stalemate Rate</span><strong>{currentScenarioProjection ? `${formatNumber(currentScenarioProjection.stalemateRate * 100, 0)}%` : "Unknown"}</strong></div>
                    <div><span className="small">Avg Rounds To Kill Defender</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRoundsToKillDefender, 2, "No Kill") : "Unknown"}</strong></div>
                    <div><span className="small">Avg Rounds To Kill Attacker</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRoundsToKillAttacker, 2, "No Kill") : "Unknown"}</strong></div>
                    <div><span className="small">Likely Rounds To Kill Defender</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.likelyRoundsToKillDefender, 2, "No Kill") : "Unknown"}</strong></div>
                    <div><span className="small">Likely Rounds To Kill Attacker</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.likelyRoundsToKillAttacker, 2, "No Kill") : "Unknown"}</strong></div>
                    <div><span className="small">Average Damage To Defender</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageDamageToDefender, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Average Damage To Attacker</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageDamageToAttacker, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Avg Defender Remaining Shield</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRemainingDefenderShield, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Avg Defender Remaining Hull</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRemainingDefenderHull, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Avg Defender Remaining Ionic</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRemainingDefenderIonic, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Avg Attacker Remaining Shield</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRemainingAttackerShield, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Avg Attacker Remaining Hull</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRemainingAttackerHull, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Avg Attacker Remaining Ionic</span><strong>{currentScenarioProjection ? formatNumber(currentScenarioProjection.averageRemainingAttackerIonic, 1) : "Unknown"}</strong></div>
                    <div><span className="small">Damage Swing To Best Range</span><strong>{recommendationDelta == null ? "Unknown" : `${recommendationDelta >= 0 ? "+" : ""}${formatNumber(recommendationDelta, 1)}`}</strong></div>
                  </div>
                  {currentScenarioProjection?.outcomeRoundBreakdown?.length ? (
                    <div className="members-combat-calc__round-breakdown">
                      <span className="small">All Scenario Outcomes By Round</span>
                      <div className="members-combat-calc__round-pill-row">
                        {currentScenarioProjection.outcomeRoundBreakdown.slice(0, 12).map((entry) => (
                          <span key={`outcome-${entry.round}`} className="members-combat-calc__round-pill">
                            R{formatNumber(entry.round, 0)}: {formatNumber(entry.count, 0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {currentScenarioProjection?.defenderRoundBreakdown?.length ? (
                    <div className="members-combat-calc__round-breakdown">
                      <span className="small">Defender Defeated By Round</span>
                      <div className="members-combat-calc__round-pill-row">
                        {currentScenarioProjection.defenderRoundBreakdown.slice(0, 12).map((entry) => (
                          <span key={`defender-${entry.round}`} className="members-combat-calc__round-pill">
                            R{formatNumber(entry.round, 0)}: {formatNumber(entry.count, 0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {currentScenarioProjection?.attackerRoundBreakdown?.length ? (
                    <div className="members-combat-calc__round-breakdown">
                      <span className="small">Attacker Defeated By Round</span>
                      <div className="members-combat-calc__round-pill-row">
                        {currentScenarioProjection.attackerRoundBreakdown.slice(0, 12).map((entry) => (
                          <span key={`attacker-${entry.round}`} className="members-combat-calc__round-pill">
                            R{formatNumber(entry.round, 0)}: {formatNumber(entry.count, 0)}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </section>
                ) : null}

                {visibleSections.weapon ? (
                <section className="panel admin-panel weapon-heatmap-page__report-card">
                  <div className="weapon-heatmap-page__section-head">
                    <h4>Focused Weapon Brief</h4>
                    <span className="small">Current firing profile</span>
                  </div>
                  <div className="weapon-heatmap-page__inspector-list">
                    <div><span className="small">Weapon</span><strong>{focusedWeapon?.name ?? focusedWeapon?.uid ?? "Unknown"}</strong></div>
                    <div><span className="small">Linked Weapons</span><strong>{formatNumber(resolvedWeapons.length, 0)}</strong></div>
                    <div><span className="small">Attacks / Round</span><strong>{formatNumber(totalAttackCount, 0)}</strong></div>
                    <div><span className="small">Average Damage / Hit</span><strong>{formatNumber(focusedWeaponAverageDamage, 1)}</strong></div>
                    <div><span className="small">Tracking</span><strong>{formatNumber(focusedWeapon?.actualTracking, 1)}</strong></div>
                    <div><span className="small">Damage Type</span><strong>{focusedWeapon?.weapon.damage_type ?? "Unknown"}</strong></div>
                    <div><span className="small">Damage Type Modifier</span><strong>{`${formatNumber(focusedDamageTypeModifier * 100, 0)}%`}</strong></div>
                    <div><span className="small">Ship Class Modifier</span><strong>{`${formatNumber(focusedShipClassModifier * 100, 0)}%`}</strong></div>
                    <div><span className="small">Arc</span><strong>{focusedWeapon?.arc ?? "Unknown"}</strong></div>
                    <div><span className="small">Optimum / Drop Off</span><strong>{focusedWeapon ? `${formatNumber(focusedWeapon.weapon.optimum_range, 0)} / ${formatNumber(focusedWeapon.weapon.drop_off, 0)}` : "Unknown"}</strong></div>
                  </div>
                </section>
                ) : null}

                {visibleSections.maneuver ? (
                <section className="panel admin-panel weapon-heatmap-page__report-card">
                  <div className="weapon-heatmap-page__section-head">
                    <h4>Maneuver Brief</h4>
                    <span className="small">Pilot and tracking context</span>
                  </div>
                  <div className="weapon-heatmap-page__inspector-list">
                    <div><span className="small">Combat Skill</span><strong>{formatNumber(combatSkill, 0)}</strong></div>
                    <div><span className="small">Attacker Piloting</span><strong>{formatNumber(attackerPilotingSkill, 0)}</strong></div>
                    <div><span className="small">Target Piloting</span><strong>{formatNumber(targetPilotingSkill, 0)}</strong></div>
                    <div><span className="small">Base Attacker Maneuver</span><strong>{formatNumber(selectedShipDetail?.manoeuvrability, 2)}</strong></div>
                    <div><span className="small">Actual Attacker Maneuver</span><strong>{formatNumber(actualAttackerManeuverability, 2)}</strong></div>
                    <div><span className="small">Base Target Maneuver</span><strong>{formatNumber(targetShipDetail?.manoeuvrability, 2)}</strong></div>
                    <div><span className="small">Actual Target Maneuver</span><strong>{formatNumber(actualTargetManeuverability, 2)}</strong></div>
                    <div><span className="small">Maneuver Modifier</span><strong>{`${formatNumber(maneuverComparisonModifier * 100, 0)}%`}</strong></div>
                  </div>
                </section>
                ) : null}
              </div>

              {visibleSections.weapon ? (
              <section className="panel admin-panel members-combat-calc__weapons">
                <div className="weapon-heatmap-page__section-head">
                  <h4>Linked Weapons</h4>
                  <span className="small">
                    {focusedWeapon ? "Select the weapon you want the brief and board to follow" : "Pick a weapon"}
                  </span>
                </div>
                {shipDetailLoading || resolvedWeaponsLoading || targetShipDetailLoading || targetResolvedWeaponsLoading ? <p className="small">Resolving ship data…</p> : null}
                <div className="ship-heatmap-page__weapon-picker">
                  {resolvedWeapons.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      className={`ship-heatmap-page__weapon-tile${focusedWeapon?.key === entry.key ? " is-active" : ""}`}
                      onClick={() => setFocusedWeaponKey(entry.key)}
                    >
                      <strong>{entry.name ?? entry.uid ?? entry.weapon.uid}</strong>
                      <span className="small">
                        Qty {formatNumber(entry.quantity, 0)} · Tracking {formatNumber(entry.weapon.tracking, 0)} · Actual {formatNumber(entry.actualTracking, 1)}
                      </span>
                      <span className="small">
                        Opt {formatNumber(entry.weapon.optimum_range, 0)} · Drop {formatNumber(entry.weapon.drop_off, 0)}{entry.arc ? ` · ${entry.arc}` : ""}
                      </span>
                    </button>
                    ))}
                  </div>
              </section>
              ) : null}

              {visibleSections.ranges && rangeRecommendations.topRanges.length ? (
                <div className="panel admin-panel" style={{ display: "grid", gap: "0.65rem" }}>
                  <div className="weapon-heatmap-page__section-head">
                    <h4>Recommended Engagement Ranges</h4>
                    <span className="small">Quick range plan based on average damage bands</span>
                  </div>
                  <div style={{ display: "grid", gap: "0.55rem", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
                    {rangeRecommendations.topRanges.map((entry) => (
                      <div key={entry.range} className="weapon-heatmap-page__stat">
                        <span className="small">Range {formatNumber(entry.range, 0)}</span>
                        <strong>{formatNumber(entry.averageDamage, 1)} dmg/round</strong>
                        <span className="small">{formatNumber(entry.averageHitChance * 100, 0)}% avg hit chance · {formatNumber(entry.averageRoundsToHit, 2, "No Hit")} avg rounds</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {visibleSections.scenarios && currentScenarioProjection?.sampleRuns?.length ? (
                <section className="panel admin-panel members-combat-calc__scenario-panel">
                  <div className="weapon-heatmap-page__section-head">
                    <h4>Scenario Samples</h4>
                    <span className="small">
                      Showing {formatNumber(pagedScenarioRuns.length, 0)} of {formatNumber(currentScenarioProjection.sampleRuns.length, 0)} scenarios
                    </span>
                  </div>
                  <div className="members-combat-calc__scenario-paging">
                    <button
                      type="button"
                      className="members-combat-calc__section-pill"
                      onClick={() => setScenarioPage((current) => Math.max(1, current - 1))}
                      disabled={scenarioPage <= 1}
                    >
                      Previous
                    </button>
                    <span className="small">Page {formatNumber(scenarioPage, 0)} / {formatNumber(scenarioPageCount, 0)}</span>
                    <button
                      type="button"
                      className="members-combat-calc__section-pill"
                      onClick={() => setScenarioPage((current) => Math.min(scenarioPageCount, current + 1))}
                      disabled={scenarioPage >= scenarioPageCount}
                    >
                      Next
                    </button>
                  </div>
                  <div className="members-combat-calc__scenario-list">
                    {pagedScenarioRuns.map((scenario) => (
                      <article key={scenario.run} className="members-combat-calc__scenario-card">
                        <button
                          type="button"
                          className="members-combat-calc__scenario-toggle"
                          onClick={() => toggleScenarioRun(scenario.run)}
                        >
                          <div className="members-combat-calc__scenario-head">
                            <strong>Scenario {scenario.run}</strong>
                            <span className="small">
                              {scenario.winner === "attacker"
                                ? `Defender Destroyed · Round ${formatNumber(scenario.defenderDestroyedAtRound, 0)}`
                                : scenario.winner === "defender"
                                  ? `Attacker Destroyed · Round ${formatNumber(scenario.attackerDestroyedAtRound, 0)}`
                                  : scenario.winner === "mutual"
                                    ? "Mutual Kill"
                                    : "Both Survived"}
                            </span>
                          </div>
                        </button>
                        {expandedScenarioRuns[scenario.run] ? (
                          <div className="weapon-heatmap-page__inspector-list">
                            <div><span className="small">Seed</span><strong>{scenario.seed}</strong></div>
                            <div><span className="small">Winner</span><strong>{scenario.winner}</strong></div>
                            <div><span className="small">Damage To Defender</span><strong>{formatNumber(scenario.damageToDefender, 1)}</strong></div>
                            <div><span className="small">Damage To Attacker</span><strong>{formatNumber(scenario.damageToAttacker, 1)}</strong></div>
                            <div><span className="small">Defender Remaining Hull</span><strong>{formatNumber(scenario.defenderRemainingHull, 1)}</strong></div>
                            <div><span className="small">Attacker Remaining Hull</span><strong>{formatNumber(scenario.attackerRemainingHull, 1)}</strong></div>
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <p className="small">Pick a stored ship to build a combat brief from its linked weapons.</p>
          )}
        </section>
      </div>
    </div>
  );
};

export default MemberCombatCalculatorPanel;
