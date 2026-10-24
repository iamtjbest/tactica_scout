"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { getTournament, type TournamentDetail, type TournamentStanding,
         type TournamentFixture } from "@/lib/api";

type Tab = "table" | "matches" | "teams";

/**
 * A published local competition, as a fan sees it.
 *
 * Opens on Matches rather than the table: someone arriving mid-season
 * wants today's score, and the table is one tap away. A knockout has no
 * table at all, so the tab isn't drawn for one.
 */
export default function TournamentPage() {
  const { id } = useParams<{ id: string }>();
  const [d, setD] = useState<TournamentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("matches");

  useEffect(() => {
    getTournament(id)
      .then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message));
  }, [id]);

  if (error) {
    return (
      <main className="max-w-screen-md mx-auto px-4 pt-6 pb-24">
        <p className="text-red2 text-sm font-semibold">{error}</p>
        <Link href="/tournaments" className="text-volt text-sm font-semibold mt-3 inline-block">
          Back to competitions
        </Link>
      </main>
    );
  }
  if (!d) return <main className="px-4 pt-6"><p className="text-mt text-sm">Loading...</p></main>;

  const t = d.tournament;
  const hasTable = Boolean(d.standings?.length || Object.keys(d.group_tables ?? {}).length);
  const tabs: Tab[] = hasTable ? ["matches", "table", "teams"] : ["matches", "teams"];

  return (
    <main className="max-w-screen-md mx-auto px-4 pt-4 pb-24">
      <Link href="/tournaments" className="text-mt text-xs hover:text-white">
        ← Competitions
      </Link>

      <h1 className="font-display font-black text-2xl text-white mt-2">{t.name}</h1>
      <p className="text-mt text-sm mt-1">
        {t.organizing_body} • {t.country}
      </p>
      <p className="text-mt2 text-xs mt-1 font-mono">
        {seasonRange(t.start_date, t.end_date)}
      </p>

      <div className="flex gap-2 mt-4">
        {tabs.map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={clsx("tab-pill capitalize",
              tab === x ? "tab-pill-active" : "tab-pill-inactive")}
          >
            {x}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "matches" && <Matches tournamentId={id} fixtures={d.fixtures} />}
        {tab === "table" && hasTable && <Tables d={d} />}
        {tab === "teams" && (
          <div className="space-y-2">
            {d.teams.map((tm) => (
              <div key={tm.team_id} className="card flex items-center gap-3">
                <Badge url={tm.crest_url} name={tm.name} />
                <span className="text-white text-sm flex-1 truncate">{tm.name}</span>
                {tm.group_name && (
                  <span className="text-mt2 text-[11px] font-mono">
                    {groupLabel(tm.group_name)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Badge({ url, name, size = 22 }: { url: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?").split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("");

  if (!url || failed) {
    return (
      <span
        className="rounded-full bg-sur2 border border-bd text-mt text-[9px] font-bold
                   flex items-center justify-center shrink-0"
        style={{ width: size, height: size }}
      >
        {initials}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" onError={() => setFailed(true)}
         className="rounded-full object-cover shrink-0"
         style={{ width: size, height: size }} />
  );
}

/** Grouped by round or group, in playing order. A flat list of thirty
 *  fixtures with no grouping is unusable. */
function Matches({ tournamentId, fixtures }: {
  tournamentId: string; fixtures: TournamentFixture[];
}) {
  if (fixtures.length === 0) {
    return <p className="text-mt text-sm">No fixtures published yet.</p>;
  }

  const grouped: Record<string, TournamentFixture[]> = {};
  for (const fx of fixtures) {
    // Group and round both, so matchday 7 and 8 don't run into one list.
    const key = [groupLabel(fx.group_name), (fx.round || "").trim()]
      .filter(Boolean).join(" · ") || "Fixtures";
    (grouped[key] ||= []).push(fx);
  }

  return (
    <div className="space-y-5">
      {Object.keys(grouped).map((heading) => (
        <div key={heading}>
          <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-2">
            {heading}
          </p>
          <div className="space-y-2">
            {grouped[heading]
              .slice()
              .sort((a, b) => (a.kickoff_at || "").localeCompare(b.kickoff_at || ""))
              .map((fx) => {
                const live = ["live", "ht"].includes(String(fx.status).toLowerCase());
                return (
                  <Link
                    key={fx.id}
                    href={`/tournament/${tournamentId}/match/${fx.id}`}
                    className="card block hover:border-volt/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <Side name={fx.home_team} crest={fx.home_crest} score={fx.home_score} />
                        <Side name={fx.away_team} crest={fx.away_crest} score={fx.away_score} />
                      </div>
                      <div className="text-right shrink-0">
                        <p className={clsx("font-mono text-[10px]",
                                           live ? "text-red2" : "text-mt2")}>
                          {live ? "LIVE" : String(fx.status).toUpperCase()}
                        </p>
                        <p className="text-mt2 text-[10px] font-mono mt-0.5">
                          {fx.kickoff_at
                            ? new Date(fx.kickoff_at).toLocaleString("en-GB", {
                                day: "numeric", month: "short",
                                hour: "2-digit", minute: "2-digit",
                              })
                            : ""}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
          </div>
        </div>
      ))}
    </div>
  );
}

function Side({ name, crest, score }: {
  name: string | null; crest: string | null; score: number | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <Badge url={crest} name={name ?? "?"} size={18} />
      <span className="text-white text-sm truncate flex-1">{name ?? "Unknown"}</span>
      <span className="font-display font-black text-white text-sm">
        {score ?? "–"}
      </span>
    </div>
  );
}

/**
 * Organisers type the group as "B" or as "Group B". Prefixing blindly is
 * what produced the "Group Group B" heading, so this is the one place
 * that decides the label.
 */
function groupLabel(name?: string | null): string {
  const g = (name || "").trim();
  if (!g) return "";
  return /^group\b/i.test(g) ? g : `Group ${g}`;
}

/**
 * "5 Sep – 12 Dec 2026" rather than the raw ISO the API stores. The year
 * is printed on both ends only when the season crosses into a new one.
 */
function seasonRange(start?: string | null, end?: string | null): string {
  const fmt = (iso: string, withYear: boolean) => {
    const t = Date.parse(iso);
    if (Number.isNaN(t)) return iso;
    return new Date(t).toLocaleDateString("en-GB", {
      day: "numeric", month: "short", ...(withYear ? { year: "numeric" } : {}),
    });
  };
  if (!start && !end) return "";
  if (!start) return fmt(end as string, true);
  if (!end) return `From ${fmt(start, true)}`;
  const sameYear = start.slice(0, 4) === end.slice(0, 4);
  return `${fmt(start, !sameYear)} – ${fmt(end, true)}`;
}

function Tables({ d }: { d: TournamentDetail }) {
  const groups = d.group_tables ? Object.keys(d.group_tables).sort() : [];
  const pts = d.points_rules;

  return (
    <div className="space-y-6">
      {groups.length > 0
        ? groups.map((g) => (
            <div key={g}>
              <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-2">
                {groupLabel(g)}
              </p>
              <Table rows={d.group_tables![g]} />
            </div>
          ))
        : <Table rows={d.standings ?? []} />}

      <p className="text-mt2 text-xs">
        Built from finished matches only.
        {pts && ` ${pts.win} for a win, ${pts.draw} for a draw.`}
      </p>
    </div>
  );
}

function Table({ rows }: { rows: TournamentStanding[] }) {
  if (rows.length === 0) {
    return <p className="text-mt text-sm">No finished matches yet.</p>;
  }
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-mt text-[10px] uppercase tracking-wide border-b border-bd">
            <th className="text-left font-semibold py-2 pr-2">#</th>
            <th className="text-left font-semibold py-2 pr-2">Team</th>
            <th className="text-center font-semibold py-2 px-1">P</th>
            <th className="text-center font-semibold py-2 px-1">W</th>
            <th className="text-center font-semibold py-2 px-1">D</th>
            <th className="text-center font-semibold py-2 px-1">L</th>
            <th className="text-center font-semibold py-2 px-1">GD</th>
            <th className="text-center font-semibold py-2 pl-1">Pts</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.team_id} className="border-b border-bd/50 last:border-0">
              <td className="py-2 pr-2 text-mt text-xs">{r.position}</td>
              <td className="py-2 pr-2">
                <span className="flex items-center gap-2 min-w-0">
                  <Badge url={r.crest_url} name={r.name} size={18} />
                  <span className="text-white truncate">{r.name}</span>
                </span>
              </td>
              <td className="text-center text-mt px-1">{r.played}</td>
              <td className="text-center text-mt px-1">{r.won}</td>
              <td className="text-center text-mt px-1">{r.drawn}</td>
              <td className="text-center text-mt px-1">{r.lost}</td>
              <td className="text-center text-mt px-1">
                {r.goal_difference > 0 ? `+${r.goal_difference}` : r.goal_difference}
              </td>
              <td className="text-center text-volt font-bold pl-1">{r.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
