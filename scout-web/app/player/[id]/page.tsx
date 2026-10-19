"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  getPlayerProfile,
  getPlayerRadar,
  getPlayerCareer,
  getPlayerTransfers,
  getPlayerNationalTeam,
  getPlayerSeasonStats,
  playerImageUrl,
  formatFee,
  BSD_IMG_BASE,
  type PlayerDetail,
  type PlayerCareerSeason,
  type PlayerTransfer,
  type PlayerSeasonStats,
} from "@/lib/api";
import RadarChart from "@/components/RadarChart";
import FollowButton from "@/components/FollowButton";

const PLAYER_FALLBACK =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%232C2C2C"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-7 8-7s8 3 8 7"/></svg>';

type Tab = "overview" | "stats" | "career" | "transfers";

// Each section loads independently. A `null` means still loading, an
// empty array means loaded-and-genuinely-empty, and `degraded` means the
// fetch itself came back with nothing. Those three render differently --
// the whole point is that a player page never says "no career" because
// one request failed.
type Loadable<T> = { data: T | null; degraded: boolean; failed: boolean };

const pending = <T,>(): Loadable<T> => ({ data: null, degraded: false, failed: false });

function teamBadge(teamId: number | null | undefined): string | null {
  if (teamId == null) return null;
  return `${BSD_IMG_BASE}/img/team/${teamId}/?sor=true&bg=transparent`;
}

/** Shared empty/error/loading line, so every section says the same thing
 *  in the same words rather than three variations of "no data". */
function SectionState({
  state,
  emptyLabel,
}: {
  state: Loadable<any[]>;
  emptyLabel: string;
}) {
  if (state.failed || state.degraded)
    return <p className="text-mt text-sm">Couldn&apos;t load this right now.</p>;
  if (state.data === null) return <p className="text-mt text-sm">Loading...</p>;
  return <p className="text-mt text-sm">{emptyLabel}</p>;
}

export default function PlayerPage() {
  const params = useParams();
  const id = Number(params.id);

  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [radar, setRadar] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");

  const [career, setCareer] = useState<Loadable<PlayerCareerSeason[]>>(pending);
  const [transfers, setTransfers] = useState<Loadable<PlayerTransfer[]>>(pending);
  const [national, setNational] = useState<Loadable<any[]>>(pending);
  const [seasonStats, setSeasonStats] = useState<PlayerSeasonStats | null>(null);
  const [seasonFailed, setSeasonFailed] = useState(false);
  const [season, setSeason] = useState<string | undefined>(undefined);

  // The profile gates the page -- without a name and a photo there is
  // nothing to show. Everything else is additive and must not be able to
  // take the page down with it, so each one catches its own failure.
  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);

    getPlayerProfile(id)
      .then((p) => {
        setPlayer(p);
        setError(null);
      })
      .catch((err) => setError(err.message || "Failed to load player."))
      .finally(() => setLoading(false));

    getPlayerRadar(id, undefined, 50)
      .then((r) => setRadar(r?.radar ?? null))
      .catch(() => setRadar(null));

    getPlayerCareer(id)
      .then((r) => setCareer({ data: r.seasons || [], degraded: !!r.degraded, failed: false }))
      .catch(() => setCareer({ data: [], degraded: false, failed: true }));

    getPlayerTransfers(id)
      .then((r) => setTransfers({ data: r.transfers || [], degraded: !!r.degraded, failed: false }))
      .catch(() => setTransfers({ data: [], degraded: false, failed: true }));

    getPlayerNationalTeam(id)
      .then((r) => {
        // The backend hands back a list or an object depending on BSD's
        // shape, which the docs don't pin down. Take whichever is filled.
        const rows = (r.teams && r.teams.length ? r.teams : null) ?? (r.summary ? [r.summary] : []);
        setNational({ data: rows, degraded: !!r.degraded, failed: false });
      })
      .catch(() => setNational({ data: [], degraded: false, failed: true }));
  }, [id]);

  // Season totals refetch when the dropdown changes.
  useEffect(() => {
    if (isNaN(id)) return;
    setSeasonFailed(false);
    getPlayerSeasonStats(id, season)
      .then(setSeasonStats)
      .catch(() => setSeasonFailed(true));
  }, [id, season]);

  if (loading) return <p className="text-mt text-sm p-4">Loading player...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!player) return null;

  const age = player.date_of_birth
    ? Math.floor((Date.now() - new Date(player.date_of_birth).getTime()) / 31557600000)
    : null;

  const TABS: { key: Tab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "stats", label: "Stats" },
    { key: "career", label: "Career" },
    { key: "transfers", label: "Transfers" },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={playerImageUrl(player.id) || ""}
              alt={player.name}
              className="w-20 h-20 rounded-full object-cover bg-bg2 shrink-0"
              onError={(e) => {
                e.currentTarget.src = PLAYER_FALLBACK;
              }}
            />
            <div className="min-w-0">
              <h1 className="font-display font-black text-2xl text-white truncate">
                {player.name}
              </h1>
              <p className="text-mt text-sm mt-1">
                {[player.nationality, player.position].filter(Boolean).join(" • ") || "—"}
              </p>
              {player.current_team && (
                <Link
                  href={`/team/${player.current_team.id}`}
                  className="inline-flex items-center gap-2 mt-2 text-volt2 text-sm hover:underline"
                >
                  {teamBadge(player.current_team.id) && (
                    <img
                      src={teamBadge(player.current_team.id)!}
                      alt=""
                      className="w-4 h-4 object-contain"
                    />
                  )}
                  {player.current_team.name}
                </Link>
              )}
            </div>
          </div>
          <FollowButton entityType="player" entityId={player.id} entityName={player.name} />
        </div>

        {/* Key numbers, FotMob-style strip. Rating and market value are
            the two things people look for first, so they lead. A value
            BSD didn't publish shows an em-rule, never a zero. */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-bd">
          <StatPill label="Rating" value={player.rating != null ? Number(player.rating).toFixed(2) : null} accent />
          <StatPill
            label="Market value"
            value={player.market_value_eur != null ? formatFee(player.market_value_eur) : null}
          />
          <StatPill label="Age" value={age != null ? String(age) : null} />
          <StatPill label="Shirt" value={player.jersey_number != null ? `#${player.jersey_number}` : null} />
        </div>
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={clsx("tab-pill shrink-0", tab === t.key ? "tab-pill-active" : "tab-pill-inactive")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Overview ────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card">
            <h2 className="section-label mb-4">Player info</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
              <InfoRow label="Height" value={player.height_cm ? `${player.height_cm} cm` : null} />
              <InfoRow label="Weight" value={player.weight_kg ? `${player.weight_kg} kg` : null} />
              <InfoRow label="Preferred foot" value={player.preferred_foot} />
              <InfoRow label="Nationality" value={player.nationality} />
              <InfoRow
                label="Date of birth"
                value={
                  player.date_of_birth
                    ? new Date(player.date_of_birth).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : null
                }
              />
              <InfoRow label="Contract until" value={player.contract_until} />
            </dl>
          </div>

          <div className="card">
            <h2 className="section-label mb-4">Season performance</h2>
            {radar ? (
              <div className="flex justify-center">
                <RadarChart
                  playerA={{ name: player.short_name || player.name, values: radar }}
                  playerB={null}
                />
              </div>
            ) : (
              <p className="text-mt text-sm h-32 flex items-center justify-center">
                Not enough data for a radar yet.
              </p>
            )}
          </div>

          {/* International record. Shape is unconfirmed in BSD's docs, so
              this renders whatever fields each row actually has instead
              of assuming a schema and printing blanks. */}
          <div className="card md:col-span-2">
            <h2 className="section-label mb-4">International</h2>
            {national.data && national.data.length > 0 ? (
              <div className="space-y-2">
                {national.data.map((n: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between gap-3 py-2 border-b border-bd last:border-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {teamBadge(n.team_id ?? n.national_team_id) && (
                        <img
                          src={teamBadge(n.team_id ?? n.national_team_id)!}
                          alt=""
                          className="w-5 h-5 object-contain shrink-0"
                        />
                      )}
                      <span className="text-white text-sm truncate">
                        {n.team_name ?? n.name ?? player.nationality ?? "National team"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm shrink-0">
                      {n.appearances != null && (
                        <span className="text-mt">
                          <span className="text-white font-semibold">{n.appearances}</span> caps
                        </span>
                      )}
                      {n.goals != null && (
                        <span className="text-mt">
                          <span className="text-white font-semibold">{n.goals}</span> goals
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <SectionState state={national} emptyLabel="No international record on file." />
            )}
          </div>
        </div>
      )}

      {/* ── Stats ───────────────────────────────────────────────── */}
      {tab === "stats" && (
        <div className="space-y-4">
          <div className="card">
            <div className="flex items-center justify-between gap-4 mb-4">
              <h2 className="section-label">Season totals</h2>
              {seasonStats && seasonStats.seasons_available.length > 1 && (
                <select
                  className="input-select max-w-[180px]"
                  value={season ?? seasonStats.season ?? ""}
                  onChange={(e) => setSeason(e.target.value || undefined)}
                >
                  {seasonStats.seasons_available.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {seasonFailed ? (
              <p className="text-mt text-sm">Couldn&apos;t load this right now.</p>
            ) : !seasonStats ? (
              <p className="text-mt text-sm">Loading...</p>
            ) : seasonStats.totals.appearances ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Only the keys BSD actually reported. A stat it didn't
                    send comes back null from the backend and is skipped
                    rather than shown as 0 -- a midfielder with no `saves`
                    hasn't made zero saves, the field just isn't his. */}
                {STAT_FIELDS.filter(([k]) => seasonStats.totals[k] != null).map(([k, label]) => (
                  <StatPill key={k} label={label} value={String(seasonStats.totals[k])} />
                ))}
              </div>
            ) : (
              <p className="text-mt text-sm">No match data for this season.</p>
            )}
          </div>

          <div className="card">
            <h2 className="section-label mb-4">Recent matches</h2>
            {seasonStats?.recent_matches?.length ? (
              <div className="space-y-1">
                {seasonStats.recent_matches.map((m: any, i: number) => {
                  const inner = (
                    <>
                      <div className="flex items-center gap-2 min-w-0">
                        {teamBadge(m.team_id) && (
                          <img src={teamBadge(m.team_id)!} alt="" className="w-5 h-5 object-contain shrink-0" />
                        )}
                        <span className="text-white/90 text-xs truncate">
                          {m.opponent_name ?? m.league_name ?? `Match ${m.event_id ?? i + 1}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 shrink-0 font-mono text-[11px]">
                        {m.minutes_played != null && <span className="text-mt">{m.minutes_played}&apos;</span>}
                        {!!m.goals && <span className="text-volt">{m.goals}G</span>}
                        {!!m.assists && <span className="text-cyan">{m.assists}A</span>}
                        {m.rating != null && (
                          <span className="text-white font-semibold">{Number(m.rating).toFixed(1)}</span>
                        )}
                      </div>
                    </>
                  );

                  // Only link where we actually have a match id.
                  return m.event_id ? (
                    <Link
                      key={i}
                      href={`/match/${m.event_id}`}
                      className="flex items-center justify-between gap-3 py-2 -mx-2 px-2 rounded hover:bg-sur2/60 transition-colors"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div key={i} className="flex items-center justify-between gap-3 py-2">
                      {inner}
                    </div>
                  );
                })}
              </div>
            ) : seasonFailed ? (
              <p className="text-mt text-sm">Couldn&apos;t load this right now.</p>
            ) : !seasonStats ? (
              <p className="text-mt text-sm">Loading...</p>
            ) : (
              <p className="text-mt text-sm">No recent matches.</p>
            )}
          </div>
        </div>
      )}

      {/* ── Career ──────────────────────────────────────────────── */}
      {tab === "career" && (
        <div className="card">
          <h2 className="section-label mb-4">Career history</h2>
          {career.data && career.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-mt text-[11px] uppercase tracking-wider">
                    <th className="text-left font-semibold pb-2">Season</th>
                    <th className="text-left font-semibold pb-2">Club</th>
                    <th className="text-right font-semibold pb-2">Apps</th>
                    <th className="text-right font-semibold pb-2">Goals</th>
                    <th className="text-right font-semibold pb-2">Assists</th>
                  </tr>
                </thead>
                <tbody>
                  {career.data.map((s, i) => (
                    <tr key={i} className="border-t border-bd">
                      <td className="py-2.5 text-white/90 font-mono text-xs whitespace-nowrap">
                        {s.season ?? s.season_name ?? "—"}
                      </td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {teamBadge(s.team_id) && (
                            <img src={teamBadge(s.team_id)!} alt="" className="w-4 h-4 object-contain shrink-0" />
                          )}
                          {s.team_id ? (
                            <Link href={`/team/${s.team_id}`} className="text-white hover:text-volt2 truncate">
                              {s.team_name ?? "—"}
                            </Link>
                          ) : (
                            <span className="text-white truncate">{s.team_name ?? "—"}</span>
                          )}
                        </div>
                        {s.league_name && (
                          <span className="text-mt text-[11px]">{s.league_name}</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-white/90 font-mono text-xs">
                        {s.appearances ?? "—"}
                      </td>
                      <td className="py-2.5 text-right text-volt font-mono text-xs">{s.goals ?? "—"}</td>
                      <td className="py-2.5 text-right text-cyan font-mono text-xs">{s.assists ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <SectionState state={career} emptyLabel="No career history on file." />
          )}
        </div>
      )}

      {/* ── Transfers ───────────────────────────────────────────── */}
      {tab === "transfers" && (
        <div className="card">
          <h2 className="section-label mb-4">Transfer history</h2>
          {transfers.data && transfers.data.length > 0 ? (
            <div className="space-y-3">
              {transfers.data.map((t, i) => {
                const when = t.date ?? t.transfer_date;
                return (
                  <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-bd last:border-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm min-w-0">
                        <span className="text-mt truncate">{t.from_team_name ?? "—"}</span>
                        <span className="text-volt shrink-0">→</span>
                        <span className="text-white truncate">{t.to_team_name ?? "—"}</span>
                      </div>
                      <p className="text-mt text-[11px] mt-1 font-mono">
                        {when
                          ? new Date(when).toLocaleDateString("en-GB", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : "—"}
                        {t.transfer_type ? ` • ${t.transfer_type}` : ""}
                      </p>
                    </div>
                    {/* formatFee prints "Undisclosed" for a null fee and
                        "Free" only for a real published zero. */}
                    <span className="text-white font-semibold text-sm shrink-0 font-mono">
                      {formatFee(t.fee_eur)}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <SectionState state={transfers} emptyLabel="No transfers on file." />
          )}
        </div>
      )}
    </div>
  );
}

// Order matters -- this is the order they appear in the stats grid.
const STAT_FIELDS: [string, string][] = [
  ["appearances", "Apps"],
  ["minutes_played", "Minutes"],
  ["goals", "Goals"],
  ["assists", "Assists"],
  ["shots", "Shots"],
  ["shots_on_target", "On target"],
  ["passes", "Passes"],
  ["key_passes", "Key passes"],
  ["tackles", "Tackles"],
  ["interceptions", "Interceptions"],
  ["duels_won", "Duels won"],
  ["saves", "Saves"],
  ["yellow_cards", "Yellows"],
  ["red_cards", "Reds"],
];

function StatPill({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="bg-sur2 border border-bd rounded-lg px-3 py-2.5">
      <p className="text-mt text-[10px] uppercase tracking-wider">{label}</p>
      <p
        className={clsx(
          "mt-1 font-display font-black text-lg leading-none",
          accent ? "text-volt" : "text-white"
        )}
      >
        {value ?? <span className="text-mt font-body font-normal text-sm">&mdash;</span>}
      </p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-mt text-xs uppercase tracking-wide">{label}</dt>
      <dd className="text-white mt-1">{value || <span className="text-mt">&mdash;</span>}</dd>
    </div>
  );
}
