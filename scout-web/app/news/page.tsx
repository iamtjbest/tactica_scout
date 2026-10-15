"use client";
import { useEffect, useState } from "react";
import { getNews, type NewsItem } from "@/lib/api";

function formatDate(raw: string): string {
  const d = new Date(raw);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SourceBadge({ source }: { source: NewsItem["source"] }) {
  const label = source === "medium" ? "MEDIUM" : "X";
  return (
    <span className="font-mono text-[10px] font-bold tracking-[0.18em] uppercase text-volt">
      {label}
    </span>
  );
}

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getNews()
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message || "Failed to load news."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-black text-2xl text-white">News</h1>
        <p className="text-mt text-sm mt-1">Latest from Medium and X.</p>
      </div>

      {loading && <p className="text-mt text-sm">Loading news...</p>}

      {error && (
        <div className="card border-red2/40">
          <p className="text-red2 text-sm font-semibold">{error}</p>
          <p className="text-mt text-xs mt-1">
            Make sure the backend is running and NEXT_PUBLIC_API_URL points at it.
          </p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <p className="text-mt text-sm">Nothing here yet.</p>
      )}

      <div className="space-y-3">
        {items.map((item, i) => (
          <a
            key={`${item.url}-${i}`}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="card block hover:border-volt/40 transition-colors"
          >
            <div className="flex items-center justify-between mb-2">
              <SourceBadge source={item.source} />
              {item.published && <span className="text-mt text-xs font-mono">{formatDate(item.published)}</span>}
            </div>
            <p className="text-white text-sm font-semibold mb-1">{item.title}</p>
            {item.excerpt && <p className="text-mt text-xs leading-relaxed">{item.excerpt}</p>}
          </a>
        ))}
      </div>
    </div>
  );
}
