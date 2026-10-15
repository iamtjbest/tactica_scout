"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getPlayerProfile, getPlayerRadar, playerImageUrl, type PlayerDetail } from "@/lib/api";
import RadarChart from "@/components/RadarChart";
import Link from "next/link";
import FollowButton from "@/components/FollowButton";

export default function PlayerPage() {
  const params = useParams();
  const id = Number(params.id);
  const [player, setPlayer] = useState<PlayerDetail | null>(null);
  const [radar, setRadar] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isNaN(id)) return;
    setLoading(true);
    
    Promise.all([
      getPlayerProfile(id).catch((err) => { throw err; }),
      getPlayerRadar(id, undefined, 50).catch(() => null) // Attempt to load radar data if available
    ])
    .then(([profile, radarData]) => {
      setPlayer(profile);
      if (radarData && radarData.radar) {
        setRadar(radarData.radar);
      }
      setError(null);
    })
    .catch((err) => setError(err.message || "Failed to load player."))
    .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="text-mt text-sm p-4">Loading player...</p>;
  if (error) return <p className="text-red2 text-sm p-4 font-semibold">{error}</p>;
  if (!player) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={playerImageUrl(player.id) || ""}
            alt={player.name}
            className="w-20 h-20 rounded-full object-cover bg-bg2"
            onError={(e) => { e.currentTarget.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="%232C2C2C"><circle cx="12" cy="8" r="4"/><path d="M4 22c0-4 4-7 8-7s8 3 8 7"/></svg>'; }}
          />
          <div>
            <h1 className="font-display font-black text-2xl text-white">{player.name}</h1>
            <p className="text-mt text-sm mt-1">{player.nationality} • {player.position}</p>
          </div>
        </div>
        <FollowButton entityType="player" entityId={player.id} entityName={player.name} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bio/Info Card */}
        <div className="card space-y-4">
          <h2 className="text-white font-semibold mb-2">Info</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-mt text-xs uppercase tracking-wide">Age</p>
              <p className="text-white mt-1">
                {player.date_of_birth ? Math.floor((new Date().getTime() - new Date(player.date_of_birth).getTime()) / 31557600000) : "-"}
              </p>
            </div>
            <div>
              <p className="text-mt text-xs uppercase tracking-wide">Height</p>
              <p className="text-white mt-1">{player.height_cm ? `${player.height_cm} cm` : "-"}</p>
            </div>
            <div>
              <p className="text-mt text-xs uppercase tracking-wide">Preferred Foot</p>
              <p className="text-white mt-1">{player.preferred_foot || "-"}</p>
            </div>
            <div>
              <p className="text-mt text-xs uppercase tracking-wide">Jersey</p>
              <p className="text-white mt-1">{player.jersey_number || "-"}</p>
            </div>
            <div>
              <p className="text-mt text-xs uppercase tracking-wide">Current Team</p>
              {player.current_team ? (
                <Link href={`/team/${player.current_team.id}`} className="text-volt2 hover:underline mt-1 block">
                  {player.current_team.name}
                </Link>
              ) : (
                <p className="text-white mt-1">-</p>
              )}
            </div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="card">
          <h2 className="text-white font-semibold mb-2">Season Performance</h2>
          {radar ? (
            <div className="flex justify-center mt-4">
              <RadarChart playerA={{ name: player.short_name || player.name, values: radar }} playerB={null} />
            </div>
          ) : (
            <p className="text-mt text-sm h-32 flex items-center justify-center">Not enough data for radar chart.</p>
          )}
        </div>
      </div>
    </div>
  );
}
