import type { RadarAxes } from "@/lib/api";

const AXES: { key: keyof RadarAxes; label: string }[] = [
  { key: "shooting",   label: "Shooting" },
  { key: "creativity", label: "Creativity" },
  { key: "passing",    label: "Passing" },
  { key: "defending",  label: "Defending" },
  { key: "dribbling",  label: "Dribbling" },
  { key: "physical",   label: "Physical" },
];

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 40;

function pointFor(index: number, total: number, value: number): [number, number] {
  const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
  const r = (value / 100) * RADIUS;
  return [CENTER + r * Math.cos(angle), CENTER + r * Math.sin(angle)];
}

function polygonPoints(values: RadarAxes): string {
  return AXES.map((a, i) => pointFor(i, AXES.length, values[a.key]).join(",")).join(" ");
}

// Plain inline SVG radar — no charting library dependency, keeps this
// component portable to the mobile app later (react-native-svg uses the
// same primitives). Two players overlay on one chart: volt for player A,
// cyan for player B, same convention as the Tactica brand's two accent colors.
export default function RadarChart({
  playerA,
  playerB,
}: {
  playerA?: { name: string; values: RadarAxes } | null;
  playerB?: { name: string; values: RadarAxes } | null;
}) {
  const rings = [25, 50, 75, 100];

  return (
    <div className="flex flex-col items-center">
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={AXES.map((_, i) => pointFor(i, AXES.length, r).join(",")).join(" ")}
            fill="none"
            stroke="#1E2A33"
            strokeWidth={1}
          />
        ))}
        {/* Axis lines */}
        {AXES.map((a, i) => {
          const [x, y] = pointFor(i, AXES.length, 100);
          return (
            <line key={a.key} x1={CENTER} y1={CENTER} x2={x} y2={y} stroke="#1E2A33" strokeWidth={1} />
          );
        })}
        {/* Player A polygon */}
        {playerA && (
          <polygon
            points={polygonPoints(playerA.values)}
            fill="rgba(204,255,0,0.18)"
            stroke="#CCFF00"
            strokeWidth={2}
          />
        )}
        {/* Player B polygon */}
        {playerB && (
          <polygon
            points={polygonPoints(playerB.values)}
            fill="rgba(0,229,255,0.15)"
            stroke="#00E5FF"
            strokeWidth={2}
          />
        )}
        {/* Axis labels */}
        {AXES.map((a, i) => {
          const [x, y] = pointFor(i, AXES.length, 100 + 22);
          return (
            <text
              key={a.key}
              x={x}
              y={y}
              fill="#8A9BA8"
              fontSize={10}
              fontFamily="DM Sans"
              fontWeight={600}
              textAnchor="middle"
              dominantBaseline="middle"
            >
              {a.label}
            </text>
          );
        })}
      </svg>

      <div className="flex gap-5 mt-3">
        {playerA && (
          <span className="flex items-center gap-1.5 text-xs text-white font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-volt" /> {playerA.name}
          </span>
        )}
        {playerB && (
          <span className="flex items-center gap-1.5 text-xs text-white font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan" /> {playerB.name}
          </span>
        )}
      </div>
    </div>
  );
}
