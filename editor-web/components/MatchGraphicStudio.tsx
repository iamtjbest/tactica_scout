"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
    getBilling,
    getFixturePrediction,
    uploadMatchGraphic,
    type Billing,
    type Fixture,
    type FixturePrediction,
    type MatchEvent,
    type TeamRow,
    type Tournament,
} from "@/lib/api";

type Props = {
    tournament: Tournament;
    fixture: Fixture;
    teams: TeamRow[];
    events: MatchEvent[];
};

function loadImageSafe(url?: string | null): Promise<HTMLImageElement | null> {
    return new Promise((resolve) => {
        if (!url) return resolve(null);
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number
) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function drawBadge(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    name: string,
    accent: string,
    cx: number,
    cy: number,
    size: number
) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = "#0D1317";
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = accent;
    ctx.stroke();

    if (img) {
        ctx.clip();
        const pad = size * 0.14;
        ctx.drawImage(img, cx - size / 2 + pad, cy - size / 2 + pad, size - pad * 2, size - pad * 2);
    } else {
        const initials = (name || "?")
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map((w) => w[0]!.toUpperCase())
            .join("");
        ctx.fillStyle = "#FFFFFF";
        ctx.font = `900 ${Math.round(size * 0.32)}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(initials, cx, cy + 2);
    }
    ctx.restore();
}

function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    cx: number,
    startY: number,
    maxWidth: number,
    lineHeight: number
) {
    const words = text.split(" ");
    let line = "";
    let y = startY;
    for (let n = 0; n < words.length; n++) {
        const test = line ? `${line} ${words[n]}` : words[n];
        if (ctx.measureText(test).width > maxWidth && line) {
            ctx.fillText(line, cx, y);
            line = words[n];
            y += lineHeight;
        } else {
            line = test;
        }
    }
    if (line) ctx.fillText(line, cx, y);
}

export default function MatchGraphicStudio({ tournament, fixture, teams, events }: Props) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const [kind, setKind] = useState<"prematch" | "ft">(
        fixture.status === "ft" ? "ft" : "prematch"
    );
    const [pred, setPred] = useState<FixturePrediction | null>(null);
    const [billing, setBilling] = useState<Billing | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savedUrl, setSavedUrl] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const homeTeam = teams.find((t) => t.id === fixture.home_team_id);
    const awayTeam = teams.find((t) => t.id === fixture.away_team_id);

    const homeName = homeTeam?.clubs?.name ?? "Home Team";
    const awayName = awayTeam?.clubs?.name ?? "Away Team";
    const homeColor = homeTeam?.home_color || "#CCFF00";
    const awayColor = awayTeam?.home_color || "#00E5FF";

    useEffect(() => {
        getFixturePrediction(fixture.id)
            .then((res) => setPred(res.prediction))
            .catch(() => { });
        getBilling()
            .then(setBilling)
            .catch(() => { });
    }, [fixture.id]);

    const renderCanvas = useCallback(async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const W = 1080;
        const H = 1350;
        canvas.width = W;
        canvas.height = H;

        const [compLogo, homeLogo, awayLogo] = await Promise.all([
            loadImageSafe(tournament.crest_url),
            loadImageSafe(homeTeam?.clubs?.crest_url),
            loadImageSafe(awayTeam?.clubs?.crest_url),
        ]);

        // 1. Background
        const bgGrad = ctx.createLinearGradient(0, 0, W, H);
        bgGrad.addColorStop(0, "#0A1014");
        bgGrad.addColorStop(0.5, "#101920");
        bgGrad.addColorStop(1, "#090E12");
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Subtle top glow
        const glow = ctx.createRadialGradient(W / 2, 120, 40, W / 2, 120, 560);
        glow.addColorStop(0, "rgba(204, 255, 0, 0.14)");
        glow.addColorStop(1, "rgba(204, 255, 0, 0)");
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, W, 680);

        // Outer frame
        roundRect(ctx, 44, 44, W - 88, H - 88, 36);
        ctx.fillStyle = "rgba(19, 27, 34, 0.85)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
        ctx.stroke();

        // 2. Top Header: Competition Logo + Name + Mode Pill
        let headerTextX = 96;
        if (compLogo) {
            drawBadge(ctx, compLogo, tournament.name, "#CCFF00", 124, 122, 56);
            headerTextX = 170;
        }

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 26px sans-serif";
        ctx.fillText(tournament.name.toUpperCase(), headerTextX, 110);

        ctx.fillStyle = "#8A9BA8";
        ctx.font = "700 18px monospace";
        const subLine = [
            fixture.group_name ? `GROUP ${fixture.group_name.replace(/^group\s*/i, "")}` : null,
            fixture.round,
        ]
            .filter(Boolean)
            .join(" • ") || tournament.organizing_body.toUpperCase();
        ctx.fillText(subLine, headerTextX, 142);

        // Mode Badge (Top Right)
        const badgeLabel = kind === "prematch" ? "PRE-MATCH MODEL" : "FULL TIME";
        roundRect(ctx, W - 336, 94, 244, 54, 27);
        ctx.fillStyle = kind === "prematch" ? "rgba(204, 255, 0, 0.14)" : "rgba(0, 229, 255, 0.14)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = kind === "prematch" ? "#CCFF00" : "#00E5FF";
        ctx.stroke();

        ctx.fillStyle = kind === "prematch" ? "#CCFF00" : "#00E5FF";
        ctx.font = "900 18px monospace";
        ctx.textAlign = "center";
        ctx.fillText(badgeLabel, W - 214, 122);

        // Divider
        ctx.beginPath();
        ctx.moveTo(92, 194);
        ctx.lineTo(W - 92, 194);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 2;
        ctx.stroke();

        // 3. Teams Hero Section
        const leftX = 275;
        const rightX = W - 275;
        const crestY = 345;

        drawBadge(ctx, homeLogo, homeName, homeColor, leftX, crestY, 176);
        drawBadge(ctx, awayLogo, awayName, awayColor, rightX, crestY, 176);

        ctx.fillStyle = "#FFFFFF";
        ctx.font = "900 32px sans-serif";
        ctx.textAlign = "center";
        wrapText(ctx, homeName.toUpperCase(), leftX, 478, 320, 38);
        wrapText(ctx, awayName.toUpperCase(), rightX, 478, 320, 38);

        // Center Score or VS
        if (kind === "ft") {
            roundRect(ctx, W / 2 - 125, 285, 250, 120, 24);
            ctx.fillStyle = "#0D1317";
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.strokeStyle = "#CCFF00";
            ctx.stroke();

            ctx.fillStyle = "#CCFF00";
            ctx.font = "900 68px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(`${fixture.home_score ?? 0} - ${fixture.away_score ?? 0}`, W / 2, 348);
        } else {
            ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
            ctx.font = "900 46px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("VS", W / 2, 348);
        }

        // Kickoff & Venue Pill
        const dtText = fixture.kickoff_at
            ? new Date(fixture.kickoff_at).toLocaleString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
            })
            : "KICKOFF TBD";
        const metaText = [dtText.toUpperCase(), fixture.venue?.toUpperCase()].filter(Boolean).join("  •  ");
        ctx.fillStyle = "#8A9BA8";
        ctx.font = "700 20px monospace";
        ctx.textAlign = "center";
        ctx.fillText(metaText, W / 2, 585);

        // 4. Body Panel: Pre-Match Probabilities & ATK/DEF OR Full-Time Scorers
        if (kind === "prematch") {
            const p = pred || {
                home_attack: Number(homeTeam?.attack_rating ?? 54),
                home_defence: Number(homeTeam?.defence_rating ?? 54),
                away_attack: Number(awayTeam?.attack_rating ?? 54),
                away_defence: Number(awayTeam?.defence_rating ?? 54),
                home_win_prob: 33.3,
                draw_prob: 33.4,
                away_win_prob: 33.3,
            };

            // Win Probability Box
            roundRect(ctx, 92, 635, W - 184, 240, 26);
            ctx.fillStyle = "#0D1317";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(204, 255, 0, 0.25)";
            ctx.stroke();

            ctx.fillStyle = "#CCFF00";
            ctx.font = "900 19px monospace";
            ctx.textAlign = "left";
            ctx.fillText("WIN PROBABILITY", 132, 682);

            ctx.fillStyle = "#8A9BA8";
            ctx.font = "700 17px monospace";
            ctx.textAlign = "right";
            ctx.fillText("TACTICA ENGINE", W - 132, 682);

            // Bar
            const barX = 132;
            const barY = 716;
            const barW = W - 264;
            const barH = 34;
            const wHome = Math.max(12, (p.home_win_prob / 100) * barW);
            const wDraw = Math.max(12, (p.draw_prob / 100) * barW);
            const wAway = Math.max(12, barW - wHome - wDraw);

            ctx.fillStyle = "#CCFF00";
            ctx.fillRect(barX, barY, wHome - 4, barH);
            ctx.fillStyle = "#334155";
            ctx.fillRect(barX + wHome, barY, wDraw - 4, barH);
            ctx.fillStyle = "#00E5FF";
            ctx.fillRect(barX + wHome + wDraw, barY, wAway, barH);

            // Percentages
            ctx.textAlign = "left";
            ctx.fillStyle = "#CCFF00";
            ctx.font = "900 38px sans-serif";
            ctx.fillText(`${p.home_win_prob}%`, 132, 804);
            ctx.fillStyle = "#8A9BA8";
            ctx.font = "700 16px monospace";
            ctx.fillText("HOME WIN", 132, 838);

            ctx.textAlign = "center";
            ctx.fillStyle = "#FFFFFF";
            ctx.font = "900 38px sans-serif";
            ctx.fillText(`${p.draw_prob}%`, W / 2, 804);
            ctx.fillStyle = "#8A9BA8";
            ctx.font = "700 16px monospace";
            ctx.fillText("DRAW", W / 2, 838);

            ctx.textAlign = "right";
            ctx.fillStyle = "#00E5FF";
            ctx.font = "900 38px sans-serif";
            ctx.fillText(`${p.away_win_prob}%`, W - 132, 804);
            ctx.fillStyle = "#8A9BA8";
            ctx.font = "700 16px monospace";
            ctx.fillText("AWAY WIN", W - 132, 838);

            // ATK / DEF Comparison Cards
            const cardW = (W - 212) / 2;
            const cardY = 905;
            const cardH = 225;

            // Home ATK/DEF
            roundRect(ctx, 92, cardY, cardW, cardH, 24);
            ctx.fillStyle = "#0D1317";
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.stroke();

            ctx.fillStyle = "#8A9BA8";
            ctx.font = "800 17px monospace";
            ctx.textAlign = "center";
            ctx.fillText("HOME TEAM RATINGS", 92 + cardW / 2, cardY + 42);

            ctx.fillStyle = "#CCFF00";
            ctx.font = "900 56px sans-serif";
            ctx.fillText(String(p.home_attack), 92 + cardW * 0.28, cardY + 122);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(String(p.home_defence), 92 + cardW * 0.72, cardY + 122);

            ctx.fillStyle = "#8A9BA8";
            ctx.font = "800 18px monospace";
            ctx.fillText("ATK", 92 + cardW * 0.28, cardY + 174);
            ctx.fillText("DEF", 92 + cardW * 0.72, cardY + 174);

            // Away ATK/DEF
            const rightCardX = 92 + cardW + 28;
            roundRect(ctx, rightCardX, cardY, cardW, cardH, 24);
            ctx.fillStyle = "#0D1317";
            ctx.fill();
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.stroke();

            ctx.fillStyle = "#8A9BA8";
            ctx.font = "800 17px monospace";
            ctx.textAlign = "center";
            ctx.fillText("AWAY TEAM RATINGS", rightCardX + cardW / 2, cardY + 42);

            ctx.fillStyle = "#00E5FF";
            ctx.font = "900 56px sans-serif";
            ctx.fillText(String(p.away_attack), rightCardX + cardW * 0.28, cardY + 122);
            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(String(p.away_defence), rightCardX + cardW * 0.72, cardY + 122);

            ctx.fillStyle = "#8A9BA8";
            ctx.font = "800 18px monospace";
            ctx.fillText("ATK", rightCardX + cardW * 0.28, cardY + 174);
            ctx.fillText("DEF", rightCardX + cardW * 0.72, cardY + 174);
        } else {
            // FULL TIME GOALSCORERS PANEL
            roundRect(ctx, 92, 635, W - 184, 495, 26);
            ctx.fillStyle = "#0D1317";
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
            ctx.stroke();

            ctx.fillStyle = "#CCFF00";
            ctx.font = "900 19px monospace";
            ctx.textAlign = "center";
            ctx.fillText("MATCH SUMMARY & GOALSCORERS", W / 2, 684);

            const goalEvents = events
                .filter((e) => ["goal", "penalty_scored", "own_goal"].includes(e.type))
                .sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));

            const homeGoals = goalEvents.filter(
                (e) =>
                    (e.tournament_team_id === fixture.home_team_id && e.type !== "own_goal") ||
                    (e.tournament_team_id === fixture.away_team_id && e.type === "own_goal")
            );
            const awayGoals = goalEvents.filter(
                (e) =>
                    (e.tournament_team_id === fixture.away_team_id && e.type !== "own_goal") ||
                    (e.tournament_team_id === fixture.home_team_id && e.type === "own_goal")
            );

            if (goalEvents.length === 0) {
                ctx.fillStyle = "#8A9BA8";
                ctx.font = "600 24px sans-serif";
                ctx.fillText(
                    (fixture.home_score ?? 0) === 0 && (fixture.away_score ?? 0) === 0
                        ? "GOALLESS DRAW"
                        : "FINAL RESULT CONFIRMED",
                    W / 2,
                    875
                );
            } else {
                ctx.textAlign = "left";
                ctx.font = "700 23px sans-serif";
                homeGoals.slice(0, 7).forEach((ev, idx) => {
                    const pName = ev.players
                        ? `${ev.players.first_name} ${ev.players.last_name}`.trim()
                        : "Goal";
                    const tag = ev.type === "own_goal" ? " (OG)" : ev.type === "penalty_scored" ? " (P)" : "";
                    const minStr = ev.minute != null ? `${ev.minute}' ` : "";
                    ctx.fillStyle = "#CCFF00";
                    ctx.fillText(`⚽ ${minStr}`, 136, 750 + idx * 50);
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillText(`${pName}${tag}`, 225, 750 + idx * 50);
                });

                ctx.textAlign = "right";
                awayGoals.slice(0, 7).forEach((ev, idx) => {
                    const pName = ev.players
                        ? `${ev.players.first_name} ${ev.players.last_name}`.trim()
                        : "Goal";
                    const tag = ev.type === "own_goal" ? " (OG)" : ev.type === "penalty_scored" ? " (P)" : "";
                    const minStr = ev.minute != null ? ` ${ev.minute}'` : "";
                    ctx.fillStyle = "#FFFFFF";
                    ctx.fillText(`${pName}${tag}${minStr} ⚽`, W - 136, 750 + idx * 50);
                });
            }
        }

        // 5. Footer Strip
        ctx.beginPath();
        ctx.moveTo(92, 1175);
        ctx.lineTo(W - 92, 1175);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.textAlign = "left";
        ctx.fillStyle = "#CCFF00";
        ctx.font = "900 22px monospace";
        ctx.fillText("POWERED BY TACTICA", 96, 1235);

        ctx.textAlign = "right";
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "700 21px monospace";
        ctx.fillText("scout.tacticaengine.com", W - 96, 1235);
    }, [tournament, fixture, homeTeam, awayTeam, homeName, awayName, homeColor, awayColor, kind, pred, events]);

    useEffect(() => {
        void renderCanvas();
    }, [renderCanvas]);

    const handleGenerateAndDownload = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setBusy(true);
        setError(null);
        setSavedUrl(null);

        try {
            await renderCanvas();
            const blob = await new Promise<Blob | null>((resolve) =>
                canvas.toBlob((b) => resolve(b), "image/png", 0.95)
            );
            if (!blob) throw new Error("Could not render PNG image.");

            const safeHome = homeName.replace(/[^a-z0-9]+/gi, "_");
            const safeAway = awayName.replace(/[^a-z0-9]+/gi, "_");
            const filename = `Tactica_${kind.toUpperCase()}_${safeHome}_vs_${safeAway}.png`;

            const res = await uploadMatchGraphic(fixture.id, kind, blob, filename);
            setSavedUrl(res.image_url);
            setBilling((prev) =>
                prev ? { ...prev, remaining: res.remaining, unlimited: res.unlimited } : prev
            );

            // Trigger immediate download
            const objectUrl = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = objectUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(objectUrl);
        } catch (e: any) {
            setError(e.message || "Failed to generate graphic.");
        } finally {
            setBusy(false);
        }
    };

    const outOfQuota =
        billing != null && !billing.unlimited && (billing.remaining ?? 0) <= 0;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Controls & Quota */}
            <div className="lg:col-span-5 space-y-4">
                <div className="card space-y-4">
                    <div className="flex items-center justify-between">
                        <p className="section-label">Match Graphic Studio</p>
                        {billing && (
                            <span className="text-xs font-mono text-volt">
                                {billing.unlimited
                                    ? "Unlimited plan"
                                    : `${billing.remaining ?? 0} of ${billing.image_quota ?? 10} left`}
                            </span>
                        )}
                    </div>

                    <p className="text-mt text-xs leading-relaxed">
                        Generate official <strong className="text-white">1080×1350</strong> social cards
                        branded with your competition crest, team badges, and Tactica analytics.
                    </p>

                    <div>
                        <span className="block text-mt text-[11px] font-mono uppercase tracking-wider mb-1.5">
                            1. Card Type
                        </span>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => { setKind("prematch"); setSavedUrl(null); }}
                                className={clsx(
                                    "py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors",
                                    kind === "prematch"
                                        ? "bg-volt/15 border-volt text-volt"
                                        : "bg-sur2 border-bd text-mt hover:text-white"
                                )}
                            >
                                Pre-Match Odds &amp; ATK/DEF
                            </button>
                            <button
                                type="button"
                                onClick={() => { setKind("ft"); setSavedUrl(null); }}
                                className={clsx(
                                    "py-2.5 px-3 rounded-lg text-xs font-bold border transition-colors",
                                    kind === "ft"
                                        ? "bg-volt/15 border-volt text-volt"
                                        : "bg-sur2 border-bd text-mt hover:text-white"
                                )}
                            >
                                Full-Time Score Card
                            </button>
                        </div>
                    </div>

                    {pred && kind === "prematch" && (
                        <div className="rounded-xl bg-sur2/70 border border-bd p-3 space-y-1.5 text-xs font-mono">
                            <p className="text-volt text-[10px] uppercase tracking-wider">Live Model Inputs</p>
                            <p className="text-white">
                                {homeName}: <span className="text-volt">{pred.home_win_prob}%</span> (ATK {pred.home_attack} / DEF {pred.home_defence})
                            </p>
                            <p className="text-white">
                                {awayName}: <span className="text-cyan-400">{pred.away_win_prob}%</span> (ATK {pred.away_attack} / DEF {pred.away_defence})
                            </p>
                        </div>
                    )}

                    {outOfQuota ? (
                        <div className="rounded-xl border border-amber/40 bg-amber/10 p-3 space-y-2">
                            <p className="text-amber text-xs font-semibold">
                                You have used all {billing?.image_quota} images on your {billing?.plan} plan.
                            </p>
                            <Link href="/settings" className="btn-volt inline-block text-xs">
                                Upgrade plan in Settings
                            </Link>
                        </div>
                    ) : (
                        <button
                            type="button"
                            disabled={busy}
                            onClick={handleGenerateAndDownload}
                            className="btn-volt w-full"
                        >
                            {busy
                                ? "Rendering & Saving..."
                                : `Generate & Download ${kind === "prematch" ? "Pre-Match" : "FT"} PNG (1 credit)`}
                        </button>
                    )}

                    {error && <p className="text-red2 text-xs font-semibold">{error}</p>}

                    {savedUrl && (
                        <div className="rounded-xl border border-grn/40 bg-grn/10 p-3 space-y-2">
                            <p className="text-grn text-xs font-semibold">
                                Saved &amp; downloaded! Share link ready:
                            </p>
                            <div className="flex items-center gap-2">
                                <input
                                    readOnly
                                    value={savedUrl}
                                    className="input-select text-xs font-mono py-1.5"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        navigator.clipboard.writeText(savedUrl);
                                        setCopied(true);
                                        setTimeout(() => setCopied(false), 2000);
                                    }}
                                    className="px-3 py-1.5 rounded-lg bg-sur2 border border-bd text-xs text-white hover:border-volt shrink-0"
                                >
                                    {copied ? "Copied" : "Copy"}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Right: Live 1080x1350 Canvas Preview */}
            <div className="lg:col-span-7 flex flex-col items-center">
                <div className="w-full max-w-[440px] rounded-2xl overflow-hidden border border-bd shadow-2xl bg-[#0A1014]">
                    <canvas ref={canvasRef} className="w-full h-auto block" />
                </div>
                <p className="text-mt2 text-[11px] font-mono mt-2">
                    Live preview • Exports at 1080 × 1350 px RGB PNG
                </p>
            </div>
        </div>
    );
}