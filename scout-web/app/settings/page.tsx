"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { getMe, updateFollowedTeams, updateLanguage, type ScoutUser } from "@/lib/api";

// Language list is a placeholder set -- there's no i18n wiring behind
// this yet (no translated strings anywhere in the app), this just
// stores the preference so it exists when that work happens.
const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
];

export default function SettingsPage() {
  const [user, setUser] = useState<ScoutUser | null>(null);
  const [signedOutView, setSignedOutView] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [teamInput, setTeamInput] = useState("");

  useEffect(() => {
    if (typeof window === "undefined" || !window.localStorage.getItem("scout_token")) {
      setSignedOutView(true);
      setLoading(false);
      return;
    }
    getMe()
      .then((d) => setUser(d.user))
      .catch((e) => {
        // Token's stale/invalid -- drop it rather than looping on a
        // request that will keep failing.
        window.localStorage.removeItem("scout_token");
        setSignedOutView(true);
        setError(e.message || "Failed to load your account.");
      })
      .finally(() => setLoading(false));
  }, []);

  function signOut() {
    window.localStorage.removeItem("scout_token");
    setUser(null);
    setSignedOutView(true);
  }

  async function addTeam() {
    if (!user || !teamInput.trim()) return;
    const teams = [...user.followed_teams, teamInput.trim()];
    try {
      const { user: updated } = await updateFollowedTeams(teams);
      setUser(updated);
      setTeamInput("");
    } catch (e: any) {
      setError(e.message || "Failed to add team.");
    }
  }

  async function removeTeam(team: string) {
    if (!user) return;
    const teams = user.followed_teams.filter((t) => t !== team);
    try {
      const { user: updated } = await updateFollowedTeams(teams);
      setUser(updated);
    } catch (e: any) {
      setError(e.message || "Failed to remove team.");
    }
  }

  async function changeLanguage(code: string) {
    try {
      const { user: updated } = await updateLanguage(code);
      setUser(updated);
    } catch (e: any) {
      setError(e.message || "Failed to update language.");
    }
  }

  if (loading) return <p className="text-mt text-sm">Loading...</p>;

  if (signedOutView || !user) {
    return (
      <div className="space-y-4">
        <h1 className="font-display font-black text-2xl text-white">Settings</h1>
        <p className="text-mt text-sm">Sign in to manage followed teams and language.</p>
        {error && <p className="text-red2 text-sm">{error}</p>}
        <div className="flex gap-3">
          <Link href="/signin" className="btn-volt">Sign in</Link>
          <Link href="/signup" className="tab-pill tab-pill-inactive">Sign up</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-black text-2xl text-white">Settings</h1>
          <p className="text-mt text-sm mt-1">Signed in as {user.username}</p>
        </div>
        <button onClick={signOut} className="tab-pill tab-pill-inactive">Sign out</button>
      </div>

      {error && <p className="text-red2 text-sm">{error}</p>}

      <div className="card space-y-3">
        <p className="section-label">Followed Entities</p>
        <p className="text-mt text-xs">
          Manage your followed teams, leagues, and players here.
        </p>
        <div className="flex flex-wrap gap-2">
          {user.followed_teams.length === 0 && <p className="text-mt text-xs">No entities followed yet.</p>}
          {user.followed_teams.map((t) => {
            const parts = t.split(":");
            let typeLabel = "Team";
            let name = t;
            let icon = "⚽";
            
            if (parts.length >= 3) {
              const type = parts[0];
              name = parts.slice(2).join(":"); // Name might contain colons
              
              if (type === "team") { typeLabel = "Team"; icon = "🛡️"; }
              if (type === "league") { typeLabel = "League"; icon = "🏆"; }
              if (type === "player") { typeLabel = "Player"; icon = "🏃"; }
            }
            
            return (
            <span key={t} className="tab-pill tab-pill-active flex items-center gap-2">
              <span className="text-[10px] uppercase opacity-70 border-r border-volt2/30 pr-1.5 mr-0.5">{icon} {typeLabel}</span>
              {name}
              <button onClick={() => removeTeam(t)} className="text-volt/70 hover:text-volt ml-1" aria-label={`Remove ${name}`}>
                ×
              </button>
            </span>
          )})}
        </div>
      </div>

      <div className="card space-y-3">
        <p className="section-label">Language</p>
        <div className="flex gap-2 flex-wrap">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              onClick={() => changeLanguage(l.code)}
              className={clsx("tab-pill", user.language === l.code ? "tab-pill-active" : "tab-pill-inactive")}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
