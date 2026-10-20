"use client";
import Crest from "./Crest";
import { sortRounds, type Fixture } from "@/lib/api";

type TeamInfo = { name: string; crest_url: string | null };

/**
 * Knockout bracket: one column per round, earliest on the left.
 *
 * Deliberately NOT drawing connector lines between rounds. The pairing
 * only exists once the organiser creates the next round's fixtures, so
 * any line drawn before that would be a guess about who plays whom. A
 * column of real ties is honest; a drawn bracket with invented edges
 * is not.
 */
export default function Bracket({
  fixtures, teams,
}: {
  fixtures: Fixture[]; teams: Record<string, TeamInfo>;
}) {
  const byRound: Record<string, Fixture[]> = {};
  for (const fx of fixtures) {
    const r = fx.round || "Unscheduled";
    (byRound[r] ||= []).push(fx);
  }
  const rounds = sortRounds(Object.keys(byRound));

  if (rounds.length === 0) {
    return <p className="text-mt text-sm">No fixtures yet.</p>;
  }

  return (
    <div className="overflow-x-auto no-scrollbar">
      <div className="flex gap-4 min-w-max pb-2">
        {rounds.map((r) => (
          <div key={r} className="w-64 shrink-0">
            <p className="section-label mb-3">{r}</p>
            <div className="space-y-2">
              {byRound[r]
                .slice()
                .sort((a, b) => (a.kickoff_at || "").localeCompare(b.kickoff_at || ""))
                .map((fx) => (
                  <div key={fx.id} className="card py-2.5 px-3">
                    <TeamLine
                      t={teams[fx.home_team_id]} score={fx.home_score}
                      won={won(fx.home_score, fx.away_score, fx.status)}
                    />
                    <TeamLine
                      t={teams[fx.away_team_id]} score={fx.away_score}
                      won={won(fx.away_score, fx.home_score, fx.status)}
                    />
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Only a finished match has a winner. A live 1-0 is not a result. */
function won(a: number | null, b: number | null, status: string): boolean {
  if (status !== "ft" || a == null || b == null) return false;
  return a > b;
}

function TeamLine({ t, score, won }: {
  t?: TeamInfo; score: number | null; won: boolean;
}) {
  return (
    <div className="flex items-center gap-2 py-1">
      <Crest url={t?.crest_url} name={t?.name} size={18} />
      <span className={won ? "text-white text-sm flex-1 truncate font-semibold"
                           : "text-mt text-sm flex-1 truncate"}>
        {t?.name ?? "TBD"}
      </span>
      <span className={won ? "font-mono font-bold text-volt text-sm"
                           : "font-mono text-mt text-sm"}>
        {score ?? "-"}
      </span>
    </div>
  );
}
