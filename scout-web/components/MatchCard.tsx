import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import type { MatchSummary } from "@/lib/api";
import { BSD_IMG_BASE } from "@/lib/api";

function formatKickoff(iso?: string): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isMatchFinished(s: string) {
  return ["finished", "ended", "played"].includes(s);
}

function isMatchLive(s: string) {
  return !isMatchFinished(s) && !["notstarted", "postponed", "cancelled", "delayed"].includes(s);
}

export default function MatchCard({ match, targetTeamId, showCompetition }: { match: MatchSummary, targetTeamId?: number, showCompetition?: boolean }) {
  // A local competition's team ids are our own uuids, not BSD team ids.
  // Linking them to /team/{id} would 404, and BSD's badge CDN has no
  // art for a university faculty side.
  const isLocal = match.source === "local";
  const isLive = isMatchLive(match.status || "");
  const isFinished = isMatchFinished(match.status || "");

  let resultColor = "border-transparent";
  if (isFinished && targetTeamId) {
    const isHome = match.home_team_id === targetTeamId;
    const ourScore = isHome ? match.home_score : match.away_score;
    const theirScore = isHome ? match.away_score : match.home_score;
    if (ourScore > theirScore) resultColor = "border-l-volt2 bg-volt2/5";
    else if (ourScore < theirScore) resultColor = "border-l-red2 bg-red2/5";
    else resultColor = "border-l-mt/50 bg-white/5";
  }

  const body = (
    <div className={clsx("card flex flex-col hover:border-volt/40 transition-colors border-l-4", resultColor)}>
      {showCompetition && match.competition && (
        <div className="text-[10px] uppercase tracking-wider text-mt mb-2 font-bold border-b border-bd/50 pb-1.5">
          {match.competition}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <TeamBadge
                local={isLocal}
                crest={match.home_crest}
                teamId={match.home_team_id}
                name={match.home_team}
              />
              {match.home_team_id && !isLocal ? (
                <Link href={`/team/${match.home_team_id}`} className="text-white text-sm font-semibold truncate hover:text-volt2 transition-colors">
                  {match.home_team}
                </Link>
              ) : (
                <span className="text-white text-sm font-semibold truncate">{match.home_team}</span>
              )}
            </div>
            <span className="score-badge ml-2 shrink-0">{match.home_score}</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <TeamBadge
                local={isLocal}
                crest={match.away_crest}
                teamId={match.away_team_id}
                name={match.away_team}
              />
              {match.away_team_id && !isLocal ? (
                <Link href={`/team/${match.away_team_id}`} className="text-white text-sm font-semibold truncate hover:text-volt2 transition-colors">
                  {match.away_team}
                </Link>
              ) : (
                <span className="text-white text-sm font-semibold truncate">{match.away_team}</span>
              )}
            </div>
            <span className="score-badge ml-2 shrink-0">{match.away_score}</span>
          </div>
        </div>
        <div className="ml-4 flex flex-col items-end gap-1 shrink-0 justify-center">
          {isLive && (
            <span className="flex items-center gap-1.5 text-red2 text-xs font-bold font-mono">
              <span className="live-dot" /> {match.minute ? `${match.minute}'` : (match.status.includes('time') ? 'HT' : 'Live')}
            </span>
          )}
          {isFinished && <span className="text-mt text-xs font-mono font-bold">FT</span>}
          {/* Not started yet: show the actual kickoff time rather than the
              raw "notstarted" status string — this is what the Matches tab
              needs for today's later games and any future date. */}
        {!isLive && !isFinished && (
          <span className="text-mt text-xs font-mono">{formatKickoff(match.kickoff)}</span>
        )}
        </div>
      </div>
    </div>
  );

  if (match.event_id == null) {
    return <div className="opacity-80">{body}</div>;
  }

  // Where a tap goes. A local competition's fixture lives on its own
  // page under /tournament/..., not /match/..., because its id is a
  // fixture uuid and nothing about it comes from BSD.
  const href =
    match.source === "local" && match.tournament_id
      ? `/tournament/${match.tournament_id}/match/${match.event_id}`
      : `/match/${match.event_id}`;

  // The card can't be a <Link> because the team names inside it are
  // links too, and HTML forbids an anchor inside an anchor. So the card
  // navigates on click and lets a real anchor win if one was hit.
  return (
    <div
      className="cursor-pointer"
      role="link"
      tabIndex={0}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        window.location.href = href;
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          window.location.href = href;
        }
      }}
    >
      {body}
    </div>
  );
}

/**
 * A team's badge.
 *
 * BSD serves club art from an id, which a local competition doesn't
 * have, so a local side falls back to its uploaded crest and then to
 * initials rather than requesting a BSD image that will always 404.
 */
function TeamBadge({ local, crest, teamId, name }: {
  local: boolean;
  crest?: string | null;
  teamId?: number | string | null;
  name?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = local ? crest : teamId != null
    ? `${BSD_IMG_BASE}/img/team/${teamId}/?sor=true&bg=transparent`
    : null;

  if (!src || failed) {
    const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0]!.toUpperCase()).join("");
    return (
      <span className="w-5 h-5 rounded-full bg-sur2 border border-bd text-mt
                       text-[8px] font-bold flex items-center justify-center shrink-0">
        {initials}
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" onError={() => setFailed(true)}
              className="w-5 h-5 object-contain shrink-0" />;
}
