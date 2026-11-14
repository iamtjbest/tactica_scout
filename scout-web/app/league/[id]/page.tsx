"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  getStandings,
  getLeagueSeasons,
  getLeagueFixtures,
  getLeagueTopStats,
  getLeagueTeamStats,
  BSD_IMG_BASE,
  type StandingsRow,
  type StandingsGroup,
  type LeagueSeason,
} from "@/lib/api";
import FollowButton from "@/components/FollowButton";
import StandingsTable from "@/components/StandingsTable";
import MatchCard from "@/components/MatchCard";

type LeagueTab = "table" | "fixtures" | "player-stats" | "team-stats" | "season";

const TABS: { id: LeagueTab; label: string }[] = [
  { id: "table",        label: "Table" },
  { id: "fixtures",     label: "Fixtures" },
  { id: "player-stats", label: "Player Stats" },
  { id: "team-stats",   label: "Team Stats" },
  { id: "season",       label: "Season" },
];

export default function LeaguePage() {
  const params = useParams();
  const id = Number(params.id);

  const [seasons, setSeasons] = useState<LeagueSeason[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null);
  const [selectedSeasonLabel, setSelectedSeasonLabel] = useState<string>("");

  const [rows, setRows] = useState<StandingsRow[] | null>(null);
  const [groups, setGroups] = useState<StandingsGroup[] | null>(null);
  const [leagueName, setLeagueName] = useState("");
  const [country, setCountry] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<LeagueTab>("table");

  // 1. Load available seasons & real league metadata
  useEffect(() => {
    if (isNaN(id)) return;
    getLeagueSeasons(id)
      .then((res) => {
        if (res.league) setLeagueName(res.league);
        if (res.country) setCountry(res.country);
        const list = res.seasons || [];
        setSeasons(list);
        if (list.length > 0) {
          const cur = list.find((s) => s.is_current) || list[0];
          setSelectedSeasonId(cur.id);
          setSelectedSeasonLabel(cur.label);
        }
      })
      .catch(() => {});
  }, [id]);

  // 2. Load standings whenever league or selected season changes
  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);
    getStandings(id, selectedSeasonId)
      .then((d) => {
        setRows(d.standings);
        setGroups(d.groups);
        if (d.league && d.league !== "Unknown") setLeagueName(d.league);
        if (d.country) setCountry(d.country);
        setError(null);
      })
      .catch((e) => setError(e.message || "Failed to load league."))
      .finally(() => setLoading(false));
  }, [id, selectedSeasonId]);

  const handleSelectSeason = (s: LeagueSeason) => {
    setSelectedSeasonId(s.id);
    setSelectedSeasonLabel(s.label);
  };

  const isEmpty = !rows?.length && !groups?.length;

  return (
    <div className="space-y-5">
      {/* Header Card */}
      <div className="card flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-sur2 border border-bd flex items-center justify-center font-display font-black text-volt text-lg shrink-0">
            {(leagueName || "LG").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display font-black text-2xl text-white truncate">
                {leagueName || "Competition"}
              </h1>
              <FollowButton
                entityType="league"
                entityId={id}
                entityName={leagueName || `League #${id}`}
              />
            </div>
            {country && (
              <p className="text-mt text-xs font-mono uppercase tracking-wider mt-1">
                {country}
              </p>
            )}
          </div>
        </div>

        {/* Clickable Season Year Dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-mt text-[11px] font-mono uppercase">Season</label>
          <select
            value={selectedSeasonLabel}
            onChange={(e) => {
              const found = seasons.find((s) => s.label === e.target.value);
              if (found) handleSelectSeason(found);
            }}
            className="bg-sur2 border border-volt/40 rounded-lg px-3 py-1.5 font-mono text-xs text-volt font-bold focus:outline-none focus:border-volt cursor-pointer"
          >
            {seasons.length > 0 ? (
              seasons.map((s) => (
                <option key={s.label} value={s.label}>
                  {s.label}{s.is_current ? " (Current)" : ""}
                </option>
              ))
            ) : (
              <option value="2026/2027">2026/2027</option>
            )}
          </select>
        </div>
      </div>

      {/* 5 Complete Tabs */}
      <div className="flex gap-4 border-b border-bd/50 overflow-x-auto no-scrollbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={clsx(
              "pb-2.5 text-sm font-semibold whitespace-nowrap transition-colors",
              activeTab === t.id
                ? "text-volt2 border-b-2 border-volt2"
                : "text-mt hover:text-white"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-red2 text-sm font-semibold">{error}</p>}

      {/* TAB 1: TABLE */}
      {activeTab === "table" && (
        loading ? (
          <p className="text-mt text-sm p-4">Loading table...</p>
        ) : (
          <>
            {groups && groups.length > 0 && (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.group} className="card overflow-x-auto">
                    <p className="text-volt text-xs font-mono uppercase tracking-wide mb-2">
                      {g.group}
                    </p>
                    <StandingsTable rows={g.standings} />
                  </div>
                ))}
              </div>
            )}
            {rows && rows.length > 0 && (
              <div className="card overflow-x-auto">
                <div className="flex items-center justify-between mb-3">
                  <p className="section-label">{leagueName} · {selectedSeasonLabel}</p>
                </div>
                <StandingsTable rows={rows} />
              </div>
            )}
            {isEmpty && !error && (
              <p className="text-mt text-sm">No standings available for {selectedSeasonLabel}.</p>
            )}
          </>
        )
      )}

      {/* TAB 2: FIXTURES (Filtered by Date, Month, Year & Status) */}
      {activeTab === "fixtures" && (
        <LeagueFixturesTab leagueId={id} seasonId={selectedSeasonId} />
      )}

      {/* TAB 3: PLAYER STATS (Scorers, Assists, Ratings, Discipline) */}
      {activeTab === "player-stats" && (
        <LeaguePlayerStatsTab leagueId={id} seasonId={selectedSeasonId} />
      )}

      {/* TAB 4: TEAM STATS (Goals/Match, Conceded/Match, Clean Sheets, Win Rate, Possession) */}
      {activeTab === "team-stats" && (
        <LeagueTeamStatsTab leagueId={id} seasonId={selectedSeasonId} />
      )}

      {/* TAB 5: SEASON (Previous Winners & Historical Years) */}
      {activeTab === "season" && (
        <LeagueSeasonHistoryTab
          seasons={seasons}
          activeLabel={selectedSeasonLabel}
          onSelectSeason={(s) => {
            handleSelectSeason(s);
            setActiveTab("table");
          }}
        />
      )}
    </div>
  );
}

/* ── TAB 2: FIXTURES (DATE + MONTH + YEAR FILTERING) ─────────────────── */
function LeagueFixturesTab({
  leagueId,
  seasonId,
}: {
  leagueId: number;
  seasonId: number | null;
}) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [exactDate, setExactDate] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "upcoming" | "finished" | "live">("all");

  useEffect(() => {
    setLoading(true);
    getLeagueFixtures(leagueId, seasonId)
      .then((data) => setMatches(data.matches || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [leagueId, seasonId]);

  if (loading) return <p className="text-mt text-sm p-4">Loading fixtures...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (matches.length === 0) return <p className="text-mt text-sm p-4">No fixtures found.</p>;

  const years = Array.from(
    new Set(
      matches
        .map((m) => String(m.kickoff || "").slice(0, 4))
        .filter((y) => /^\d{4}$/.test(y))
    )
  ).sort();

  const MONTHS = [
    { val: "01", label: "January" }, { val: "02", label: "February" },
    { val: "03", label: "March" },   { val: "04", label: "April" },
    { val: "05", label: "May" },     { val: "06", label: "June" },
    { val: "07", label: "July" },    { val: "08", label: "August" },
    { val: "09", label: "September" },{ val: "10", label: "October" },
    { val: "11", label: "November" },{ val: "12", label: "December" },
  ];

  const filtered = matches.filter((m) => {
    const iso = String(m.kickoff || "");
    const dObj = new Date(iso);
    if (isNaN(dObj.getTime())) return false;

    const localY = String(dObj.getFullYear());
    const localM = String(dObj.getMonth() + 1).padStart(2, "0");
    const localD = `${localY}-${localM}-${String(dObj.getDate()).padStart(2, "0")}`;

    if (exactDate && localD !== exactDate) return false;
    if (yearFilter && localY !== yearFilter) return false;
    if (monthFilter && localM !== monthFilter) return false;

    const st = String(m.status || "").toLowerCase();
    const isFin = ["finished", "ended", "played", "ft"].includes(st);
    const isUpc = ["scheduled", "notstarted", "postponed", "cancelled", "delayed", "tbd"].includes(st);
    const isLiv = !isFin && !isUpc;

    if (statusFilter === "finished" && !isFin) return false;
    if (statusFilter === "upcoming" && !isUpc) return false;
    if (statusFilter === "live" && !isLiv) return false;

    return true;
  });

  // Group by FULL DATE (Day + Month + Year) instead of just Month + Year
  const groupedByDate: Record<string, any[]> = {};
  filtered
    .slice()
    .sort((a, b) => String(a.kickoff || "").localeCompare(String(b.kickoff || "")))
    .forEach((m) => {
      const d = new Date(m.kickoff);
      const dayKey = d.toLocaleDateString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
      (groupedByDate[dayKey] ||= []).push(m);
    });

  const hasActiveFilter = Boolean(exactDate || monthFilter || yearFilter || statusFilter !== "all");

  return (
    <div className="space-y-4">
      {/* Date, Month, Year & Status Filter Bar */}
      <div className="card flex flex-wrap items-center gap-2.5">
        <input
          type="date"
          value={exactDate}
          onChange={(e) => setExactDate(e.target.value)}
          className="input-select w-auto text-xs"
          aria-label="Filter by exact date"
        />

        <select
          value={monthFilter}
          onChange={(e) => setMonthFilter(e.target.value)}
          className="input-select w-auto text-xs"
        >
          <option value="">All months</option>
          {MONTHS.map((m) => (
            <option key={m.val} value={m.val}>{m.label}</option>
          ))}
        </select>

        <select
          value={yearFilter}
          onChange={(e) => setYearFilter(e.target.value)}
          className="input-select w-auto text-xs"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="input-select w-auto text-xs"
        >
          <option value="all">All statuses</option>
          <option value="live">Live</option>
          <option value="upcoming">Upcoming</option>
          <option value="finished">Finished</option>
        </select>

        {hasActiveFilter && (
          <button
            onClick={() => {
              setExactDate("");
              setMonthFilter("");
              setYearFilter("");
              setStatusFilter("all");
            }}
            className="text-volt text-xs font-semibold hover:underline ml-auto"
          >
            Reset filters
          </button>
        )}
      </div>

      {Object.keys(groupedByDate).length === 0 ? (
        <div className="card text-center py-8">
          <p className="text-mt text-sm">No fixtures match that date/month/year filter.</p>
        </div>
      ) : (
        Object.keys(groupedByDate).map((dateHeading) => (
          <div key={dateHeading} className="space-y-2">
            <h3 className="section-label sticky top-14 bg-bg/95 py-2 backdrop-blur-sm z-10">
              {dateHeading}
            </h3>
            {groupedByDate[dateHeading].map((m) => (
              <MatchCard key={m.event_id} match={m} />
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/* ── TAB 3: PLAYER STATS (SCORERS, ASSISTS, RATINGS, CARDS) ──────────── */
function LeaguePlayerStatsTab({
  leagueId,
  seasonId,
}: {
  leagueId: number;
  seasonId: number | null;
}) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getLeagueTopStats(leagueId, seasonId)
      .then(setStats)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [leagueId, seasonId]);

  if (loading) return <p className="text-mt text-sm p-4">Loading player stats...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!stats) return null;

  const boards = [
    { title: "Top Goalscorers", metric: "Goals", rows: stats.scorers || [] },
    { title: "Top Assists", metric: "Assists", rows: stats.assists || [] },
    { title: "Highest Rated Players", metric: "Rating", rows: stats.ratings || [] },
    { title: "Discipline (Cards)", metric: "Cards", rows: stats.cards || [] },
  ].filter((b) => b.rows.length > 0);

  if (boards.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-mt text-sm">No player statistics published for this season yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {boards.map((board) => (
        <div key={board.title} className="card overflow-x-auto">
          <p className="section-label mb-3">{board.title}</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-mt text-[11px] uppercase tracking-wide border-b border-bd">
                <th className="py-2 pr-2 text-left font-semibold">#</th>
                <th className="py-2 pr-2 text-left font-semibold">Player</th>
                <th className="py-2 pr-2 text-left font-semibold">Team</th>
                <th className="py-2 text-right font-semibold">{board.metric}</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.slice(0, 15).map((p: any, i: number) => (
                <tr
                  key={`${board.title}-${p.player_id ?? i}`}
                  className="border-b border-bd/50 last:border-0 hover:bg-white/5 transition-colors"
                >
                  <td className="py-2 pr-2 text-mt font-mono text-xs w-7">{p.rank ?? i + 1}</td>
                  <td className="py-2 pr-2">
                    {p.player_id ? (
                      <Link
                        href={`/player/${p.player_id}`}
                        className="text-white font-semibold hover:text-volt2 transition-colors"
                      >
                        {p.player_name}
                      </Link>
                    ) : (
                      <span className="text-white font-semibold">{p.player_name}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {p.team_id != null && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${BSD_IMG_BASE}/img/team/${p.team_id}/?sor=true&bg=transparent`}
                          alt=""
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                          className="w-4 h-4 object-contain shrink-0"
                        />
                      )}
                      {p.team_id ? (
                        <Link
                          href={`/team/${p.team_id}`}
                          className="text-mt hover:text-white text-xs truncate"
                        >
                          {p.team_name}
                        </Link>
                      ) : (
                        <span className="text-mt text-xs truncate">{p.team_name}</span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 text-right text-volt2 font-bold font-mono">{p.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ── TAB 4: TEAM STATS (GOALS/MATCH, CONCEDED, CLEAN SHEETS, POSSESSION) ─ */
function LeagueTeamStatsTab({
  leagueId,
  seasonId,
}: {
  leagueId: number;
  seasonId: number | null;
}) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getLeagueTeamStats(leagueId, seasonId)
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [leagueId, seasonId]);

  if (loading) return <p className="text-mt text-sm p-4">Loading team stats...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!data) return null;

  const cards = [
    { title: "Goals Scored per Match", key: "goals_per_match", rows: data.goals_per_match || [], suffix: "" },
    { title: "Goals Conceded per Match", key: "conceded_per_match", rows: data.conceded_per_match || [], suffix: "" },
    { title: "Clean Sheets", key: "clean_sheets", rows: data.clean_sheets || [], suffix: "" },
    { title: "Win Rate %", key: "win_rate", rows: data.win_rate || [], suffix: "%" },
    { title: "Average Possession %", key: "possession_avg", rows: data.possession || [], suffix: "%" },
  ].filter((c) => c.rows.length > 0);

  if (cards.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-mt text-sm">No team statistics available yet.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div key={card.title} className="card">
          <p className="section-label mb-3">{card.title}</p>
          <div className="divide-y divide-bd/40">
            {card.rows.slice(0, 10).map((tm: any, idx: number) => (
              <div key={`${card.title}-${tm.team_id ?? idx}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="text-mt font-mono text-xs w-5">{idx + 1}</span>
                  {tm.team_id != null && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`${BSD_IMG_BASE}/img/team/${tm.team_id}/?sor=true&bg=transparent`}
                      alt=""
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                      className="w-5 h-5 object-contain shrink-0"
                    />
                  )}
                  {tm.team_id ? (
                    <Link href={`/team/${tm.team_id}`} className="text-white font-semibold truncate hover:text-volt2">
                      {tm.team}
                    </Link>
                  ) : (
                    <span className="text-white font-semibold truncate">{tm.team}</span>
                  )}
                </div>
                <span className="font-mono font-bold text-volt2 shrink-0">
                  {tm[card.key]}{card.suffix}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── TAB 5: SEASON (PREVIOUS WINNERS & YEARS) ────────────────────────── */
function LeagueSeasonHistoryTab({
  seasons,
  activeLabel,
  onSelectSeason,
}: {
  seasons: LeagueSeason[];
  activeLabel: string;
  onSelectSeason: (s: LeagueSeason) => void;
}) {
  if (seasons.length === 0) {
    return (
      <div className="card text-center py-8">
        <p className="text-mt text-sm">No historical season records available.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-x-auto">
      <div className="mb-3">
        <p className="section-label">Seasons &amp; Previous Winners</p>
        <p className="text-mt text-xs mt-1">
          Tap any season year to view its standings table, fixtures, and stats.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-mt text-xs uppercase tracking-wide border-b border-bd">
            <th className="py-2 pr-3 text-left font-semibold">Season</th>
            <th className="py-2 pr-3 text-left font-semibold">Champion / Winner</th>
            <th className="py-2 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody>
          {seasons.map((s) => {
            const isSelected = s.label === activeLabel;
            return (
              <tr
                key={s.label}
                onClick={() => onSelectSeason(s)}
                className={clsx(
                  "border-b border-bd/50 last:border-0 cursor-pointer transition-colors",
                  isSelected ? "bg-volt2/10" : "hover:bg-white/5"
                )}
              >
                <td className="py-3 pr-3 font-mono font-bold text-white">
                  {s.label}
                  {s.is_current && (
                    <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-volt/15 text-volt">
                      Current
                    </span>
                  )}
                </td>
                <td className="py-3 pr-3">
                  {s.winner_name ? (
                    <div className="flex items-center gap-2">
                      {s.winner_id != null && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${BSD_IMG_BASE}/img/team/${s.winner_id}/?sor=true&bg=transparent`}
                          alt=""
                          onError={(e) => { e.currentTarget.style.display = "none"; }}
                          className="w-5 h-5 object-contain shrink-0"
                        />
                      )}
                      <span className="text-white font-semibold">{s.winner_name}</span>
                    </div>
                  ) : (
                    <span className="text-mt text-xs">
                      {s.is_current ? "Season in progress" : "—"}
                    </span>
                  )}
                </td>
                <td className="py-3 text-right">
                  <span className="text-volt2 text-xs font-semibold">
                    View table &rarr;
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}