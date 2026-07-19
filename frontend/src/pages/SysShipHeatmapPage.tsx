import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { fetchAuthMe, subscribeToAuthStateChange, type SwcUser } from "../api/core/auth";
import { getDebugCombatSettings } from "../api/admin/sysDebug";
import {
  getStoredShipType,
  getStoredShipTypes,
  getStoredWeaponType,
  type StoredShipTypeDetail,
  type StoredShipTypeSummary,
  type StoredWeaponTypeDetail,
} from "../api/universe/universe";
import { canAccessSysadmin } from "../auth/permissions";
import ForbiddenState from "../components/common/ForbiddenState";
import NotLoggedInState from "../components/common/NotLoggedInState";

type HeatmapBoardMode = "auto" | "space" | "ground";
type GridPoint = { x: number; y: number };
type HeatmapSelectionMode = "origin" | "target";

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

function heatColor(hitChance: number) {
  if (hitChance <= 0) {
    return "rgba(255,255,255,0.03)";
  }

  const alpha = 0.14 + hitChance * 0.78;
  const red = Math.round(110 + hitChance * 145);
  const green = Math.round(50 + hitChance * 120);
  const blue = Math.round(24 + hitChance * 40);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

const SysShipHeatmapPage: React.FC = () => {
  const [viewer, setViewer] = useState<SwcUser | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [authRefreshNonce, setAuthRefreshNonce] = useState(0);
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
  const [boardMode, setBoardMode] = useState<HeatmapBoardMode>("space");
  const [hoveredCell, setHoveredCell] = useState<ShipHeatCell | null>(null);
  const [selectedOrigin, setSelectedOrigin] = useState<GridPoint | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<GridPoint | null>(null);
  const [selectionMode, setSelectionMode] = useState<HeatmapSelectionMode>("origin");
  const [combatSkill, setCombatSkill] = useState(5);
  const [attackerPilotingSkill, setAttackerPilotingSkill] = useState(5);
  const [targetPilotingSkill, setTargetPilotingSkill] = useState(5);
  const [resolvedWeapons, setResolvedWeapons] = useState<ResolvedShipWeapon[]>([]);
  const [resolvedWeaponsLoading, setResolvedWeaponsLoading] = useState(false);
  const [focusedWeaponKey, setFocusedWeaponKey] = useState<string | null>(null);
  const [shipDamageTypeModifiers, setShipDamageTypeModifiers] = useState<Record<string, number>>({});
  const [shipClassModifiers, setShipClassModifiers] = useState<Record<string, Record<string, Record<string, number>>>>({});

  useEffect(() => {
    return subscribeToAuthStateChange(() => {
      setAuthRefreshNonce((value) => value + 1);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        setPageLoading(true);
        const authRes = await fetchAuthMe();

        if (cancelled) return;

        setViewer(authRes.user);
        setPageError(null);
      } catch (error: any) {
        if (!cancelled) {
          setViewer(null);
          setPageError(error?.message ?? "Failed to load ship heatmap page.");
        }
      } finally {
        if (!cancelled) {
          setPageLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authRefreshNonce]);

  useEffect(() => {
    if (!viewer || !canAccessSysadmin(viewer)) {
      return;
    }

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
  }, [viewer]);

  useEffect(() => {
    if (!viewer || !canAccessSysadmin(viewer)) {
      return;
    }

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
  }, [viewer]);

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
  const activeWeapons = useMemo(
    () => (focusedWeapon ? [focusedWeapon] : []),
    [focusedWeapon]
  );
  const selectedMaxRange = useMemo(() => {
    return activeWeapons.reduce((highest, entry) => {
      const optimum = Math.max(0, Number(entry.weapon.optimum_range ?? 0));
      const dropOff = Math.max(0, Number(entry.weapon.drop_off ?? 0));
      return Math.max(highest, optimum + dropOff);
    }, 0);
  }, [activeWeapons]);
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
      activeWeapons.reduce((sum, entry) => {
        const maxHits = entry.weapon.max_hits == null || Number.isNaN(Number(entry.weapon.max_hits))
          ? 1
          : Math.max(1, Number(entry.weapon.max_hits));
        return sum + (entry.quantity * maxHits);
      }, 0),
    [activeWeapons]
  );

  useEffect(() => {
    setSelectedOrigin((current) => clampPointToBoard(current, selectedMaxRange, boardMode));
    setSelectedTarget((current) => clampPointToBoard(current, selectedMaxRange, boardMode));
    setHoveredCell(null);
  }, [defaultOrigin.x, defaultOrigin.y, selectedMaxRange, boardMode]);

  const heatCells = useMemo(
    () => buildShipHeatCells(
      activeWeapons,
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
    [activeWeapons, boardMode, selectedOrigin, selectedShipDetail, targetShipDetail, actualAttackerManeuverability, actualTargetManeuverability, shipDamageTypeModifiers, shipClassModifiers]
  );
  const gridColumns = useMemo(() => {
    if (boardMode === "space") return 20;
    if (boardMode === "ground") return 21;
    return Math.sqrt(heatCells.length);
  }, [boardMode, heatCells.length]);
  const activeOrigin = selectedOrigin ?? defaultOrigin;
  const activeTarget = selectedTarget ?? defaultOrigin;
  const selectedTargetCell = useMemo(
    () => heatCells.find((cell) => cell.x === activeTarget.x && cell.y === activeTarget.y) ?? null,
    [heatCells, activeTarget.x, activeTarget.y]
  );

  if (pageLoading) {
    return (
      <main className="board flex flex-col gap-4">
        <p className="small">Checking sysadmin access…</p>
      </main>
    );
  }

  if (pageError) {
    return (
      <main className="board flex flex-col gap-4">
        <p className="small">{pageError}</p>
      </main>
    );
  }

  if (!viewer) {
    return <NotLoggedInState />;
  }

  if (!canAccessSysadmin(viewer)) {
    return <ForbiddenState title="Sysadmin Access Required" message="This ship heatmap is limited to sysadmins." />;
  }

  const modeBtnCls = (active: boolean) =>
    `inline-flex items-center justify-center min-h-[34px] px-3 py-1.5 text-[0.88rem] rounded-[10px] border cursor-pointer transition-[border-color,background] duration-150  font-tektur${active ? "border-[rgba(246,163,0,0.55)] bg-[rgba(246,163,0,0.14)] text-[#f2c46f]" : "border-white/10 bg-white/[0.025] text-white/90 hover:border-[rgba(246,163,0,0.3)] hover:bg-[rgba(246,163,0,0.08)]"}`;
  const statCls = "grid gap-[0.25rem] p-[0.8rem] border border-white/[0.08] rounded-[12px] bg-white/[0.025]";
  const tileCls = (active: boolean) =>
    `grid gap-[0.15rem] w-full p-[0.75rem_0.8rem] text-left border rounded-[10px] bg-white/[0.025] text-inherit cursor-pointer transition-[border-color,background] duration-150 hover:border-[rgba(246,163,0,0.3)] hover:bg-[rgba(246,163,0,0.08)]  font-tektur${active ? "border-[rgba(246,163,0,0.55)] bg-[rgba(246,163,0,0.14)]" : "border-white/[0.08]"}`;

  return (
    <main className="board grid gap-4">
      <div className="flex justify-between gap-4">
        <div>
          <p className="small">
            <Link to="/sys/debug">Back to Sys Debug</Link>
          </p>
          <h1 className="h1">Ship Heatmap</h1>
          <p className="small">
            First-pass multi-weapon ship sandbox. It combines linked weapons with the current range/drop-off model and surfaces space-combat tracking and maneuver numbers so we can plug the rest of the formula in next.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(220px,260px)_minmax(0,1fr)_minmax(220px,260px)] gap-[0.8rem] items-start max-[1280px]:grid-cols-[minmax(200px,240px)_minmax(0,1fr)_minmax(200px,240px)] max-[1100px]:grid-cols-1">
        <section className="panel grid gap-[0.55rem] self-start content-start sticky top-3 !p-[0.8rem] min-w-0 max-[1100px]:static">
          <div className="flex justify-between items-start gap-3 [&_h3]:m-0 [&_h4]:m-0 [&_p]:m-0 [&_h3]:text-[0.95rem]">
            <h3 className="h3">Ship Picker</h3>
          </div>

          <label className="small" htmlFor="ship-heatmap-query">
            Search
          </label>
          <input
            id="ship-heatmap-query"
            className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name, class, or UID"
          />

          <div className="grid gap-[0.22rem]">
            <span className="small">Grid</span>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={modeBtnCls(boardMode === "space")} onClick={() => setBoardMode("space")}>Space 20x20</button>
              <button type="button" className={modeBtnCls(boardMode === "ground")} onClick={() => setBoardMode("ground")}>Ground 21x21</button>
              <button type="button" className={modeBtnCls(boardMode === "auto")} onClick={() => setBoardMode("auto")}>Auto</button>
            </div>
          </div>

          <div className="grid gap-[0.22rem]">
            <span className="small">Click Mode</span>
            <div className="flex flex-wrap gap-1">
              <button type="button" className={modeBtnCls(selectionMode === "origin")} onClick={() => setSelectionMode("origin")}>Set Weapon Grid</button>
              <button type="button" className={modeBtnCls(selectionMode === "target")} onClick={() => setSelectionMode("target")}>Set Target Grid</button>
            </div>
          </div>

          <div className="grid gap-[0.22rem]">
            <span className="small">Attacker / Target</span>
            <label className="small" htmlFor="ship-heatmap-combat-skill">Combat Skill</label>
            <input id="ship-heatmap-combat-skill" className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur" type="number" min={0} max={10} step={1} value={combatSkill} onChange={(event) => setCombatSkill(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
            <label className="small" htmlFor="ship-heatmap-attacker-piloting-skill">Attacker Piloting Skill</label>
            <input id="ship-heatmap-attacker-piloting-skill" className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur" type="number" min={0} max={10} step={1} value={attackerPilotingSkill} onChange={(event) => setAttackerPilotingSkill(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
            <label className="small" htmlFor="ship-heatmap-target-ship">Target Ship</label>
            <select
              id="ship-heatmap-target-ship"
              className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur"
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
            <input id="ship-heatmap-piloting-skill" className="w-full min-h-[42px] rounded-[10px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-inherit font-tektur" type="number" min={0} max={10} step={1} value={targetPilotingSkill} onChange={(event) => setTargetPilotingSkill(Math.max(0, Math.min(10, Number(event.target.value) || 0)))} />
          </div>

          {shipsLoading ? <p className="small">Loading stored ships…</p> : null}
          {shipsError ? <p className="small">{shipsError}</p> : null}

          <div className="grid gap-[0.4rem] max-h-[220px] overflow-auto pr-[0.15rem]">
            {filteredShips.map((ship) => (
              <button
                key={ship.uid}
                type="button"
                className={tileCls(selectedShipUid === ship.uid)}
                onClick={() => setSelectedShipUid(ship.uid)}
              >
                <strong>{ship.name ?? ship.uid}</strong>
                <span className="small">{ship.class_name ?? "Unknown class"}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="panel grid gap-4 content-start">
          {selectedShip ? (
            <>
              <div className="flex justify-between items-start gap-3 [&_h3]:m-0 [&_h4]:m-0 [&_p]:m-0 [&_h3]:text-[0.95rem]">
                <div>
                  <h3 className="h3">{selectedShip.name ?? selectedShip.uid}</h3>
                  <p className="small">{selectedShip.class_name ?? "Unknown class"}</p>
                </div>
              </div>

              <div className="grid gap-[0.45rem]">
                <div className="flex justify-between items-start gap-3 [&_h3]:m-0 [&_h4]:m-0 [&_p]:m-0 [&_h3]:text-[0.95rem]">
                  <h4>Linked Weapons</h4>
                  <span className="small">
                    {focusedWeapon ? "Showing selected weapon heatmap" : "Pick a weapon"}
                  </span>
                </div>
                {shipDetailLoading || resolvedWeaponsLoading || targetShipDetailLoading ? <p className="small">Resolving ship data…</p> : null}
                <div className="grid grid-cols-2 gap-[0.65rem] max-[820px]:grid-cols-1">
                  {resolvedWeapons.map((entry) => (
                    <button
                      key={entry.key}
                      type="button"
                      className={tileCls(focusedWeapon?.key === entry.key)}
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
              </div>

              <div className="grid grid-cols-4 gap-[0.7rem] max-[980px]:grid-cols-2 max-[560px]:grid-cols-1">
                <article className={statCls}><span className="small">Linked Weapons</span><strong>{formatNumber(resolvedWeapons.length, 0)}</strong></article>
                <article className={statCls}><span className="small">Selected Weapon</span><strong>{focusedWeapon?.name ?? focusedWeapon?.uid ?? "Unknown"}</strong></article>
                <article className={statCls}><span className="small">Attacks / Round</span><strong>{formatNumber(totalAttackCount, 0)}</strong></article>
                <article className={statCls}><span className="small">Heatmap Range</span><strong>{formatNumber(selectedMaxRange, 0)}</strong></article>
                <article className={statCls}><span className="small">Grid Mode</span><strong>{boardMode === "space" ? "Space 20x20" : boardMode === "ground" ? "Ground 21x21" : "Auto"}</strong></article>
                <article className={statCls}><span className="small">Weapon Grid</span><strong>{`${activeOrigin.x}, ${activeOrigin.y}`}</strong></article>
                <article className={statCls}><span className="small">Target Grid</span><strong>{`${activeTarget.x}, ${activeTarget.y}`}</strong></article>
                <article className={statCls}><span className="small">Target Ship</span><strong>{targetShipDetail?.name ?? targetShipUid ?? "Unknown"}</strong></article>
                <article className={statCls}><span className="small">Attacker Length</span><strong>{formatNumber(selectedShipDetail?.length, 0)}</strong></article>
                <article className={statCls}><span className="small">Target Length</span><strong>{formatNumber(targetShipDetail?.length, 0)}</strong></article>
                <article className={statCls}><span className="small">Attacker Class</span><strong>{selectedShipDetail?.class_name ?? "Unknown"}</strong></article>
                <article className={statCls}><span className="small">Target Class</span><strong>{targetShipDetail?.class_name ?? "Unknown"}</strong></article>
                <article className={statCls}><span className="small">Target Armor</span><strong>{formatNumber(targetShipDetail?.armour, 0)}</strong></article>
                <article className={statCls}><span className="small">Length Modifier</span><strong>{`${formatNumber(lengthModifier * 100, 0)}%`}</strong></article>
                <article className={statCls}><span className="small">Base Attacker Maneuver</span><strong>{formatNumber(selectedShipDetail?.manoeuvrability, 2)}</strong></article>
                <article className={statCls}><span className="small">Actual Attacker Maneuver</span><strong>{formatNumber(actualAttackerManeuverability, 2)}</strong></article>
                <article className={statCls}><span className="small">Base Target Maneuver</span><strong>{formatNumber(targetShipDetail?.manoeuvrability, 2)}</strong></article>
                <article className={statCls}><span className="small">Actual Target Maneuver</span><strong>{formatNumber(actualTargetManeuverability, 2)}</strong></article>
                <article className={statCls}><span className="small">Maneuver Modifier</span><strong>{`${formatNumber(maneuverComparisonModifier * 100, 0)}%`}</strong></article>
                <article className={statCls}><span className="small">Ship Class Modifier</span><strong>{`${formatNumber(focusedShipClassModifier * 100, 0)}%`}</strong></article>
                <article className={statCls}><span className="small">Target Hit Chance</span><strong>{selectedTargetCell ? `${formatNumber(selectedTargetCell.combinedHitChance * 100, 0)}%` : "Unknown"}</strong></article>
              </div>

              <div className="grid gap-3 items-start justify-items-center">
                <div
                  className="relative grid gap-[2px] w-[min(100%,760px)] justify-self-center p-[0.65rem] border border-white/[0.08] rounded-[14px] bg-[rgba(0,0,0,0.22)]"
                  style={{ gridTemplateColumns: `repeat(${gridColumns || 1}, minmax(0, 1fr))` }}
                >
                  {heatCells.map((cell) => {
                    const isOrigin = cell.x === activeOrigin.x && cell.y === activeOrigin.y;
                    const isTarget = cell.x === activeTarget.x && cell.y === activeTarget.y;
                    const originAndTarget = isOrigin && isTarget;

                    return (
                      <button
                        key={`${cell.x}:${cell.y}`}
                        type="button"
                        className={`relative overflow-hidden aspect-square border rounded-[4px] text-white/[0.88] grid place-items-center text-[0.62rem] p-0 appearance-none cursor-pointer transition-[transform,border-color] duration-100 hover:scale-[1.03] hover:border-[rgba(246,163,0,0.55)] focus-visible:scale-[1.03] focus-visible:border-[rgba(246,163,0,0.55)] focus-visible:outline-none min-[32px] [&_span]:pointer-events-none  font-tektur${originAndTarget ? "border-white/[0.65] shadow-[inset_0_0_0_1px_rgba(246,163,0,0.55),0_0_0_1px_rgba(255,255,255,0.45)]" : isOrigin ? "border-white/[0.06] bg-white/[0.03] shadow-[inset_0_0_0_1px_rgba(246,163,0,0.55)]" : isTarget ? "border-white/[0.65] bg-white/[0.03]" : "border-white/[0.06] bg-white/[0.03]"}`}
                        style={{ background: heatColor(cell.combinedHitChance) }}
                        onMouseEnter={() => setHoveredCell(cell)}
                        onFocus={() => setHoveredCell(cell)}
                        onClick={() => {
                          if (selectionMode === "origin") {
                            setSelectedOrigin({ x: cell.x, y: cell.y });
                          } else {
                            setSelectedTarget({ x: cell.x, y: cell.y });
                          }
                          setHoveredCell(cell);
                        }}
                      >
                        <span>{cell.combinedHitChance > 0 ? formatNumber(cell.combinedHitChance * 100, 0) : ""}</span>
                        {isOrigin ? <i className="absolute pointer-events-none left-[0.24rem] bottom-[0.24rem] w-2 h-2 rounded-full bg-[rgba(246,163,0,0.95)] shadow-[0_0_10px_rgba(246,163,0,0.45)]" aria-hidden="true" /> : null}
                        {isTarget ? <i className="absolute pointer-events-none right-[0.24rem] top-[0.24rem] w-2 h-2 rounded-full bg-[rgba(232,67,67,0.95)] shadow-[0_0_10px_rgba(232,67,67,0.45)]" aria-hidden="true" /> : null}
                      </button>
                    );
                  })}
                </div>

                <aside className="grid gap-3 w-full max-w-[760px]">
                  <div className="flex justify-between items-start gap-3 [&_h3]:m-0 [&_h4]:m-0 [&_p]:m-0 [&_h3]:text-[0.95rem]">
                    <h4>Cell Inspector</h4>
                    <button
                      type="button"
                      className="text-[0.82rem] text-white/60 hover:text-white/90 cursor-pointer bg-transparent border-0 p-0 font-tektur"
                      onClick={() => {
                        setSelectedOrigin(defaultOrigin);
                        setSelectedTarget(defaultOrigin);
                        setHoveredCell(null);
                      }}
                    >
                      Reset Markers
                    </button>
                  </div>

                  {hoveredCell ? (
                    <div className="grid gap-2">
                      <div><span className="small">Cell</span><strong>{hoveredCell.x}, {hoveredCell.y}</strong></div>
                      <div><span className="small">Distance</span><strong>{formatNumber(hoveredCell.distance, 2)}</strong></div>
                      <div><span className="small">Hit Chance</span><strong>{formatNumber(hoveredCell.combinedHitChance * 100, 0)}%</strong></div>
                      <div><span className="small">Avg Rounds To Hit</span><strong>{formatNumber(hoveredCell.averageRoundsToHit, 2, "No Hit")}</strong></div>
                      <div><span className="small">Likely By Round</span><strong>{formatNumber(hoveredCell.likelyRoundsToHit, 2, "No Hit")}</strong></div>
                      <div><span className="small">Expected Damage / Round</span><strong>{formatNumber(hoveredCell.expectedDamage, 1)}</strong></div>
                      <div><span className="small">Weapon</span><strong>{focusedWeapon?.name ?? focusedWeapon?.uid ?? "Unknown"}</strong></div>
                      <div><span className="small">Damage Type</span><strong>{focusedWeapon?.weapon.damage_type ?? "Unknown"}</strong></div>
                      <div><span className="small">Damage Type Modifier</span><strong>{`${formatNumber(focusedDamageTypeModifier * 100, 0)}%`}</strong></div>
                      <div><span className="small">Ship Class Modifier</span><strong>{`${formatNumber(focusedShipClassModifier * 100, 0)}%`}</strong></div>
                      <div><span className="small">Tracking</span><strong>{formatNumber(focusedWeapon?.actualTracking, 1)}</strong></div>
                      <div><span className="small">Optimum / Drop Off</span><strong>{focusedWeapon ? `${formatNumber(focusedWeapon.weapon.optimum_range, 0)} / ${formatNumber(focusedWeapon.weapon.drop_off, 0)}` : "Unknown"}</strong></div>
                      <div><span className="small">Arc</span><strong>{focusedWeapon?.arc ?? "Unknown"}</strong></div>
                    </div>
                  ) : (
                    <p className="small">Pick a linked weapon, set weapon or target grid, then hover any cell to inspect that weapon's ship heatmap.</p>
                  )}
                </aside>
              </div>
            </>
          ) : (
            <p className="small">Pick a stored ship to preview its linked-weapon heatmap.</p>
          )}
        </section>
      </div>
    </main>
  );
};

export default SysShipHeatmapPage;
