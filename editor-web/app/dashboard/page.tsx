"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Guard from "@/components/Guard";
import Crest from "@/components/Crest";
import { getDashboard, type Dashboard, type DashFixture } from "@/lib/api";

export default function Page() {
  return <Guard><Home /></Guard>;
}

/**
 * The screen after sign-in.
 *
 * A list of competitions was the wrong landing: it is a filing cabinet,
 * and it answers "what do I have" when the question on opening the app
 * is "what is happening and what do I need to do". So this leads with
 * what is live, then what needs the organiser, then what is next.
 *
 * It is one request. The obvious build is "list competitions, then
 * fetch each one's fixtures", which is a round trip per competition on
 * a phone paying for data; the backend assembles it instead.
 */
function Home() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    getDashboard().then((x) => { setD(x); setError(null); })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">
        <div className="card border-red2/40">
          <p className="text-red2 text-sm font-semibold">{error}</p>
          <p className="text-mt text-xs mt-1">
            This usually clears on its own. If it keeps happening, check your
            connection and try again in a minute.
          </p>
        </div>
      </div>
    );
  }
  if (!d) return <p className="text-mt text-sm p-8">Loading...</p>;

  const empty = d.total === 0;

  return (
    <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8 space-y-8">
      <div>
        <h1 className="font-display font-black text-2xl sm:text-3xl text-white">
          Dashboard
        </h1>
        <p className="text-mt text-sm mt-1">
          {empty
            ? "Nothing running yet."
            : "What's happening across everything you run."}
        </p>
      </div>

      {empty ? (
        <div className="card">
          <p className="text-white font-semibold">Start your first competition</p>
          <p className="text-mt text-sm mt-1">
            Hosting is free and unlimited, and nothing appears on Scout until
            it&apos;s approved.
          </p>
          <div className="flex flex-wrap gap-3 mt-4">
            <Link href="/competitions" className="btn-volt">New competition</Link>
            <Link href="/join"
                  className="border border-bd2 text-white font-semibold text-sm px-5 py-2.5
                             rounded-xl hover:border-volt hover:text-volt transition-colors">
              Join one with a code
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* at a glance */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-bd rounded-2xl
                          overflow-hidden border border-bd">
            <Stat label="Live on Scout" value={d.counts.approved ?? 0} tone="volt" />
            <Stat label="Awaiting approval" value={d.counts.pending ?? 0} />
            <Stat label="Drafts" value={d.counts.draft ?? 0} />
            <Stat label="Access requests" value={d.open_requests}
                  tone={d.open_requests > 0 ? "cyan" : undefined}
                  href={d.open_requests > 0 ? "/inbox" : undefined} />
          </div>

          {d.live.length > 0 && (
            <Section title="Playing now" accent>
              {d.live.map((fx) => <FixtureRow key={fx.id} fx={fx} live />)}
            </Section>
          )}

          {d.needs_attention.length > 0 && (
            <Section title="Needs you">
              {d.needs_attention.map((n) => (
                <Link key={n.tournament_id} href={`/t/${n.tournament_id}`}
                      className="card block hover:border-volt/40 transition-colors">
                  <div className="flex items-start gap-3">
                    <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                      n.kind === "rejected" ? "bg-red2" : "bg-amber"}`} />
                    <div className="min-w-0">
                      <p className="text-white font-semibold truncate">{n.name}</p>
                      <p className="text-mt text-sm mt-0.5">{n.detail}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </Section>
          )}

          {d.upcoming.length > 0 && (
            <Section title="Coming up">
              {d.upcoming.map((fx) => <FixtureRow key={fx.id} fx={fx} />)}
            </Section>
          )}

          {d.recent.length > 0 && (
            <Section title="Latest results">
              {d.recent.map((fx) => <FixtureRow key={fx.id} fx={fx} />)}
            </Section>
          )}

          {d.live.length === 0 && d.upcoming.length === 0 && d.recent.length === 0 && (
            <div className="card">
              <p className="text-white font-semibold">No matches in the next fortnight</p>
              <p className="text-mt text-sm mt-1">
                Fixtures appear here once they&apos;re generated or uploaded.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone, href }: {
  label: string; value: number; tone?: "volt" | "cyan"; href?: string;
}) {
  const body = (
    <div className="bg-sur p-5 h-full">
      <p className={`font-display font-black text-3xl ${
        tone === "volt" ? "text-volt" : tone === "cyan" ? "text-cyan" : "text-white"}`}>
        {value}
      </p>
      <p className="text-mt text-xs mt-1">{label}</p>
    </div>
  );
  return href
    ? <Link href={href} className="hover:bg-sur2 transition-colors">{body}</Link>
    : body;
}

function Section({ title, accent, children }: {
  title: string; accent?: boolean; children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <p className={accent ? "section-label flex items-center gap-2" : "section-label"}>
        {accent && <span className="live-dot" />}
        {title}
      </p>
      {children}
    </section>
  );
}

function FixtureRow({ fx, live }: { fx: DashFixture; live?: boolean }) {
  const when = new Date(fx.kickoff_at).toLocaleString("en-GB", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
  return (
    <Link href={`/t/${fx.tournament_id}/live/${fx.id}`}
          className="card block hover:border-volt/40 transition-colors">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <Crest url={fx.home.crest_url} name={fx.home.name} size={18} />
            <span className="text-white text-sm truncate">{fx.home.name}</span>
            <span className="text-mt2 text-xs">v</span>
            <Crest url={fx.away.crest_url} name={fx.away.name} size={18} />
            <span className="text-white text-sm truncate">{fx.away.name}</span>
          </div>
          <p className="text-mt2 text-xs mt-1 font-mono">
            {fx.tournament_name} • {when}
            {fx.venue ? ` • ${fx.venue}` : ""}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-black text-lg text-white">
            {fx.home_score ?? "–"}:{fx.away_score ?? "–"}
          </p>
          <p className={`font-mono text-[10px] ${live ? "text-red2" : "text-mt2"}`}>
            {live ? "LIVE" : String(fx.status).toUpperCase()}
          </p>
        </div>
      </div>
    </Link>
  );
}
