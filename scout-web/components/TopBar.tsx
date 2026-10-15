"use client";

import Link from "next/link";
import { Settings, Search, X, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { globalSearch } from "@/lib/api";
import { useRouter } from "next/navigation";

export default function TopBar() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <header className="border-b border-bd bg-sur/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-screen-md mx-auto px-4 flex items-center justify-between h-14">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-volt to-cyan flex items-center justify-center font-display font-black text-bg text-sm">
              S
            </div>
            <span className="font-display font-black text-lg text-white tracking-tight">
              Scout
            </span>
            <span className="font-mono text-[9px] tracking-[0.2em] text-mt uppercase ml-1">
              by Tactica
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsOpen(true)}
              className="text-mt hover:text-white transition-colors p-2 flex items-center gap-2 text-sm bg-white/5 rounded-md border border-white/5 pr-3"
            >
              <Search size={16} />
              <span className="text-xs hidden sm:inline-block border text-mt/50 border-mt/20 rounded px-1.5 py-0.5">⌘K</span>
            </button>
            <Link href="/settings" aria-label="Settings" className="text-mt hover:text-white transition-colors p-2">
              <Settings size={20} />
            </Link>
          </div>
        </div>
      </header>
      
      {isOpen && <SearchModal onClose={() => setIsOpen(false)} />}
    </>
  );
}

function SearchModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ teams: any[]; players: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      globalSearch(query)
        .then((data) => setResults(data))
        .catch(() => setResults(null))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4">
      <div className="bg-sur border border-bd w-full max-w-lg rounded-xl shadow-2xl overflow-hidden flex flex-col">
        <div className="p-4 border-b border-bd flex items-center gap-3">
          <Search size={20} className="text-mt" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search teams or players..."
            className="flex-1 bg-transparent border-none outline-none text-white text-lg placeholder:text-mt"
          />
          {loading && <Loader2 size={18} className="animate-spin text-volt" />}
          <button onClick={onClose} className="p-1 text-mt hover:text-white rounded-md bg-white/5">
            <X size={20} />
          </button>
        </div>
        
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {!query ? (
            <p className="p-8 text-center text-mt text-sm">Start typing to search...</p>
          ) : results ? (
            <div className="space-y-4 p-2">
              {results.teams.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-mt mb-2 px-2">Teams</p>
                  {results.teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        onClose();
                        router.push(`/team/${t.id}`);
                      }}
                      className="w-full text-left p-3 hover:bg-white/5 rounded-lg flex items-center justify-between"
                    >
                      <span className="text-white font-semibold">{t.name}</span>
                      <span className="text-xs text-mt">{t.country}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.players.length > 0 && (
                <div>
                  <p className="text-xs font-mono uppercase tracking-widest text-mt mb-2 px-2">Players</p>
                  {results.players.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onClose();
                        router.push(`/player/${p.id}`);
                      }}
                      className="w-full text-left p-3 hover:bg-white/5 rounded-lg flex items-center justify-between"
                    >
                      <div>
                        <p className="text-white font-semibold">{p.name}</p>
                        <p className="text-xs text-mt">{p.team}</p>
                      </div>
                      <span className="text-xs text-mt">{p.nationality}</span>
                    </button>
                  ))}
                </div>
              )}
              {results.teams.length === 0 && results.players.length === 0 && (
                <p className="p-8 text-center text-mt text-sm">No results found for "{query}"</p>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
