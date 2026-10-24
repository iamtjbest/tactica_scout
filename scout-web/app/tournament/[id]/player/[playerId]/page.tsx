"use client";
/**
 * app/tournament/[id]/player/[playerId]/page.tsx
 *
 * A player in a local competition, opened by clicking a name on the
 * pitch, on the bench, in the timeline or in the ratings list. Mirrors
 * the mobile TournamentPlayerScreen.
 *
 * The stats are this tournament only, not a career total. A schools
 * competition and a church league share the players table, so a
 * lifetime tally on a tournament page would answer a question nobody
 * asked.
 */
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getTournamentPlayer, type TournamentPlayer } from "@/lib/api";

export default function TournamentPlayerPage() {
  const { id, playerId } = useParams<{ id: string; playerId: string }>();
  const [d, setD] = useState<TournamentPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    getTournamentPlayer(id, playerId)
      .then((x) => { if (live) { setD(x); setError(null); } })
      .catch((e) => { if (live) setError(e.message); });
    return () => { live = false; };
  }, [id, playerId]);

  if (error) {
    return (
      <main className="max-w-screen-md mx-auto px-4 pt-6">
        <p className="text-red2 text-sm font-semibold">{error}</p>
      </main>
    );
  }
  if (!d) {
    return (
      <main className="max-w-screen-md mx-auto px-4 pt-6">
        <p className="text-mt text-sm">Loading...</p>
      </main>
    );
  }

  const p = d.player;

  return (
    <main className="max-w-screen-md mx-auto px-4 pt-4 pb-24">
      <Link href={`/tournament/${id}`} className="text-mt text-xs hover:text-white">
        ← Competition
      </Link>

      <div className="card mt-3 flex flex-col items-center gap-3 py-7">
        <Photo url={p.photo_url} name={p.name} />
        <h1 className="font-display font-black text-2xl text-white text-center">
          {p.name}
        </h1>
        <p className="text-mt text-sm">
          {[p.position, p.nationality].filter(Boolean).join(" • ") || "—"}
        </p>
        <div className="flex items-center gap-2">
          <Badge url={d.team.crest_url} name={d.team.name} />
          <span className="text-white text-sm">{d.team.name}</span>
          {p.shirt_number != null && (
            <span className="text-mt2 font-mono text-xs">#{p.shirt_number}</span>
          )}
        </div>
      </div>

      <div className="card mt-3">
        <p className="text-mt text-[10px] font-mono uppercase tracking-wide mb-1">
          This competition
        </p>
        <div className="grid grid-cols-3">
          <Stat label="Apps" value={d.stats.appearances} />
          <Stat label="Starts" value={d.stats.starts} />
          <Stat label="Goals" value={d.stats.goals} />
          <Stat label="Assists" value={d.stats.assists} />
          <Stat label="Yellow" value={d.stats.yellow_cards} />
          <Stat label="Red" value={d.stats.red_cards} danger={d.stats.red_cards > 0} />
        </div>
      </div>

      <p className="text-mt2 text-xs mt-3">
        Counted from the matches the organiser has logged in this competition only.
      </p>
    </main>
  );
}

function initialsOf(name: string) {
  return (name || "?").split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0].toUpperCase()).join("");
}

function Photo({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span className="w-24 h-24 rounded-full bg-sur2 border border-bd
                       flex items-center justify-center">
        <span className="text-volt font-display font-black text-3xl">
          {initialsOf(name)}
        </span>
      </span>
    );
  }
  // Plain img: the photo comes from Supabase storage on a bucket the
  // Next image loader isn't configured for.
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={url} alt={name} onError={() => setFailed(true)}
         className="w-24 h-24 rounded-full object-cover" />
  );
}

function Badge({ url, name }: { url: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  if (!url || failed) {
    return (
      <span className="w-5 h-5 rounded-full bg-sur2 border border-bd
                       flex items-center justify-center">
        <span className="text-mt text-[8px] font-bold">{initialsOf(name)}</span>
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img src={url} alt="" onError={() => setFailed(true)}
         className="w-5 h-5 rounded-full object-cover" />
  );
}

function Stat({ label, value, danger }: {
  label: string; value: number; danger?: boolean;
}) {
  return (
    <div className="py-3 flex flex-col items-center">
      <span className={`font-display font-black text-2xl ${
        danger ? "text-red2" : "text-white"
      }`}>
        {value}
      </span>
      <span className="text-mt text-[10px] font-mono uppercase tracking-wide mt-0.5">
        {label}
      </span>
    </div>
  );
}
