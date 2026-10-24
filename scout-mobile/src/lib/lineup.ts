/**
 * src/lib/lineup.ts
 *
 * Lineup layout, shared by the BSD match screen's pitch and the local
 * competition match screen. In its own module because both import it: having the ratings
 * tab pull these out of MatchDetailScreen, which imports the ratings
 * tab, is a require cycle that Metro resolves to undefined at runtime.
 */

/** Outfield row sizes from a formation label: "4-2-3-1" or "4231". */
export function parseFormation(formation: unknown): number[] | null {
  const raw = String(formation ?? '').trim();
  if (!raw) return null;
  const parts = raw.includes('-') ? raw.split('-') : raw.split('');
  const rows = parts.map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (rows.length < 2) return null;
  if (rows.reduce((a, b) => a + b, 0) !== 10) return null;   // outfield only
  return rows;
}

const posRank = (p: any) => {
  const pos = String(p?.position ?? '').toUpperCase();
  if (pos.startsWith('G')) return 0;
  if (pos.startsWith('D')) return 1;
  if (pos.startsWith('M')) return 2;
  return 3;
};

/**
 * Lay the XI out in rows, keeper first.
 *
 * The formation label drives the shape. Bucketing by each player's
 * position string instead is what made a 4-2-3-1 render as a 4-5-1:
 * the two holders and the three attacking midfielders all carry
 * position "M", so they collapsed into a single row of five.
 *
 * Falls back to position buckets when the label is missing or doesn't
 * add up to ten outfield players, so a bad label degrades rather than
 * dropping anyone.
 */
export function buildLineupRows(players: any[], formation: unknown): any[][] {
  const ordered = players.slice().sort((a, b) => posRank(a) - posRank(b));
  const shape = parseFormation(formation);

  if (shape && ordered.length === 11) {
    const rows: any[][] = [[ordered[0]]];
    let i = 1;
    for (const n of shape) { rows.push(ordered.slice(i, i + n)); i += n; }
    return rows;
  }

  const buckets: any[][] = [[], [], [], []];
  for (const p of ordered) buckets[posRank(p)].push(p);
  return buckets.filter((r) => r.length > 0);
}

/**
 * How wide a row sits.
 *
 * A two-man pivot spread to full width ends up standing where the
 * full-backs should be, so narrow rows stay central and only a back
 * four or a midfield five spans the pitch.
 */
export function lineupRowWidth(n: number): any {
  if (n <= 1) return '42%';
  if (n === 2) return '62%';
  if (n === 3) return '86%';
  return '100%';
}

/**
 * BSD returns the id as `player_id` on lineup entries, so testing
 * `p.id` alone is why tapping a player did nothing.
 */
export function lineupPlayerId(p: any): number | string | null {
  const direct = p?.player_id ?? p?.id ?? null;
  if (direct != null) return direct;
  if (p?.player && typeof p.player === 'object') return p.player.id ?? null;
  return null;
}
