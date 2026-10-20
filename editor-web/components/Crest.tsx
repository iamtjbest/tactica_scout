"use client";
import { useState } from "react";
import clsx from "clsx";

/**
 * A club crest, or a readable fallback.
 *
 * Most department sides will never have a badge, and a broken-image
 * icon next to every fixture looks worse than no badge at all. So a
 * missing or failed crest renders initials on a tinted circle, which
 * is recognisable at 16px and never breaks the row's alignment.
 */
export default function Crest({
  url, name, size = 20,
}: {
  url?: string | null; name?: string | null; size?: number;
}) {
  const [failed, setFailed] = useState(false);
  const initials = (name || "?")
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((w) => w[0]!.toUpperCase()).join("");

  if (!url || failed) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-sur2 text-mt shrink-0"
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.42) }}
        title={name || undefined}
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setFailed(true)}
      className={clsx("object-contain shrink-0 rounded-full bg-sur2")}
      style={{ width: size, height: size }}
    />
  );
}
