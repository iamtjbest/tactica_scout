"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import clsx from "clsx";
import { User } from "lucide-react";
import Link from "next/link";
import { getMatchDetail, getMatchFacts, type MatchFacts, playerImageUrl, type MatchDetail, type TeamFormResult, BSD_IMG_BASE } from "@/lib/api";
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

type Tab = "overview" | "timeline" | "lineups" | "h2h" | "stats" | "facts";
const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "timeline", label: "Timeline" },
  { id: "lineups",  label: "Lineups" },
  { id: "h2h",      label: "H2H" },
  { id: "stats",    label: "Stats" },
  { id: "facts",    label: "Facts" },
];

export default function MatchDetailPage() {
  const params = useParams();
  const eventId = Number(params.id);
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMatchDetail(eventId)
      .then(setMatch)
      .catch((e) => setError(e.message || "Failed to load match."));
  }, [eventId]);

  if (error) {
    return (
      <div className="card border-red2/40">
        <p className="text-red2 text-sm font-semibold">{error}</p>
        <p className="text-mt text-xs mt-1">
          This endpoint (/api/matches/{"{id}"}) relies on an unconfirmed BSD path
          — see the backend README before assuming the data's wrong.
        </p>
      </div>
    );
  }

  if (!match) return <p className="text-mt text-sm">Loading match...</p>;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="card">
        <p className="section-label mb-3 text-center">{match.competition}</p>
        <div className="flex items-center justify-between">
          <div className="flex flex-col items-center flex-1">
            <img 
              src={`${BSD_IMG_BASE}/img/team/${match.home_team_id}/?sor=true&bg=transparent`}
              alt={match.home_team}
              className="w-16 h-16 object-contain mb-2"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {match.home_team_id ? (
              <Link href={`/team/${match.home_team_id}`} className="text-white font-semibold text-center hover:text-volt2 transition-colors block">
                {match.home_team}
              </Link>
            ) : (
              <span className="text-white font-semibold text-center">{match.home_team}</span>
            )}
          </div>
          
          <div className="flex flex-col items-center px-4">
            <div className="flex items-center gap-3 mb-2">
              <span className="score-badge text-3xl px-3 py-1">{match.home_score ?? "-"}</span>
              <span className="text-mt font-black">-</span>
              <span className="score-badge text-3xl px-3 py-1">{match.away_score ?? "-"}</span>
            </div>
            <p className="text-mt text-xs font-mono">
              {match.status === "finished" ? "FT" :
               match.status === "notstarted" ? new Date(match.event_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) :
               match.status === "halftime" ? "HT" :
               <span className="flex items-center gap-1.5 text-red2 font-bold"><span className="live-dot" /> {match.minute ? `${match.minute}'` : match.status.toUpperCase()}</span>}
            </p>
          </div>

          <div className="flex flex-col items-center flex-1">
            <img 
              src={`${BSD_IMG_BASE}/img/team/${match.away_team_id}/?sor=true&bg=transparent`}
              alt={match.away_team}
              className="w-16 h-16 object-contain mb-2"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            {match.away_team_id ? (
              <Link href={`/team/${match.away_team_id}`} className="text-white font-semibold text-center hover:text-volt2 transition-colors block">
                {match.away_team}
              </Link>
            ) : (
              <span className="text-white font-semibold text-center">{match.away_team}</span>
            )}
          </div>
        </div>
        
        <div className="flex justify-between mt-4 border-t border-bd/40 pt-3">
          <div className="flex-1 text-left">
            <ScorerLine goalscorers={match.goalscorers} side="home" />
          </div>
          <div className="flex-1 text-right">
            <ScorerLine goalscorers={match.goalscorers} side="away" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={clsx("tab-pill shrink-0", tab === t.id ? "tab-pill-active" : "tab-pill-inactive")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab match={match} />}
      {tab === "timeline" && <TimelineTab match={match} />}
      {tab === "lineups" && <LineupsTab match={match} />}
      {tab === "h2h" && <H2HTab match={match} />}
      {tab === "stats" && <StatsTab match={match} />}
      {tab === "facts" && <FactsTab match={match} />}
    </div>
  );
}

function TimelineTab({ match }: { match: MatchDetail }) {
  const incidents = match.incidents || [];
  
  if (incidents.length === 0) {
    return (
      <p className="text-mt text-sm p-4 text-center">
        {match.availability?.incidents === false
          ? "Timeline events aren't available for this match."
          : "No key events (goals, cards, subs) reported yet."}
      </p>
    );
  }

  // Sort incidents by minute (descending for a feed-like view)
  const sorted = [...incidents].sort((a, b) => {
    const aMin = a.minute ?? (a.period_second != null ? Math.floor(a.period_second / 60) : 0);
    const bMin = b.minute ?? (b.period_second != null ? Math.floor(b.period_second / 60) : 0);
    return bMin - aMin;
  });

  return (
    <div className="card space-y-4">
      <p className="section-label mb-2 text-center">Match Timeline</p>
      <div className="relative border-l border-bd/40 ml-4 space-y-6">
        {sorted.map((inc, idx) => {
          const type = String(inc.type || inc.incident_type || "").toLowerCase();
          const minute = inc.minute ?? (inc.period_second != null ? Math.floor(inc.period_second / 60) : "-");
          const isHome = inc.is_home;
          const player = inc.player || inc.player_name || inc.scorer || "";
          
          let icon = "⏱️";
          let color = "text-white";
          
          if (type.includes("goal")) {
            icon = "⚽";
            color = "text-volt2";
          } else if (type.includes("yellow")) {
            icon = "🟨";
            color = "text-yellow-500";
          } else if (type.includes("red")) {
            icon = "🟥";
            color = "text-red-500";
          } else if (type.includes("sub")) {
            icon = "🔄";
            color = "text-cyan";
          }

          return (
            <div key={inc.id || idx} className="relative pl-6">
              <div className="absolute -left-[13px] top-1 w-6 h-6 bg-bg border border-bd/40 rounded-full flex items-center justify-center text-xs">
                {icon}
              </div>
              <div className="bg-white/5 rounded-md p-3 border border-bd/30">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-mono text-xs text-mt font-bold">{minute}'</span>
                  <span className="text-[10px] uppercase tracking-wide text-mt">
                    {isHome === true ? match.home_team : isHome === false ? match.away_team : "Event"}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  <p className={clsx("text-sm font-semibold", color)}>
                    {type.toUpperCase().replace(/_/g, " ")}
                  </p>
                  {player && <p className="text-white text-sm">{player}</p>}
                  {inc.assist && <p className="text-mt text-xs">Assist: {inc.assist}</p>}
                  {inc.player_in && <p className="text-mt text-xs">In: {inc.player_in}</p>}
                  {inc.player_out && <p className="text-mt text-xs">Out: {inc.player_out}</p>}
                  {inc.rescinded && <p className="text-red-400 text-xs mt-1">VAR OVERTURNED</p>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Groups a side's goals by player and lists each player once with all
// their minutes together ("M. Borchers 17', 38', 53'" instead of three
// separate lines), players ordered by their first goal -- this is how
// FotMob/Sofascore show a scoreline, not one row per goal.
function ScorerLine({
  goalscorers,
  side,
}: {
  goalscorers: MatchDetail["goalscorers"];
  side: "home" | "away";
}) {
  const scorers = goalscorers.filter((g) => g.side === side);
  if (scorers.length === 0) return null;

  const order: string[] = [];
  const byPlayer = new Map<string, (number | string)[]>();
  for (const g of scorers) {
    const name = g.player ?? "Unknown";
    if (!byPlayer.has(name)) {
      byPlayer.set(name, []);
      order.push(name);
    }
    if (g.minute != null) byPlayer.get(name)!.push(g.minute);
  }

  const rows = order
    .map((name) => ({ name, minutes: byPlayer.get(name)!.slice().sort((a, b) => Number(a) - Number(b)) }))
    .sort((a, b) => Number(a.minutes[0] ?? 0) - Number(b.minutes[0] ?? 0));

  return (
    <p className="text-mt text-xs text-right -mt-0.5">
      {rows.map((r, i) => (
        <span key={i}>
          {i > 0 && ", "}
          {r.name}
          {r.minutes.length > 0 ? ` ${r.minutes.map((m) => `${m}'`).join(", ")}` : ""}
        </span>
      ))}
    </p>
  );
}

function resultClasses(result: TeamFormResult["result"]): string {
  if (result === "W") return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
  if (result === "L") return "bg-red2/10 text-red2 border-red2/30";
  if (result === "D") return "bg-white/5 text-mt border-bd";
  return "bg-white/5 text-mt border-bd";
}

function FormColumn({ team, teamId, form }: { team: string; teamId?: number | null; form: TeamFormResult[] }) {
  return (
    <div className="flex-1 min-w-0">
      {teamId ? (
        <Link href={`/team/${teamId}`} className="text-white text-xs font-semibold truncate mb-2 hover:text-volt2 transition-colors block">
          {team}
        </Link>
      ) : (
        <p className="text-white text-xs font-semibold truncate mb-2">{team}</p>
      )}
      {form.length === 0 ? (
        <p className="text-mt text-xs">No recent form yet.</p>
      ) : (
        <div className="space-y-1.5">
          {form.map((f, i) => {
            const score = f.is_home
              ? `${f.own_score ?? "-"}-${f.opp_score ?? "-"}`
              : `${f.opp_score ?? "-"}-${f.own_score ?? "-"}`;

            const inner = (
              <>
                {/* Crest where BSD gave us an opponent id. A fixed-width
                    box either way, so rows without one still line up
                    instead of the names jumping left. */}
                <span className="w-4 h-4 shrink-0 flex items-center justify-center">
                  {f.opponent_id != null && (
                    <img
                      src={`${BSD_IMG_BASE}/img/team/${f.opponent_id}/?sor=true&bg=transparent`}
                      alt=""
                      className="w-4 h-4 object-contain"
                      onError={(e) => { e.currentTarget.style.visibility = "hidden"; }}
                    />
                  )}
                </span>
                <span className="truncate pr-2 flex-1">{f.opponent}</span>
                <span className="font-mono font-bold shrink-0">{score}</span>
              </>
            );

            const cls = clsx(
              "flex items-center gap-2 rounded-md border px-2 py-1 text-xs",
              resultClasses(f.result)
            );

            // Link only where we have a match to link to.
            return f.event_id ? (
              <Link
                key={f.event_id}
                href={`/match/${f.event_id}`}
                className={clsx(cls, "hover:brightness-125 transition-all")}
              >
                {inner}
              </Link>
            ) : (
              <div key={i} className={cls}>{inner}</div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TeamFormCard({ match }: { match: MatchDetail }) {
  if (match.home_form.length === 0 && match.away_form.length === 0) return null;
  return (
    <div className="card">
      <p className="section-label mb-3 text-center">Team Form</p>
      <div className="flex gap-4">
        <FormColumn team={match.home_team} teamId={match.home_team_id} form={match.home_form} />
        <FormColumn team={match.away_team} teamId={match.away_team_id} form={match.away_form} />
      </div>
    </div>
  );
}

function OverviewTab({ match }: { match: MatchDetail }) {
  const hasExtra = match.venue || match.referee || match.round;
  return (
    <div className="space-y-3">
      <div className="card space-y-2">
        <p className="text-mt text-sm">
          Kickoff: <span className="text-white">{match.event_date ? new Date(match.event_date).toLocaleString() : "TBD"}</span>
        </p>
        {match.round && (
          <p className="text-mt text-sm">
            Round: <span className="text-white">{match.round}</span>
          </p>
        )}
        {match.venue && (
          <p className="text-mt text-sm">
            Venue: <span className="text-white">{match.venue}</span>
          </p>
        )}
        {match.referee && (
          <p className="text-mt text-sm">
            Referee: <span className="text-white">{match.referee}</span>
          </p>
        )}
        {!hasExtra && (
          <p className="text-mt text-xs mt-2">
            BSD hasn&apos;t published venue/referee/round for this match yet
            — showing what&apos;s actually there.
          </p>
        )}
      </div>

      <TeamFormCard match={match} />
    </div>
  );
}

// BSD's lineups response hasn't been confirmed to include substitutes
// or a coach name under any particular key yet, so this tries a few
// common shapes rather than assuming they're simply absent: an
// explicit "substitutes"/"subs" array alongside "players", or players
// themselves flagged as bench via is_substitute/starting/role.
function splitLineup(side: any): { starters: any[]; bench: any[]; coach: string | null } {
  const players: any[] = side?.players ?? [];
  let bench: any[] = side?.substitutes ?? side?.subs ?? [];
  let starters = players;

  if (bench.length === 0) {
    const flaggedBench = players.filter(
      (p) => p?.is_substitute === true || p?.starting === false || p?.role === "substitute"
    );
    if (flaggedBench.length > 0) {
      bench = flaggedBench;
      starters = players.filter((p) => !flaggedBench.includes(p));
    }
  }

  const coach = side?.coach ?? side?.manager ?? side?.coach_name ?? null;
  return { starters, bench, coach };
}

// Confirmed from the BSD docs: there's no photo field on a player
// object anywhere -- photos come from a dedicated image endpoint keyed
// by player id (/img/player/{id}/?sor=true&bg=transparent), no extra
// API call needed beyond knowing the id. Still guessing the id field's
// own name since no lineup sample was shown; falls back to the person
// icon via onError if the id is missing or the image 404s (e.g. BSD
// has no art for that player yet).
function playerId(p: any): number | null {
  const direct = p?.player_id ?? p?.id ?? null;
  if (direct != null) return direct;
  if (p?.player && typeof p.player === "object") return p.player.id ?? null;
  return null;
}

function PlayerAvatar({
  player,
  size,
  iconSize,
}: {
  player: any;
  size: number;
  iconSize: number;
}) {
  const [failed, setFailed] = useState(false);
  const url = playerImageUrl(playerId(player));
  const name = player.short_name ?? player.name ?? "Unknown";
  const showPhoto = url && !failed;

  return (
    <div
      className="relative rounded-full bg-sur2 border border-bd flex items-center justify-center overflow-hidden shrink-0"
      style={{ width: size, height: size }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={name}
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <User size={iconSize} className="text-mt" />
      )}
    </div>
  );
}

function PlayerToken({ player }: { player: any }) {
  const name   = player.short_name ?? player.name ?? "Unknown";
  const number = player.number ?? player.shirt_number ?? player.jersey_number ?? null;

  // Not every lineup entry carries an id, so fall back to a plain div
  // rather than rendering a link that goes nowhere.
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    player.id ? (
      <Link
        href={`/player/${player.id}`}
        className="flex flex-col items-center w-14 shrink-0 hover:opacity-80 transition-opacity"
      >
        {children}
      </Link>
    ) : (
      <div className="flex flex-col items-center w-14 shrink-0">{children}</div>
    );

  return (
    <Wrapper>
      <div className="relative">
        <PlayerAvatar player={player} size={36} iconSize={18} />
        {number != null && (
          <span className="absolute -bottom-1 -right-1 bg-volt text-bg text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
            {number}
          </span>
        )}
      </div>
      <span className="text-white text-[10px] font-semibold text-center mt-1 leading-tight">
        {name}
      </span>
    </Wrapper>
  );
}

function SubRow({ player }: { player: any }) {
  const name     = player.name ?? player.short_name ?? "Unknown";
  const number   = player.number ?? player.shirt_number ?? player.jersey_number ?? null;
  const position = player.position ?? "";

  const inner = (
    <>
      <PlayerAvatar player={player} size={28} iconSize={14} />
      <span className="text-white/90 text-xs flex-1 truncate">{name}</span>
      {number != null && <span className="text-mt text-[10px] font-mono w-6 text-right">#{number}</span>}
      {position && <span className="text-mt text-[10px] font-mono uppercase w-7 text-right">{position}</span>}
    </>
  );

  if (!player.id) {
    return <div className="flex items-center gap-3 py-1.5">{inner}</div>;
  }
  return (
    <Link
      href={`/player/${player.id}`}
      className="flex items-center gap-3 py-1.5 -mx-2 px-2 rounded hover:bg-bg2/60 transition-colors"
    >
      {inner}
    </Link>
  );
}

// Groups by position into GK/DEF/MID/FWD rows and renders them as a
// pitch, goalkeeper at the bottom, attack at the top -- this reads off
// each player's own position string rather than trying to slot an
// exact count per the formation label, since a formation string like
// "4-2-3-1" is just a display label here, not something every player
// object is guaranteed to line up against neatly.
function PitchLineup({ players }: { players: any[] }) {
  const buckets: Record<"GK" | "DEF" | "MID" | "FWD", any[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of players) {
    const pos = String(p.position ?? "").toUpperCase();
    if (pos.startsWith("G")) buckets.GK.push(p);
    else if (pos.startsWith("D")) buckets.DEF.push(p);
    else if (pos.startsWith("M")) buckets.MID.push(p);
    else buckets.FWD.push(p);
  }
  const rows = (["GK", "DEF", "MID", "FWD"] as const)
    .map((key) => ({ key, players: buckets[key] }))
    .filter((r) => r.players.length > 0);

  return (
    <div
      className="relative bg-[#0F1A14] border border-bd rounded-xl overflow-hidden mx-auto w-full max-w-[320px]"
      style={{ aspectRatio: "3 / 4" }}
    >
      <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />
      <div className="absolute left-1/2 top-1/2 w-14 h-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
      <div className="absolute inset-0 flex flex-col-reverse justify-around py-4 px-1">
        {rows.map((row) => (
          <div key={row.key} className="flex justify-around items-start">
            {row.players.map((p: any, i: number) => (
              <PlayerToken key={i} player={p} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function LineupsTab({ match }: { match: MatchDetail }) {
  const [activeSide, setActiveSide] = useState<"home" | "away">("home");

  if (match.lineup_status === "unavailable") {
    return (
      <p className="text-mt text-sm">
        {match.availability?.lineups === false
          ? "Lineups aren't out yet for this match."
          : "No lineup to show right now."}
      </p>
    );
  }

  const rawSide = activeSide === "home" ? match.lineups?.home : match.lineups?.away;
  const { starters, bench, coach: sideCoach } = splitLineup(rawSide);
  const coach = sideCoach ?? (activeSide === "home" ? match.home_coach : match.away_coach);
  const formation = rawSide?.formation;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          onClick={() => setActiveSide("home")}
          className={clsx("tab-pill flex-1 truncate", activeSide === "home" ? "tab-pill-active" : "tab-pill-inactive")}
        >
          {match.home_team}
        </button>
        <button
          onClick={() => setActiveSide("away")}
          className={clsx("tab-pill flex-1 truncate", activeSide === "away" ? "tab-pill-active" : "tab-pill-inactive")}
        >
          {match.away_team}
        </button>
      </div>

      <p className="text-center text-mt text-xs font-mono">{formation ?? "—"}</p>

      <PitchLineup players={starters} />

      {coach && (
        <p className="text-center text-mt text-xs">
          Coach: <span className="text-white font-semibold">{coach}</span>
        </p>
      )}

      <div className="card">
        <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-2">Substitutes</p>
        {bench.length === 0 ? (
          <p className="text-mt text-xs">Not provided by the data source yet.</p>
        ) : (
          <div className="divide-y divide-bd/40">
            {bench.map((p: any, idx: number) => (
              <SubRow key={idx} player={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function H2HTab({ match }: { match: MatchDetail }) {
  const { summary, recent_matches } = match.h2h;

  if (!recent_matches.length && !summary) {
    return (
      <p className="text-mt text-sm">
        No head-to-head history found for these two sides yet on /events/{"{id}"}/h2h/.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {summary && (
        <div className="card flex items-center justify-around text-center">
          <div>
            <p className="text-white font-bold text-lg">{summary.home_wins ?? "-"}</p>
            <p className="text-mt text-[10px] uppercase tracking-wide">{match.home_team} wins</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{summary.draws ?? "-"}</p>
            <p className="text-mt text-[10px] uppercase tracking-wide">Draws</p>
          </div>
          <div>
            <p className="text-white font-bold text-lg">{summary.away_wins ?? "-"}</p>
            <p className="text-mt text-[10px] uppercase tracking-wide">{match.away_team} wins</p>
          </div>
        </div>
      )}
      <div className="space-y-3">
        {recent_matches.map((g, i) => (
          <Link key={g.event_id ?? i} href={`/match/${g.event_id}`} className="block">
            <div className="card flex flex-col hover:border-volt/40 transition-colors cursor-pointer">
              {g.league_name && (
                <div className="flex items-center gap-2 border-b border-bd/40 pb-2 mb-2">
                  <img src={`${BSD_IMG_BASE}/img/league/${g.league_id}/?sor=true&bg=transparent`} className="w-4 h-4 object-contain" />
                  <span className="text-[10px] uppercase tracking-wider text-mt font-bold">{g.league_name}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 justify-end text-sm">
                  <span className={clsx("truncate font-semibold", (g.home_score ?? -1) > (g.away_score ?? -1) ? "text-white" : "text-mt")}>{g.home_team}</span>
                  {g.home_team_id && <img src={`${BSD_IMG_BASE}/img/team/${g.home_team_id}/?sor=true&bg=transparent`} className="w-5 h-5 object-contain" />}
                </div>
                <div className="mx-4 flex items-center gap-2 font-mono font-bold text-lg bg-bg2 px-3 py-1 rounded-md shrink-0">
                  <span className={(g.home_score ?? -1) > (g.away_score ?? -1) ? "text-volt2" : "text-white"}>{g.home_score ?? "-"}</span>
                  <span className="text-mt text-sm">-</span>
                  <span className={(g.away_score ?? -1) > (g.home_score ?? -1) ? "text-volt2" : "text-white"}>{g.away_score ?? "-"}</span>
                </div>
                <div className="flex items-center gap-2 flex-1 justify-start text-sm">
                  {g.away_team_id && <img src={`${BSD_IMG_BASE}/img/team/${g.away_team_id}/?sor=true&bg=transparent`} className="w-5 h-5 object-contain" />}
                  <span className={clsx("truncate font-semibold", (g.away_score ?? -1) > (g.home_score ?? -1) ? "text-white" : "text-mt")}>{g.away_team}</span>
                </div>
              </div>
              <p className="text-center text-mt text-[10px] mt-3 uppercase tracking-wider">
                {g.date ? new Date(g.date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ""}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Stat values are usually numbers, but some (xg) come back as
// {actual, estimated} -- rendering that object directly is what threw
// "Objects are not valid as a React child". Always resolve to a
// primitive before it hits JSX.
function formatStatValue(v: any): string {
  if (v === null || v === undefined) return "-";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return v;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "object") {
    if (typeof v.actual === "number") return v.actual.toFixed(2);
    if (typeof v.estimated === "number") return v.estimated.toFixed(2);
    return "-";
  }
  return String(v);
}

function StatsTab({ match }: { match: MatchDetail }) {
  const stats = match.stats;
  if (!stats) {
    const notPublished = match.availability?.stats === false;
    return (
      <p className="text-mt text-sm text-center p-4">
        {notPublished
          ? "This match hasn't reported stats yet."
          : "Match stats aren't available for this one right now."}
      </p>
    );
  }

  const home = stats.stats?.home ?? stats.home ?? null;
  const away = stats.stats?.away ?? stats.away ?? null;
  const momentum = stats.momentum || [];
  const shotmap = stats.shotmap || [];

  if (!home || !away) {
    return (
      <div className="card">
        <p className="text-mt text-xs font-mono whitespace-pre-wrap break-all">
          {JSON.stringify(stats, null, 2)}
        </p>
      </div>
    );
  }

  const ALWAYS_PRESENT = ["ball_possession", "total_shots", "shots_on_target", "corner_kicks", "fouls", "yellow_cards", "red_cards", "offsides"];
  const keys = Array.from(new Set([...ALWAYS_PRESENT, ...Object.keys(home), ...Object.keys(away)]))
    .filter((k) => home[k] !== undefined || away[k] !== undefined);

  return (
    <div className="space-y-4">
      {/* Momentum Graph */}
      {momentum.length > 0 && (
        <div className="card">
          <p className="section-label mb-4 text-center">Match Momentum</p>
          <div className="h-40 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={momentum} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <XAxis dataKey="m" tick={{ fill: "#6e6e73", fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.1)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const val = data.v;
                      const team = val > 0 ? match.home_team : match.away_team;
                      return (
                        <div className="bg-sur2 border border-bd px-3 py-2 rounded-md text-xs shadow-xl">
                          <p className="text-mt font-mono mb-1">{data.m}'</p>
                          <p className="text-white font-semibold">Pressure: <span className={val > 0 ? "text-volt2" : "text-cyan"}>{Math.abs(val)}</span></p>
                          <p className="text-mt text-[10px]">{team}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="v" radius={[2, 2, 0, 0]}>
                  {momentum.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.v > 0 ? "#ccff00" : "#00f0ff"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-between text-[10px] uppercase tracking-wide font-semibold mt-2">
            <span className="text-volt2">{match.home_team}</span>
            <span className="text-cyan">{match.away_team}</span>
          </div>
        </div>
      )}

      {/* Shot Map */}
      {shotmap.length > 0 && (
        <div className="card">
          <p className="section-label mb-4 text-center">Shot Map</p>
          <div className="relative w-full max-w-[300px] mx-auto border border-bd rounded-md bg-[#0F1A14] overflow-hidden" style={{ aspectRatio: "2/3" }}>
            {/* Pitch Lines */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute left-0 right-0 top-1/2 border-t border-white/10" />
              <div className="absolute left-1/2 top-1/2 w-16 h-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[15%] border border-white/10 border-t-0" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[15%] border border-white/10 border-b-0" />
            </div>
            
            {/* Shots */}
            {shotmap.map((shot: any, idx: number) => {
              if (!shot.pos || shot.pos.x == null || shot.pos.y == null) return null;
              // pos.x is 0-100 (length), pos.y is 0-100 (width)
              // We map home shots to bottom half (x: 0-50), away shots to top half (x: 50-100) based on standard pitch mapping.
              // Actually, BSD pos.x is origin. Let's just plot them directly.
              const isGoal = shot.type === "goal";
              const color = shot.home ? (isGoal ? "#ccff00" : "rgba(204,255,0,0.3)") : (isGoal ? "#00f0ff" : "rgba(0,240,255,0.3)");
              return (
                <div
                  key={idx}
                  className="absolute rounded-full -translate-x-1/2 -translate-y-1/2 border border-bg"
                  style={{
                    left: `${shot.pos.y}%`,
                    top: `${100 - shot.pos.x}%`,
                    width: isGoal ? '12px' : '8px',
                    height: isGoal ? '12px' : '8px',
                    backgroundColor: color,
                    zIndex: isGoal ? 10 : 1
                  }}
                  title={`${shot.min}' ${isGoal ? 'Goal' : shot.type} (${shot.xg ? shot.xg.toFixed(2) + ' xG' : ''})`}
                />
              );
            })}
          </div>
          <p className="text-center text-mt text-[10px] mt-3">Larger opaque dots = Goals. Hover for details.</p>
        </div>
      )}

      {/* Traditional Stats */}
      <div className="card space-y-5">
        <p className="section-label mb-2 text-center">Match Stats</p>
        {keys.map((k) => {
          const homeValRaw = home[k];
          const awayValRaw = away[k];
          const homeStr = formatStatValue(homeValRaw);
          const awayStr = formatStatValue(awayValRaw);

          // Calculate percentage for the bar if numeric
          let homePercent = 50;
          let awayPercent = 50;
          const homeNum = parseFloat(homeStr);
          const awayNum = parseFloat(awayStr);

          if (!isNaN(homeNum) && !isNaN(awayNum)) {
            const total = homeNum + awayNum;
            if (total > 0) {
              homePercent = (homeNum / total) * 100;
              awayPercent = (awayNum / total) * 100;
            }
          }

          return (
            <div key={k} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white font-semibold w-12 text-right">{homeStr}</span>
                <span className="text-mt text-xs uppercase tracking-wide flex-1 text-center">{k.replace(/_/g, " ")}</span>
                <span className="text-white font-semibold w-12">{awayStr}</span>
              </div>
              <div className="flex w-full h-1.5 bg-sur2 rounded-full overflow-hidden">
                <div 
                  className="bg-volt2 h-full transition-all duration-500" 
                  style={{ width: `${homePercent}%` }} 
                />
                <div 
                  className="bg-cyan h-full transition-all duration-500" 
                  style={{ width: `${awayPercent}%` }} 
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The copy and the rules here are mirrored in scout-mobile's Facts tab
// (MatchDetailScreen.tsx). They render the same backend response, so if
// one changes, change both.
function FactsTab({ match }: { match: MatchDetail }) {
  // Fetched here rather than with the match: Tactica's backend sleeps on
  // Render's free tier and a cold start is ~50s. That cost belongs to
  // this tab, not to the whole page.
  const [facts, setFacts] = useState<MatchFacts | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setFailed(false);
    getMatchFacts(match.event_id)
      .then((f: MatchFacts) => { if (alive) setFacts(f); })
      .catch(() => { if (alive) setFailed(true); });
    return () => {
      alive = false;
    };
  }, [match.event_id]);

  if (failed) {
    return (
      <div className="card">
        <p className="section-label mb-3">Tactica Numbers</p>
        <p className="text-mt text-sm">Tactica ratings couldn&apos;t be loaded right now.</p>
      </div>
    );
  }
  if (!facts) {
    return (
      <div className="card">
        <p className="section-label mb-3">Tactica Numbers</p>
        <p className="text-mt text-sm">Loading ratings...</p>
        <p className="text-mt2 text-xs mt-1">
          The model may be waking up, this can take a moment.
        </p>
      </div>
    );
  }

  const { home, away, draw_prob, best_formation, degraded, name_mismatch } = facts;
  const hasRatings = home.attack != null || away.attack != null;
  const hasProbs = home.win_prob != null || away.win_prob != null;

  if (!hasRatings && !hasProbs) {
    return (
      <div className="card">
        <p className="section-label mb-3">Tactica Numbers</p>
        <p className="text-mt text-sm">
          {degraded
            ? "Tactica ratings couldn't be loaded right now."
            : "Tactica ratings aren't available for this match yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasProbs && (
        <div className="card">
          <p className="section-label mb-4">Win Probability</p>
          <div className="space-y-3">
            <ProbBar label={match.home_team} value={home.win_prob} tone="volt" />
            {draw_prob != null && <ProbBar label="Draw" value={draw_prob} tone="mt" />}
            <ProbBar label={match.away_team} value={away.win_prob} tone="cyan" />
          </div>
          {draw_prob == null && (
            <p className="text-mt2 text-xs mt-3">
              Each figure is that side&apos;s own model run, so they won&apos;t always
              total 100.
            </p>
          )}
        </div>
      )}

      <div className="card">
        <p className="section-label mb-4">Tactica Ratings</p>
        <div className="space-y-3">
          <RatingRow team={match.home_team} teamId={match.home_team_id} attack={home.attack} defence={home.defence} live={home.live_rating} />
          <RatingRow team={match.away_team} teamId={match.away_team_id} attack={away.attack} defence={away.defence} live={away.live_rating} />
        </div>
        {name_mismatch && (
          <p className="text-mt2 text-xs mt-3">
            A rating was withheld because the name matched a different club
            upstream.
          </p>
        )}
      </div>

      {best_formation && (
        <div className="card">
          <p className="section-label mb-2">Model&apos;s Best Shape</p>
          <p className="font-mono text-white text-lg">{best_formation}</p>
          <p className="text-mt2 text-xs mt-1">
            Highest-rated setup for {match.home_team} against this opponent.
          </p>
        </div>
      )}
    </div>
  );
}

function ProbBar({
  label, value, tone,
}: {
  label: string; value: number | null; tone: "volt" | "cyan" | "mt";
}) {
  const bar = tone === "volt" ? "bg-volt" : tone === "cyan" ? "bg-cyan" : "bg-mt";
  const txt = tone === "volt" ? "text-volt" : tone === "cyan" ? "text-cyan" : "text-mt";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 mb-1.5">
        <span className="text-white text-sm truncate">{label}</span>
        <span className={`font-display font-black text-lg ${txt}`}>
          {value != null ? `${value.toFixed(1)}%` : "--"}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-bg2 overflow-hidden">
        <div className={`h-full rounded-full ${bar}`}
             style={{ width: `${Math.min(100, Math.max(0, value ?? 0))}%` }} />
      </div>
    </div>
  );
}

function RatingRow({
  team, teamId, attack, defence, live,
}: {
  team: string; teamId: number | null; attack: number | null;
  defence: number | null; live?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-bd last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {teamId != null && (
          <img
            src={`${BSD_IMG_BASE}/img/team/${teamId}/?sor=true&bg=transparent`}
            alt=""
            className="w-5 h-5 object-contain shrink-0"
          />
        )}
        <span className="text-white text-sm truncate">{team}</span>
        {live === false && attack != null && (
          <span className="text-mt2 text-[10px] font-mono shrink-0" title="Not enough matches for a live rating; showing baseline">
            BASE
          </span>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-mt text-xs font-mono">
          ATK <span className="text-volt font-bold text-sm">{attack ?? "--"}</span>
        </span>
        <span className="text-mt text-xs font-mono">
          DEF <span className="text-cyan font-bold text-sm">{defence ?? "--"}</span>
        </span>
      </div>
    </div>
  );
}
