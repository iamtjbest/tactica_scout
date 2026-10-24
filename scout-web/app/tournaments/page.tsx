"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { getTournaments, type TournamentSummary } from "@/lib/api";

/**
 * Local competitions: university leagues, school cups, company
 * five-a-sides. Everything here was entered in Scout Editor and
 * approved, and the backend only ever serves approved ones.
 *
 * Grouped by country, because "is anything running near me" is the
 * question people arrive with, and by level inside that, because a
 * university league and a corporate five-a-side are not browsed the
 * same way.
 */
const LEVEL_LABEL: Record<string, string> = {
  university: "University / college",
  school: "School",
  youth: "Youth / academy",
  amateur: "Amateur",
  semi_professional: "Semi-professional",
  professional: "Professional",
  corporate: "Corporate / workplace",
  community: "Community / local",
};

export default function TournamentsPage() {
  const [rows, setRows] = useState<TournamentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    getTournaments()
      .then((d) => { setRows(d.tournaments); setError(null); })
      .catch((e) => setError(e.message));
  }, []);

  const term = q.trim().toLowerCase();
  const shown = (rows ?? []).filter(
    (t) =>
      !term ||
      t.name.toLowerCase().includes(term) ||
      t.organizing_body.toLowerCase().includes(term) ||
      t.country.toLowerCase().includes(term)
  );

  const byCountry: Record<string, TournamentSummary[]> = {};
  for (const t of shown) (byCountry[t.country] ||= []).push(t);
  const countries = Object.keys(byCountry).sort();

  return (
    <main className="max-w-screen-md mx-auto px-4 pt-4 pb-24">
      <h1 className="font-display font-black text-2xl text-white">Competitions</h1>
      <p className="text-mt text-sm mt-1">
        University, school and local football, tracked like the big leagues.
      </p>

      {rows !== null && rows.length > 3 && (
        <input
          className="w-full bg-sur2 border border-bd rounded-lg px-3 py-2 mt-4 text-white
                     text-sm placeholder:text-mt2 focus:outline-none focus:border-volt"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search competitions"
        />
      )}

      {error && (
        <div className="card mt-4 border-red2/40">
          <p className="text-red2 text-sm font-semibold">{error}</p>
        </div>
      )}

      {rows === null && !error && <p className="text-mt text-sm mt-6">Loading...</p>}

      {rows !== null && rows.length === 0 && (
        <div className="card mt-6 text-center py-10">
          <Trophy size={22} className="text-mt mx-auto mb-3" />
          <p className="text-white font-semibold">No competitions published yet</p>
          <p className="text-mt text-sm mt-1 max-w-sm mx-auto">
            Organisers run their competition in Scout Editor. Once it&apos;s
            approved it shows up here.
          </p>
        </div>
      )}

      {rows !== null && rows.length > 0 && shown.length === 0 && (
        <p className="text-mt text-sm mt-6">Nothing matches &ldquo;{q}&rdquo;.</p>
      )}

      <div className="mt-6 space-y-6">
        {countries.map((country) => (
          <section key={country}>
            <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-2">
              {country}
            </p>
            <div className="space-y-2">
              {byCountry[country].map((t) => (
                <Link
                  key={t.id}
                  href={`/tournament/${t.id}`}
                  className="card block hover:border-volt/40 transition-colors"
                >
                  <p className="text-white font-semibold">{t.name}</p>
                  <p className="text-mt text-xs mt-1">
                    {t.organizing_body} • {LEVEL_LABEL[t.level] ?? t.level}
                  </p>
                  <p className="text-mt2 text-xs mt-1 font-mono">
                    {t.start_date} to {t.end_date}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
