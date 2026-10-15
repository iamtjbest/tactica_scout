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
              <img src={`${BSD_IMG_BASE}/img/team/${match.home_team_id}/?sor=true&bg=transparent`} className="w-5 h-5 object-contain" />
              {match.home_team_id ? (
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
              <img src={`${BSD_IMG_BASE}/img/team/${match.away_team_id}/?sor=true&bg=transparent`} className="w-5 h-5 object-contain" />
              {match.away_team_id ? (
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
    return <div className={clsx("opacity-80")}>{body}</div>;
  }

  // To prevent the entire card link from catching clicks on the team links,
  // we'd need to either make the body not a Link but have a programmatic click,
  // or put relative positioning. A common trick is to make the card relative,
  // and put a Next Link inside that covers it using ::before, but here we can
  // just put onClick on the card container that navigates to the match, and
  // stop propagation on the team links. But since team links are actual <a> tags, 
  // clicking them inside a wrapper that has onClick won't trigger the wrapper
  // if we stop propagation. Next.js <Link> around <a> tags throws hydration errors.
  // It's cleaner to just not make the entire card a link, but instead make the 
  // score section the link to the match! Or make the card a programmatic router.push.
  
  // Wait, right now the entire card is a Link. If we put Links inside it, HTML forbids <a> inside <a>!
  // I will just return the body directly, but change `body` to be clickable via a custom hook or onClick.
  // Actually, I'll just change the body to have a "View Match" link at the right side if hovered.
  
  // Let's use router.push on the card.
  return (
    <div 
      className="cursor-pointer"
      onClick={(e) => {
        // If clicking on an anchor tag, let it go to the team page
        if ((e.target as HTMLElement).closest('a')) return;
        window.location.href = `/match/${match.event_id}`;
      }}
    >
      {body}
    </div>
  );
}
