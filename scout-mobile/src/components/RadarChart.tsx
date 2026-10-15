// src/components/RadarChart.tsx — Tactical Radar Chart using SVG
import React from 'react';
import { View, StyleSheet, Text as RNText } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText } from 'react-native-svg';
import { COLORS } from '../theme';
import { RadarAxes } from '../services/api';

interface RadarChartProps {
  data: RadarAxes;
  compareData?: RadarAxes;
  size?: number;
  labelColor?: string;
  primaryColor?: string;
  compareColor?: string;
}

const AXIS_KEYS: (keyof RadarAxes)[] = [
  'shooting',
  'passing',
  'dribbling',
  'defending',
  'creativity',
  'physical',
];

const LABELS: Record<keyof RadarAxes, string> = {
  shooting: 'SHT',
  passing: 'PAS',
  dribbling: 'DRI',
  defending: 'DEF',
  creativity: 'CRE',
  physical: 'PHY',
};

export const RadarChart: React.FC<RadarChartProps> = ({
  data,
  compareData,
  size = 280,
  labelColor = COLORS.textSecondary,
  primaryColor = COLORS.volt,
  compareColor = '#38bdf8', // Sky blue for comparison
}) => {
  const center = size / 2;
  const radius = size * 0.38;
  const numAxes = AXIS_KEYS.length;
  const angleStep = (Math.PI * 2) / numAxes;

  // Compute point for a given axis index and normalized value (0-100)
  const getCoordinates = (value: number, index: number, maxRadius = radius) => {
    const angle = index * angleStep - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, value)) / 100) * maxRadius;
    const x = center + r * Math.cos(angle);
    const y = center + r * Math.sin(angle);
    return { x, y };
  };

  // Build grid polygon rings at 25%, 50%, 75%, 100%
  const gridLevels = [0.25, 0.5, 0.75, 1.0];
  const gridPolygons = gridLevels.map((lvl) => {
    return AXIS_KEYS.map((_, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const x = center + radius * lvl * Math.cos(angle);
      const y = center + radius * lvl * Math.sin(angle);
      return `${x},${y}`;
    }).join(' ');
  });

  // Data polygons
  const primaryPoints = AXIS_KEYS.map((key, i) => {
    const { x, y } = getCoordinates(data[key] || 0, i);
    return `${x},${y}`;
  }).join(' ');

  const comparePoints = compareData
    ? AXIS_KEYS.map((key, i) => {
        const { x, y } = getCoordinates(compareData[key] || 0, i);
        return `${x},${y}`;
      }).join(' ')
    : null;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background concentric polygons */}
        {gridPolygons.map((pts, idx) => (
          <Polygon
            key={`grid-${idx}`}
            points={pts}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="1"
            fill={idx === gridPolygons.length - 1 ? 'rgba(255, 255, 255, 0.02)' : 'none'}
          />
        ))}

        {/* Spoke lines from center to outer vertices */}
        {AXIS_KEYS.map((_, i) => {
          const { x, y } = getCoordinates(100, i);
          return (
            <Line
              key={`spoke-${i}`}
              x1={center}
              y1={center}
              x2={x}
              y2={y}
              stroke="rgba(255, 255, 255, 0.1)"
              strokeWidth="1"
            />
          );
        })}

        {/* Comparison player filled polygon */}
        {comparePoints && (
          <Polygon
            points={comparePoints}
            fill="rgba(56, 189, 248, 0.25)"
            stroke={compareColor}
            strokeWidth="2"
          />
        )}

        {/* Primary player filled polygon */}
        <Polygon
          points={primaryPoints}
          fill="rgba(212, 255, 0, 0.25)"
          stroke={primaryColor}
          strokeWidth="2.5"
        />

        {/* Dots on primary vertices */}
        {AXIS_KEYS.map((key, i) => {
          const { x, y } = getCoordinates(data[key] || 0, i);
          return <Circle key={`dot-${i}`} cx={x} cy={y} r="3.5" fill={primaryColor} />;
        })}

        {/* Axis Labels */}
        {AXIS_KEYS.map((key, i) => {
          const angle = i * angleStep - Math.PI / 2;
          const labelDist = radius + 18;
          const lx = center + labelDist * Math.cos(angle);
          const ly = center + labelDist * Math.sin(angle) + 4; // slight vertical balance
          return (
            <SvgText
              key={`label-${key}`}
              x={lx}
              y={ly}
              fill={labelColor}
              fontSize="10"
              fontWeight="bold"
              textAnchor="middle"
            >
              {LABELS[key]}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
});
