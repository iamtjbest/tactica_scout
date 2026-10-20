"use client";

import { useEffect, useState } from "react";

/**
 * The sign-in panel visual: a floodlit ground at night, drawn.
 *
 * ── Dropping in your own artwork ──────────────────────────────────
 * Export a graphic from Figma to `public/signin.jpg` (or .png) and it
 * takes over this panel automatically. No code change. If the file
 * isn't there the <img> fails quietly and the drawn version below
 * shows through, so the panel is never broken or blank.
 *
 * Everything here is drawn rather than photographed: house rule is that
 * images come from Figma or are generated, never stock, and a drawn
 * scene costs kilobytes where a stadium photo costs megabytes.
 *
 * Note on the crowd: the dots are placed by a seeded generator, not
 * Math.random. A random value computed during render differs between
 * the server pass and the browser pass, and React throws a hydration
 * mismatch. Seeded means both passes draw the identical crowd.
 */

/** Deterministic PRNG (mulberry32). Same seed, same picture, always. */
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A bank of seats: dots of light, denser toward the back. */
function crowd(seed: number, x: number, y: number, w: number, h: number, n: number) {
  const r = rng(seed);
  const out: { x: number; y: number; r: number; o: number; c: string }[] = [];
  // Mostly cool white, with enough volt and cyan in it to read as a
  // Tactica crowd rather than a generic one.
  const palette = ["#FFFFFF", "#FFFFFF", "#CCFF00", "#00E5FF", "#8A9BA8"];
  for (let i = 0; i < n; i++) {
    const u = r(), v = r();
    out.push({
      x: x + u * w,
      y: y + v * v * h,          // bunched toward the top of the bank
      r: 0.7 + r() * 1.5,
      o: 0.18 + r() * 0.6,
      c: palette[Math.floor(r() * palette.length)],
    });
  }
  return out;
}

/** Each stand: a clip id and its outline. */
const STANDS: [string, string][] = [
  ["sa-stand-b", "M180 36 L820 36 L762 150 L238 150 Z"],
  ["sa-stand-l", "M-10 84 L238 150 L238 312 L-10 280 Z"],
  ["sa-stand-r", "M1010 84 L762 150 L762 312 L1010 280 Z"],
];

export default function StadiumArt() {
  // The custom artwork is probed before it is rendered. Rendering an
  // <img> and reacting to onError leaves the browser's broken-image
  // glyph on screen in the gap, which looked like a bug on the panel.
  const [art, setArt] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    for (const src of ["/signin.jpg", "/signin.png", "/signin.webp"]) {
      const probe = new Image();
      probe.onload = () => { if (live) setArt((cur) => cur ?? src); };
      probe.src = src;
    }
    return () => { live = false; };
  }, []);

  const standL = crowd(11, 0, 92, 300, 150, 420);
  const standR = crowd(29, 700, 92, 300, 150, 420);
  const standB = crowd(47, 180, 40, 640, 95, 520);

  return (
    <div className="absolute inset-0 bg-bg2">
      {/* Your Figma export, once confirmed to exist. */}
      {art && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={art} alt="" className="absolute inset-0 w-full h-full object-cover z-20" />
      )}

      <svg
        viewBox="0 0 1000 900"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0 w-full h-full"
        aria-hidden="true"
      >
        <defs>
          {/* Night sky over the ground. */}
          <linearGradient id="sa-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#0A0F13" />
            <stop offset="55%"  stopColor="#0D1A1E" />
            <stop offset="100%" stopColor="#0A1410" />
          </linearGradient>

          {/* The grass, lit from above and falling off at the edges. */}
          <radialGradient id="sa-grass" cx="50%" cy="34%" r="78%">
            <stop offset="0%"   stopColor="#16331F" />
            <stop offset="55%"  stopColor="#102519" />
            <stop offset="100%" stopColor="#0B1612" />
          </radialGradient>

          {/* Floodlight cones. */}
          <linearGradient id="sa-beam" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#CCFF00" stopOpacity="0.17" />
            <stop offset="100%" stopColor="#CCFF00" stopOpacity="0" />
          </linearGradient>

          <radialGradient id="sa-lamp">
            <stop offset="0%"   stopColor="#FFFFFF" stopOpacity="0.95" />
            <stop offset="40%"  stopColor="#CCFF00" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#CCFF00" stopOpacity="0" />
          </radialGradient>

          <filter id="sa-soft" x="-60%" y="-60%" width="220%" height="220%">
            <feGaussianBlur stdDeviation="12" />
          </filter>
        </defs>

        <rect width="1000" height="900" fill="url(#sa-sky)" />

        {/* ── stands ─────────────────────────────────────────── */}
        {/* Far bank, then the two sides, each tilted toward the pitch.
            Each bank is a clip path as well as a fill, so the crowd
            stays seated inside it. */}
        {STANDS.map(([id, d]) => (
          <clipPath key={id} id={id}><path d={d} /></clipPath>
        ))}

        {STANDS.map(([id, d], i) => (
          <g key={id}>
            <path d={d} fill={i === 0 ? "#131C21" : "#101820"} />
            {/* roof lip, so the bank has an edge instead of dissolving */}
            <path d={d} fill="none" stroke="#1E2A33" strokeWidth="2" />
            <g clipPath={`url(#${id})`}>
              {[standB, standL, standR][i].map((p, j) => (
                <circle key={j} cx={p.x} cy={p.y} r={p.r} fill={p.c} opacity={p.o} />
              ))}
            </g>
          </g>
        ))}

        {/* ── floodlights ────────────────────────────────────── */}
        {[
          [148, 70], [852, 70], [92, 150], [908, 150],
        ].map(([x, y], i) => (
          <g key={i}>
            <path
              d={`M${x} ${y} L${x - 210} 620 L${x + 210} 620 Z`}
              fill="url(#sa-beam)"
            />
            <circle cx={x} cy={y} r="56" fill="url(#sa-lamp)" filter="url(#sa-soft)" />
            <rect x={x - 17} y={y - 9} width="34" height="18" rx="3" fill="#CCFF00" opacity="0.9" />
          </g>
        ))}

        {/* ── the pitch ──────────────────────────────────────── */}
        <path d="M250 300 L750 300 L1010 860 L-10 860 Z" fill="url(#sa-grass)" />

        {/* mown bands */}
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const t0 = i / 6, t1 = (i + 1) / 6;
          const lx = (t: number) => 250 - 260 * t;
          const rx = (t: number) => 750 + 260 * t;
          const yy = (t: number) => 300 + 560 * t;
          return i % 2 === 0 ? null : (
            <path
              key={i}
              d={`M${lx(t0)} ${yy(t0)} L${rx(t0)} ${yy(t0)} L${rx(t1)} ${yy(t1)} L${lx(t1)} ${yy(t1)} Z`}
              fill="#FFFFFF" opacity="0.022"
            />
          );
        })}

        {/* markings */}
        <g fill="none" stroke="#CCFF00" strokeWidth="2" opacity="0.5">
          <path d="M250 300 L750 300 L1010 860 L-10 860 Z" />
          {/* penalty area at the far end */}
          <path d="M370 300 L630 300 L661 368 L339 368 Z" />
          <path d="M441 300 L559 300 L569 326 L431 326 Z" />
          {/* halfway + centre circle */}
          <path d="M136 545 L864 545" />
          <ellipse cx="500" cy="545" rx="128" ry="40" />
          <circle cx="500" cy="545" r="3.4" fill="#CCFF00" stroke="none" opacity="0.9" />
        </g>

        {/* the goal, picked out in cyan so the eye lands somewhere */}
        <g opacity="0.85">
          <rect x="432" y="279" width="136" height="22" rx="2"
                fill="none" stroke="#00E5FF" strokeWidth="2.5" />
          <rect x="432" y="279" width="136" height="22" fill="#00E5FF" opacity="0.1" />
        </g>

        {/* A move, looping. Three passes, finishing on goal. */}
        <g>
          <path
            d="M250 780 L420 650 L690 690 L500 345"
            stroke="#00E5FF" strokeWidth="2.5" strokeDasharray="9 11"
            fill="none" opacity="0.55"
          />
          <circle r="7" fill="#CCFF00">
            <animate attributeName="opacity" values="0;1;1;0" dur="5.5s" repeatCount="indefinite" />
            <animateMotion dur="5.5s" repeatCount="indefinite"
                           path="M250 780 L420 650 L690 690 L500 345" />
          </circle>
        </g>

        {/* haze over the grass, so the markings sit in light rather than
            on a flat fill */}
        <ellipse cx="500" cy="520" rx="430" ry="230"
                 fill="#CCFF00" opacity="0.045" filter="url(#sa-soft)" />
      </svg>

      {/* Vignette, and a lift of colour at the bottom where the copy sits. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_38%,transparent_35%,rgba(10,15,19,0.75)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-bg2 via-bg2/85 to-transparent" />
    </div>
  );
}
