export type PosGroup = "GK" | "DEF" | "MID" | "FWD";

export type FormationSlot = {
  index: number;
  role: string;
  group: PosGroup;
};

export const FORMATIONS: Record<string, FormationSlot[]> = {
  "4-3-3": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LB", group: "DEF" },
    { index: 2, role: "LCB", group: "DEF" },
    { index: 3, role: "RCB", group: "DEF" },
    { index: 4, role: "RB", group: "DEF" },
    { index: 5, role: "CDM", group: "MID" },
    { index: 6, role: "LCM", group: "MID" },
    { index: 7, role: "RCM", group: "MID" },
    { index: 8, role: "LW", group: "FWD" },
    { index: 9, role: "ST", group: "FWD" },
    { index: 10, role: "RW", group: "FWD" },
  ],
  "4-4-2": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LB", group: "DEF" },
    { index: 2, role: "LCB", group: "DEF" },
    { index: 3, role: "RCB", group: "DEF" },
    { index: 4, role: "RB", group: "DEF" },
    { index: 5, role: "LM", group: "MID" },
    { index: 6, role: "LCM", group: "MID" },
    { index: 7, role: "RCM", group: "MID" },
    { index: 8, role: "RM", group: "MID" },
    { index: 9, role: "LS", group: "FWD" },
    { index: 10, role: "RS", group: "FWD" },
  ],
  "4-2-3-1": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LB", group: "DEF" },
    { index: 2, role: "LCB", group: "DEF" },
    { index: 3, role: "RCB", group: "DEF" },
    { index: 4, role: "RB", group: "DEF" },
    { index: 5, role: "LDM", group: "MID" },
    { index: 6, role: "RDM", group: "MID" },
    { index: 7, role: "LAM", group: "MID" },
    { index: 8, role: "CAM", group: "MID" },
    { index: 9, role: "RAM", group: "MID" },
    { index: 10, role: "ST", group: "FWD" },
  ],
  "3-5-2": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LCB", group: "DEF" },
    { index: 2, role: "CB", group: "DEF" },
    { index: 3, role: "RCB", group: "DEF" },
    { index: 4, role: "LWB", group: "MID" },
    { index: 5, role: "LCM", group: "MID" },
    { index: 6, role: "CDM", group: "MID" },
    { index: 7, role: "RCM", group: "MID" },
    { index: 8, role: "RWB", group: "MID" },
    { index: 9, role: "LS", group: "FWD" },
    { index: 10, role: "RS", group: "FWD" },
  ],
  "3-4-3": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LCB", group: "DEF" },
    { index: 2, role: "CB", group: "DEF" },
    { index: 3, role: "RCB", group: "DEF" },
    { index: 4, role: "LM", group: "MID" },
    { index: 5, role: "LCM", group: "MID" },
    { index: 6, role: "RCM", group: "MID" },
    { index: 7, role: "RM", group: "MID" },
    { index: 8, role: "LW", group: "FWD" },
    { index: 9, role: "ST", group: "FWD" },
    { index: 10, role: "RW", group: "FWD" },
  ],
  "5-3-2": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LWB", group: "DEF" },
    { index: 2, role: "LCB", group: "DEF" },
    { index: 3, role: "CB", group: "DEF" },
    { index: 4, role: "RCB", group: "DEF" },
    { index: 5, role: "RWB", group: "DEF" },
    { index: 6, role: "LCM", group: "MID" },
    { index: 7, role: "CM", group: "MID" },
    { index: 8, role: "RCM", group: "MID" },
    { index: 9, role: "LS", group: "FWD" },
    { index: 10, role: "RS", group: "FWD" },
  ],
  "4-1-4-1": [
    { index: 0, role: "GK", group: "GK" },
    { index: 1, role: "LB", group: "DEF" },
    { index: 2, role: "LCB", group: "DEF" },
    { index: 3, role: "RCB", group: "DEF" },
    { index: 4, role: "RB", group: "DEF" },
    { index: 5, role: "CDM", group: "MID" },
    { index: 6, role: "LM", group: "MID" },
    { index: 7, role: "LCM", group: "MID" },
    { index: 8, role: "RCM", group: "MID" },
    { index: 9, role: "RM", group: "MID" },
    { index: 10, role: "ST", group: "FWD" },
  ],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

export function normalizePosGroup(pos?: string | null): PosGroup {
  const p = String(pos || "").toUpperCase().trim();
  if (p.startsWith("G")) return "GK";
  if (p.includes("B") || p.startsWith("D")) return "DEF";
  if (p.includes("W") || p.startsWith("F") || p === "ST" || p === "CF" || p === "LS" || p === "RS") return "FWD";
  return "MID";
}

export const POS_GROUP_LABELS: Record<PosGroup, string> = {
  GK: "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};
