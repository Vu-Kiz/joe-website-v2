// Web Worker for combat simulation — runs off the main thread.
// All types and functions are self-contained (no imports).

// ─── Types ────────────────────────────────────────────────────────────────────

type StoredWeaponTypeDetail = {
  uid?: string | null;
  name?: string | null;
  damage_type?: string | null;
  min_damage?: number | null;
  max_damage?: number | null;
  optimum_range?: number | null;
  drop_off?: number | null;
  firepower?: number | null;
  tracking?: number | null;
  fire_delay?: number | null;
  max_hits?: number | null;
  [key: string]: unknown;
};

type StoredShipTypeDetail = {
  uid?: string | null;
  name?: string | null;
  class_name?: string | null;
  shield?: number | null;
  hull?: number | null;
  armour?: number | null;
  ionic_capacity?: number | null;
  manoeuvrability?: number | null;
  length?: number | null;
  shield_arcs?: Array<{ name?: string | null; value?: number | null; percent?: number | null }> | null;
  [key: string]: unknown;
};

type ResolvedWeapon = {
  key: string;
  uid: string | null;
  name: string | null;
  quantity: number;
  arc: string | null;
  arcFrom: number | null;
  arcTo: number | null;
  weapon: StoredWeaponTypeDetail;
};

type ResolvedSlot = {
  id: string;
  shipUid: string;
  shipDetail: StoredShipTypeDetail;
  weapons: ResolvedWeapon[];
  quantity: number;
  combatSkill: number;
  pilotingSkill: number;
  engagementBearing: number | null;
};

type Combatant = {
  slotId: string;
  instanceIdx: number;
  side: "a" | "b";
  shipDetail: StoredShipTypeDetail;
  weapons: ResolvedWeapon[];
  combatSkill: number;
  pilotingSkill: number;
  engagementBearing: number | null;
  shield: number;
  shieldByArc: Record<string, number>;
  hull: number;
  ionic: number;
  alive: boolean;
  kills: number;
  damageDealt: number;
  roundDied: number | null;
  roundFirstKill: number | null;
  killedBy: Combatant | null;
};

type OneBattleResult = {
  winner: "a" | "b" | "mutual" | "stalemate";
  rounds: number;
  survivors: Combatant[];
  combatants: Combatant[];
};

type SlotAggregated = {
  slotId: string;
  side: "a" | "b";
  shipName: string;
  shipClass: string;
  quantity: number;
  totalInstances: number;
  avgKills: number;
  avgDeaths: number;
  kda: number;
  surviveRate: number;
  avgRemainingShield: number;
  avgRemainingHull: number;
  avgRemainingIonic: number;
  maxShield: number;
  maxHull: number;
  avgDmgPerRound: number;
  avgRoundsDied: number | null;
  avgRoundsFirstKill: number | null;
};

type AggregatedResults = {
  runs: number;
  winRateA: number;
  winRateB: number;
  mutualKillRate: number;
  stalemateRate: number;
  avgRounds: number;
  p90Rounds: number | null;
  avgALossCount: number;
  avgBLossCount: number;
  avgALossRate: number;
  avgBLossRate: number;
  slots: SlotAggregated[];
  roundDistribution: Array<{ round: number; count: number; pct: number }>;
  sampleRuns: OneBattleResult[];
};

export type SimWorkerRequest = {
  type: "run";
  slotsA: ResolvedSlot[];
  slotsB: ResolvedSlot[];
  targeting: "focus" | "random" | "optimal";
  range: number;
  runs: number;
  dmgTypeMods: Record<string, number>;
  classMods: Record<string, Record<string, Record<string, number>>>;
};

export type SimWorkerResponse =
  | { type: "result"; result: AggregatedResults }
  | { type: "error"; message: string };

// ─── Math helpers ─────────────────────────────────────────────────────────────

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function resolveActualManeuverability(base: number, pilotingSkill: number): number {
  const required = Math.max(0, base - 5);
  return base + (pilotingSkill - required) / 2;
}

function resolveManeuverModifier(attackerMnvr: number, defenderMnvr: number): number {
  const divisor = Math.max(attackerMnvr, defenderMnvr);
  if (divisor <= 0) return 1;
  return Math.max(0, 1 + (attackerMnvr - defenderMnvr) / divisor);
}

function resolveLengthModifier(
  attackerLen: number | null | undefined,
  defenderLen: number | null | undefined
): number {
  const a = Math.max(0, Number(attackerLen ?? 0));
  const d = Math.max(0, Number(defenderLen ?? 0));
  if (a <= 0 || d <= 0 || a === d) return 1;
  const thresholds = [
    { ratio: 200, s: 3, l: 0.55 },
    { ratio: 150, s: 2, l: 0.6 },
    { ratio: 100, s: 1.5, l: 0.65 },
    { ratio: 75, s: 1.3, l: 0.7 },
    { ratio: 50, s: 1.25, l: 0.75 },
    { ratio: 25, s: 1.2, l: 0.8 },
    { ratio: 10, s: 1.15, l: 0.85 },
    { ratio: 5, s: 1.1, l: 0.9 },
    { ratio: 2, s: 1.05, l: 0.95 },
  ];
  if (a < d) {
    const ratio = d / a;
    return thresholds.find((t) => ratio > t.ratio)?.s ?? 1;
  }
  const ratio = a / d;
  return thresholds.find((t) => ratio > t.ratio)?.l ?? 1;
}

const HIT_CHANCE_TABLE: number[][] = [
  [30, 35, 40, 45, 50, 55, 60, 65, 70, 75],
  [25, 30, 35, 40, 45, 50, 55, 60, 65, 70],
  [20, 25, 30, 35, 40, 45, 50, 55, 60, 65],
  [15, 20, 25, 30, 35, 40, 45, 50, 55, 60],
  [10, 15, 20, 25, 30, 35, 40, 45, 50, 55],
  [ 7, 10, 15, 20, 25, 30, 35, 40, 45, 50],
  [ 4,  7, 10, 15, 20, 25, 30, 35, 40, 45],
  [ 3,  4,  7, 10, 15, 20, 25, 30, 35, 40],
  [ 2,  3,  4,  7, 10, 15, 20, 25, 30, 35],
  [ 1,  2,  3,  4,  7, 10, 15, 20, 25, 30],
];

function baseHitChance(actualTracking: number, defenderMnvr: number): number {
  const t = Math.max(1, Math.min(10, actualTracking));
  const m = Math.max(1, Math.min(10, defenderMnvr));
  const t0 = Math.floor(t);
  const t1 = Math.min(10, t0 + 1);
  const m0 = Math.floor(m);
  const m1 = Math.min(10, m0 + 1);
  const ft = t - t0;
  const fm = m - m0;
  const v00 = HIT_CHANCE_TABLE[m0 - 1][t0 - 1];
  const v10 = HIT_CHANCE_TABLE[m0 - 1][t1 - 1];
  const v01 = HIT_CHANCE_TABLE[m1 - 1][t0 - 1];
  const v11 = HIT_CHANCE_TABLE[m1 - 1][t1 - 1];
  const top = v00 * (1 - ft) + v10 * ft;
  const bot = v01 * (1 - ft) + v11 * ft;
  return (top * (1 - fm) + bot * fm) / 100;
}

function rangeHitModifier(weapon: StoredWeaponTypeDetail, distance: number): number {
  if (weapon.optimum_range == null && weapon.drop_off == null) return 1;
  const optimum = Math.max(0, Number(weapon.optimum_range ?? 0));
  const dropOff = Math.max(0, Number(weapon.drop_off ?? 0));
  const delta = Math.abs(optimum - distance);
  const logistic = 0.95 / (1 + Math.exp(-2 * (delta - dropOff)));
  return clamp01(1 - logistic - 0.003 * delta);
}

function applyArmorReduction(
  damage: number,
  firepower: number | null | undefined,
  armor: number | null | undefined
): number {
  const fp = Math.max(0, Number(firepower ?? 0));
  const ar = Math.max(0, Number(armor ?? 0));
  if (damage <= 0 || fp <= 0) return 0;
  return damage * (fp / (fp + ar));
}

function getDamageTypeModifier(damageType: string | null | undefined, mods: Record<string, number>): number {
  const k = (damageType ?? "").trim().toLowerCase();
  return k ? (mods[k] ?? 1) : 1;
}

function getShipClassModifier(
  damageType: string | null | undefined,
  attackerClass: string | null | undefined,
  defenderClass: string | null | undefined,
  matrix: Record<string, Record<string, Record<string, number>>>
): number {
  const dt = (damageType ?? "").trim().toLowerCase();
  const ac = (attackerClass ?? "").trim().toLowerCase();
  const dc = (defenderClass ?? "").trim().toLowerCase();
  return dt && ac && dc ? (matrix[dt]?.[ac]?.[dc] ?? 1) : 1;
}

function isIonicDamageType(damageType: string | null | undefined): boolean {
  return (damageType ?? "").toLowerCase().includes("ionic");
}

function bearingInArc(bearing: number, from: number, to: number): boolean {
  const b = ((bearing % 360) + 360) % 360;
  const f = ((from % 360) + 360) % 360;
  const t = ((to % 360) + 360) % 360;
  if (f <= t) return b >= f && b <= t;
  return b >= f || b <= t;
}

function bearingToShieldArcName(bearing: number): string {
  const b = ((bearing % 360) + 360) % 360;
  if (b >= 315 || b < 45)  return "fore";
  if (b >= 45  && b < 135) return "starboard";
  if (b >= 135 && b < 225) return "aft";
  return "port";
}

const CANONICAL_ARCS: Record<string, string> = {
  fore: "fore", forward: "fore", front: "fore",
  aft: "aft", rear: "aft", back: "aft",
  port: "port", left: "port",
  starboard: "starboard", stbd: "starboard", right: "starboard",
  all: "all", turret: "all", omni: "all", omnidirectional: "all",
};

function normalizeArc(arc: string | null | undefined): string | null {
  if (!arc) return null;
  return CANONICAL_ARCS[arc.trim().toLowerCase()] ?? arc.trim().toLowerCase();
}

function buildShieldArcPools(detail: StoredShipTypeDetail): Record<string, number> {
  const arcs = detail.shield_arcs;
  if (!Array.isArray(arcs) || !arcs.length) return {};
  const totalShield = Math.max(0, Number(detail.shield ?? 0));
  const pools: Record<string, number> = {};
  for (const arc of arcs) {
    if (!arc.name) continue;
    const key = normalizeArc(arc.name);
    if (!key || key === "all") continue;
    let value: number;
    if (arc.value != null) {
      value = Math.max(0, Number(arc.value));
    } else if (arc.percent != null) {
      value = Math.round(totalShield * arc.percent / 100);
    } else {
      continue;
    }
    pools[key] = value;
  }
  return pools;
}

function weaponCanFireAtBearing(weapon: ResolvedWeapon, bearing: number): boolean {
  if (weapon.arcFrom != null && weapon.arcTo != null) {
    return bearingInArc(bearing, weapon.arcFrom, weapon.arcTo);
  }
  const norm = normalizeArc(weapon.arc);
  if (!norm || norm === "all") return true;
  const quadrants: Record<string, [number, number]> = {
    fore: [315, 45], aft: [135, 225], starboard: [45, 135], port: [225, 315],
  };
  const q = quadrants[norm];
  if (!q) return true;
  return bearingInArc(bearing, q[0], q[1]);
}

function expandCombatants(slots: ResolvedSlot[], side: "a" | "b"): Combatant[] {
  const result: Combatant[] = [];
  for (const slot of slots) {
    const shieldArcPools = buildShieldArcPools(slot.shipDetail);
    for (let i = 0; i < slot.quantity; i++) {
      result.push({
        slotId: slot.id,
        instanceIdx: i,
        side,
        shipDetail: slot.shipDetail,
        weapons: slot.weapons,
        combatSkill: slot.combatSkill,
        pilotingSkill: slot.pilotingSkill,
        engagementBearing: slot.engagementBearing,
        shield: Math.max(0, Number(slot.shipDetail.shield ?? 0)),
        shieldByArc: { ...shieldArcPools },
        hull: Math.max(0, Number(slot.shipDetail.hull ?? 0)),
        ionic: Math.max(0, Number(slot.shipDetail.ionic_capacity ?? 0)),
        alive: true,
        kills: 0,
        damageDealt: 0,
        roundDied: null,
        roundFirstKill: null,
        killedBy: null,
      });
    }
  }
  return result;
}

function scoreTargetForAttacker(
  attacker: Combatant,
  target: Combatant,
  range: number,
  dmgTypeMods: Record<string, number>,
  classMods: Record<string, Record<string, Record<string, number>>>
): number {
  const attackerMnvr = resolveActualManeuverability(
    Math.max(0, Number(attacker.shipDetail.manoeuvrability ?? 0)), attacker.pilotingSkill
  );
  const defenderMnvr = resolveActualManeuverability(
    Math.max(0, Number(target.shipDetail.manoeuvrability ?? 0)), target.pilotingSkill
  );
  const lengthMod = resolveLengthModifier(attacker.shipDetail.length, target.shipDetail.length);
  const maneuverMod = resolveManeuverModifier(attackerMnvr, defenderMnvr);
  const targetArmor = Math.max(0, Number(target.shipDetail.armour ?? 0));
  const bearing = attacker.engagementBearing;
  const activeWeapons = bearing != null
    ? attacker.weapons.filter((w) => weaponCanFireAtBearing(w, bearing))
    : attacker.weapons;

  let score = 0;
  for (const weapon of activeWeapons) {
    const maxHits = weapon.weapon.max_hits == null || Number.isNaN(Number(weapon.weapon.max_hits))
      ? 1 : Math.max(1, Number(weapon.weapon.max_hits));
    const attackCount = weapon.quantity * maxHits;
    const weaponTracking = Math.max(1, Math.min(10, Number(weapon.weapon.tracking ?? 1)));
    const actualTracking = weaponTracking + attacker.combatSkill / 2;
    const hitChance = clamp01(baseHitChance(actualTracking, defenderMnvr) * rangeHitModifier(weapon.weapon, range) * lengthMod * maneuverMod);
    const dtMod = getDamageTypeModifier(weapon.weapon.damage_type, dmgTypeMods);
    const clsMod = getShipClassModifier(weapon.weapon.damage_type, attacker.shipDetail.class_name, target.shipDetail.class_name, classMods);
    const minDmg = Math.max(0, Number(weapon.weapon.min_damage ?? weapon.weapon.max_damage ?? 0));
    const maxDmg = Math.max(minDmg, Number(weapon.weapon.max_damage ?? weapon.weapon.min_damage ?? 0));
    const avgDmg = (minDmg + maxDmg) / 2;
    const fp = Math.max(0, Number(weapon.weapon.firepower ?? 0));
    const armorFactor = fp > 0 ? fp / (fp + targetArmor) : 1;
    score += attackCount * hitChance * avgDmg * armorFactor * dtMod * clsMod;
  }
  return score;
}

function pickTarget(
  attacker: Combatant,
  snapshot: Combatant[],
  targeting: "focus" | "random" | "optimal",
  range: number,
  dmgTypeMods: Record<string, number>,
  classMods: Record<string, Record<string, Record<string, number>>>,
  random: () => number
): Combatant | null {
  if (!snapshot.length) return null;
  if (targeting === "focus") return snapshot[0];
  if (targeting === "random") return snapshot[Math.floor(random() * snapshot.length)];
  let best: Combatant = snapshot[0];
  let bestScore = -1;
  for (const candidate of snapshot) {
    const s = scoreTargetForAttacker(attacker, candidate, range, dmgTypeMods, classMods);
    if (s > bestScore) { bestScore = s; best = candidate; }
  }
  return best;
}

function fireAttacker(
  attacker: Combatant,
  target: Combatant,
  range: number,
  dmgTypeMods: Record<string, number>,
  classMods: Record<string, Record<string, Record<string, number>>>,
  random: () => number,
  round: number
): number {
  if (!target.alive) return 0;
  let totalDamageDealt = 0;

  const attackerMnvr = resolveActualManeuverability(
    Math.max(0, Number(attacker.shipDetail.manoeuvrability ?? 0)), attacker.pilotingSkill
  );
  const defenderMnvr = resolveActualManeuverability(
    Math.max(0, Number(target.shipDetail.manoeuvrability ?? 0)), target.pilotingSkill
  );
  const lengthMod = resolveLengthModifier(attacker.shipDetail.length, target.shipDetail.length);
  const maneuverMod = resolveManeuverModifier(attackerMnvr, defenderMnvr);
  const targetArmor = Math.max(0, Number(target.shipDetail.armour ?? 0));
  const bearing = attacker.engagementBearing;
  const activeWeapons = bearing != null
    ? attacker.weapons.filter((w) => weaponCanFireAtBearing(w, bearing))
    : attacker.weapons;
  const hitArcKey = bearing != null ? bearingToShieldArcName(bearing) : null;
  const useArcShields = !!(hitArcKey && Object.keys(target.shieldByArc).length > 0);

  for (const weapon of activeWeapons) {
    // Respect fire delay — weapon only fires on rounds where (round - 1) % fireDelay === 0
    const fireDelay = Math.max(1, Number(weapon.weapon.fire_delay ?? 1));
    if ((round - 1) % fireDelay !== 0) continue;

    const maxHits = weapon.weapon.max_hits == null || Number.isNaN(Number(weapon.weapon.max_hits))
      ? 1 : Math.max(1, Number(weapon.weapon.max_hits));
    const attackCount = weapon.quantity * maxHits;
    const weaponTracking = Math.max(1, Math.min(10, Number(weapon.weapon.tracking ?? 1)));
    const actualTracking = weaponTracking + attacker.combatSkill / 2;
    const bHit = baseHitChance(actualTracking, defenderMnvr);
    const rMod = rangeHitModifier(weapon.weapon, range);
    const baseHit = clamp01(bHit * rMod * lengthMod * maneuverMod);
    const dtMod = getDamageTypeModifier(weapon.weapon.damage_type, dmgTypeMods);
    const clsMod = getShipClassModifier(weapon.weapon.damage_type, attacker.shipDetail.class_name, target.shipDetail.class_name, classMods);
    const minDmg = Math.max(0, Number(weapon.weapon.min_damage ?? weapon.weapon.max_damage ?? 0));
    const maxDmg = Math.max(minDmg, Number(weapon.weapon.max_damage ?? weapon.weapon.min_damage ?? 0));
    const ionic = isIonicDamageType(weapon.weapon.damage_type);

    for (let a = 0; a < attackCount; a++) {
      if (random() > baseHit) continue;
      const baseDmg = minDmg + (maxDmg - minDmg) * random();
      const reduced = applyArmorReduction(baseDmg, weapon.weapon.firepower, targetArmor);
      let dmg = reduced * dtMod * clsMod;
      if (dmg <= 0) continue;

      if (ionic) {
        const ionicDmg = Math.min(target.ionic, dmg);
        target.ionic = Math.max(0, target.ionic - dmg);
        totalDamageDealt += ionicDmg;
        continue;
      }

      if (useArcShields) {
        const arcShield = target.shieldByArc[hitArcKey!] ?? 0;
        if (arcShield > 0) {
          const sd = Math.min(arcShield, dmg);
          target.shieldByArc[hitArcKey!] = arcShield - sd;
          dmg -= sd;
          totalDamageDealt += sd;
        }
      } else {
        if (target.shield > 0) {
          const sd = Math.min(target.shield, dmg);
          target.shield -= sd;
          dmg -= sd;
          totalDamageDealt += sd;
        }
      }

      if (dmg > 0) {
        target.hull = Math.max(0, target.hull - dmg);
        target.killedBy = attacker;
        totalDamageDealt += dmg;
      }
    }
  }
  return totalDamageDealt;
}

function runOneBattle(
  slotsA: ResolvedSlot[],
  slotsB: ResolvedSlot[],
  targeting: "focus" | "random" | "optimal",
  range: number,
  dmgTypeMods: Record<string, number>,
  classMods: Record<string, Record<string, Record<string, number>>>,
  seed: number
): OneBattleResult {
  const sideA = expandCombatants(slotsA, "a");
  const sideB = expandCombatants(slotsB, "b");
  const rng = createSeededRandom(seed);
  const maxRounds = 9999;
  const isIonDisabled = (c: Combatant) =>
    Number(c.shipDetail.ionic_capacity ?? 0) > 0 && c.ionic <= 0;

  for (let round = 1; round <= maxRounds; round++) {
    const snapshotB = sideB.filter((c) => c.alive);
    const snapshotA = sideA.filter((c) => c.alive);

    for (const attacker of sideA) {
      if (!attacker.alive || isIonDisabled(attacker)) continue;
      const target = pickTarget(attacker, snapshotB, targeting, range, dmgTypeMods, classMods, rng);
      if (!target) continue;
      attacker.damageDealt += fireAttacker(attacker, target, range, dmgTypeMods, classMods, rng, round);
    }
    for (const attacker of sideB) {
      if (!attacker.alive || isIonDisabled(attacker)) continue;
      const target = pickTarget(attacker, snapshotA, targeting, range, dmgTypeMods, classMods, rng);
      if (!target) continue;
      attacker.damageDealt += fireAttacker(attacker, target, range, dmgTypeMods, classMods, rng, round);
    }

    for (const c of [...sideA, ...sideB]) {
      if (c.alive && c.hull <= 0) {
        c.alive = false;
        c.roundDied = round;
        if (c.killedBy) {
          c.killedBy.kills++;
          if (c.killedBy.roundFirstKill == null) c.killedBy.roundFirstKill = round;
        }
      }
    }

    const aAlive = sideA.filter((c) => c.alive).length;
    const bAlive = sideB.filter((c) => c.alive).length;
    if (aAlive === 0 || bAlive === 0) {
      const winner: OneBattleResult["winner"] =
        aAlive === 0 && bAlive === 0 ? "mutual" : bAlive === 0 ? "a" : "b";
      return { winner, rounds: round, survivors: [...sideA, ...sideB].filter((c) => c.alive), combatants: [...sideA, ...sideB] };
    }
  }

  return { winner: "stalemate", rounds: maxRounds, survivors: [...sideA, ...sideB].filter((c) => c.alive), combatants: [...sideA, ...sideB] };
}

function runSimulation(
  slotsA: ResolvedSlot[],
  slotsB: ResolvedSlot[],
  targeting: "focus" | "random" | "optimal",
  range: number,
  runs: number,
  dmgTypeMods: Record<string, number>,
  classMods: Record<string, Record<string, Record<string, number>>>
): AggregatedResults {
  const totalA = slotsA.reduce((s, sl) => s + sl.quantity, 0);
  const totalB = slotsB.reduce((s, sl) => s + sl.quantity, 0);
  let winA = 0, winB = 0, mutual = 0, stalemate = 0, totalRounds = 0;
  const allRounds: number[] = [];
  const roundDist = new Map<number, number>();
  const sampleRuns: OneBattleResult[] = [];

  type Acc = {
    kills: number; deaths: number; survivorCount: number;
    shieldSum: number; hullSum: number; ionicSum: number;
    damageDealtSum: number;
    roundsDiedSum: number; roundsDiedCount: number;
    firstKillSum: number; firstKillCount: number;
  };
  const accA = new Map<string, Acc>();
  const accB = new Map<string, Acc>();

  function getAcc(map: Map<string, Acc>, id: string): Acc {
    if (!map.has(id)) {
      map.set(id, { kills: 0, deaths: 0, survivorCount: 0, shieldSum: 0, hullSum: 0, ionicSum: 0, damageDealtSum: 0, roundsDiedSum: 0, roundsDiedCount: 0, firstKillSum: 0, firstKillCount: 0 });
    }
    return map.get(id)!;
  }

  const globalSeed = hashString(
    [...slotsA, ...slotsB].map((s) => `${s.id}:${s.shipUid}:${s.quantity}`).join("|") + `|${targeting}|${range}`
  );

  for (let run = 0; run < runs; run++) {
    const seed = hashString(`${globalSeed}|${run}`);
    const result = runOneBattle(slotsA, slotsB, targeting, range, dmgTypeMods, classMods, seed);

    if (result.winner === "a") winA++;
    else if (result.winner === "b") winB++;
    else if (result.winner === "mutual") mutual++;
    else stalemate++;

    totalRounds += result.rounds;
    allRounds.push(result.rounds);
    roundDist.set(result.rounds, (roundDist.get(result.rounds) ?? 0) + 1);

    for (const c of result.combatants) {
      const map = c.side === "a" ? accA : accB;
      const acc = getAcc(map, c.slotId);
      acc.kills += c.kills;
      acc.damageDealtSum += c.damageDealt;
      if (!c.alive) {
        acc.deaths++;
        if (c.roundDied != null) { acc.roundsDiedSum += c.roundDied; acc.roundsDiedCount++; }
      } else {
        acc.survivorCount++;
        acc.shieldSum += c.shield;
        acc.hullSum += c.hull;
        acc.ionicSum += c.ionic;
      }
      if (c.roundFirstKill != null) { acc.firstKillSum += c.roundFirstKill; acc.firstKillCount++; }
    }

    sampleRuns.push(result);
  }

  function buildSlots(slots: ResolvedSlot[], map: Map<string, Acc>, side: "a" | "b"): SlotAggregated[] {
    return slots.map((slot) => {
      const acc = map.get(slot.id) ?? { kills: 0, deaths: 0, survivorCount: 0, shieldSum: 0, hullSum: 0, ionicSum: 0, damageDealtSum: 0, roundsDiedSum: 0, roundsDiedCount: 0, firstKillSum: 0, firstKillCount: 0 };
      const total = slot.quantity * runs;
      const avgKills = total > 0 ? acc.kills / total : 0;
      const avgDeaths = total > 0 ? acc.deaths / total : 0;
      return {
        slotId: slot.id, side,
        shipName: slot.shipDetail.name ?? slot.shipUid,
        shipClass: slot.shipDetail.class_name ?? "Unknown",
        quantity: slot.quantity, totalInstances: total,
        avgKills, avgDeaths,
        kda: avgDeaths > 0 ? avgKills / avgDeaths : avgKills,
        surviveRate: total > 0 ? acc.survivorCount / total : 0,
        avgRemainingShield: acc.survivorCount > 0 ? acc.shieldSum / acc.survivorCount : 0,
        avgRemainingHull: acc.survivorCount > 0 ? acc.hullSum / acc.survivorCount : 0,
        avgRemainingIonic: acc.survivorCount > 0 ? acc.ionicSum / acc.survivorCount : 0,
        avgDmgPerRound: totalRounds > 0 ? acc.damageDealtSum / totalRounds : 0,
        maxShield: slot.shipDetail.shield ?? 0,
        maxHull: slot.shipDetail.hull ?? 0,
        avgRoundsDied: acc.roundsDiedCount > 0 ? acc.roundsDiedSum / acc.roundsDiedCount : null,
        avgRoundsFirstKill: acc.firstKillCount > 0 ? acc.firstKillSum / acc.firstKillCount : null,
      };
    });
  }

  const sorted = [...allRounds].sort((a, b) => a - b);
  const p90 = sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] ?? null : null;
  const totalADeaths = [...accA.values()].reduce((s, a) => s + a.deaths, 0);
  const totalBDeaths = [...accB.values()].reduce((s, a) => s + a.deaths, 0);

  return {
    runs,
    winRateA: runs > 0 ? winA / runs : 0,
    winRateB: runs > 0 ? winB / runs : 0,
    mutualKillRate: runs > 0 ? mutual / runs : 0,
    stalemateRate: runs > 0 ? stalemate / runs : 0,
    avgRounds: runs > 0 ? totalRounds / runs : 0,
    p90Rounds: p90,
    avgALossCount: runs > 0 ? totalADeaths / runs : 0,
    avgBLossCount: runs > 0 ? totalBDeaths / runs : 0,
    avgALossRate: totalA > 0 ? (totalADeaths / runs) / totalA : 0,
    avgBLossRate: totalB > 0 ? (totalBDeaths / runs) / totalB : 0,
    slots: [...buildSlots(slotsA, accA, "a"), ...buildSlots(slotsB, accB, "b")],
    roundDistribution: Array.from(roundDist.entries())
      .map(([round, count]) => ({ round, count, pct: runs > 0 ? count / runs : 0 }))
      .sort((a, b) => a.round - b.round),
    sampleRuns,
  };
}

// ─── Worker message handler ───────────────────────────────────────────────────

self.onmessage = (e: MessageEvent<SimWorkerRequest>) => {
  const msg = e.data;
  if (msg.type !== "run") return;
  try {
    const result = runSimulation(msg.slotsA, msg.slotsB, msg.targeting, msg.range, msg.runs, msg.dmgTypeMods, msg.classMods);
    self.postMessage({ type: "result", result } satisfies SimWorkerResponse);
  } catch (err) {
    self.postMessage({ type: "error", message: err instanceof Error ? err.message : String(err) } satisfies SimWorkerResponse);
  }
};
