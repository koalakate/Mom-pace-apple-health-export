import { useMemo } from 'react';
import { scaleLinear } from 'd3';

const WIDTH = 600;
const NIGHT_STEP = 3;
const MARGIN = { top: 40, bottom: 40, left: 80, right: 80 };
const CENTER_X = WIDTH / 2;

export default function Thread({ data }) {
  const { pathD, height, phaseLabels, strokeWidths } = useMemo(() => {
    if (!data) return { pathD: '', height: 0, phaseLabels: [], strokeWidths: [] };

    const sorted = [...data].sort((a, b) => a.date - b.date);
    const totalHeight = MARGIN.top + sorted.length * NIGHT_STEP + MARGIN.bottom;

    // Amplitude: good sleep = wide lazy arc, bad sleep = narrow compressed
    const ampScale = scaleLinear()
      .domain([0, 10])
      .range([8, 220])
      .clamp(true);

    // Stroke width: thicker for deep sleep, thin for fragmented
    const widthScale = scaleLinear()
      .domain([0, 10])
      .range([1, 5])
      .clamp(true);

    const segments = [];
    let currentPhase = null;
    const labels = [];

    sorted.forEach((night, i) => {
      const y = MARGIN.top + i * NIGHT_STEP;

      if (night.phase !== currentPhase) {
        currentPhase = night.phase;
        labels.push({ phase: night.phase, y, color: night.color });
      }

      const amplitude = ampScale(night.sleep_hours);
      const aw = night.awakenings;
      const sw = widthScale(night.sleep_hours);

      if (aw <= 1) {
        // Smooth flowing arc — one gentle swing per night
        const side = i % 2 === 0 ? 1 : -1;
        segments.push({
          x: CENTER_X + side * amplitude * 0.5,
          y,
          strokeWidth: sw,
          color: night.color,
        });
      } else {
        // Multiple oscillations within one night — tight tangles
        const loops = Math.min(aw, 8);
        const isBadNight = night.sleep_hours < 5 && aw > 3;
        const tangleMultiplier = isBadNight ? 1.5 : 0.6;

        for (let k = 0; k < loops; k++) {
          const side = k % 2 === 0 ? 1 : -1;
          const subY = y + (k / loops) * NIGHT_STEP;
          // Bad nights: rapid tight oscillation with crossings
          const spread = isBadNight
            ? amplitude * tangleMultiplier * (0.3 + 0.4 * Math.sin(k * 2.3))
            : amplitude * tangleMultiplier * 0.4;
          segments.push({
            x: CENTER_X + side * spread,
            y: subY,
            strokeWidth: sw * (isBadNight ? 0.7 : 1),
            color: night.color,
          });
        }
      }
    });

    // Build SVG path as smooth cubic bezier
    let d = '';
    if (segments.length > 0) {
      d = `M ${segments[0].x} ${segments[0].y}`;
      for (let i = 1; i < segments.length; i++) {
        const prev = segments[i - 1];
        const curr = segments[i];
        // Control points for smooth bezier — vertical emphasis
        const cpY = (prev.y + curr.y) / 2;
        d += ` C ${prev.x} ${cpY}, ${curr.x} ${cpY}, ${curr.x} ${curr.y}`;
      }
    }

    return {
      pathD: d,
      height: totalHeight,
      phaseLabels: labels,
      strokeWidths: segments.map((s) => s.strokeWidth),
    };
  }, [data]);

  if (!data) return null;

  return (
    <svg
      width={WIDTH}
      height={height}
      viewBox={`0 0 ${WIDTH} ${height}`}
      style={{ maxWidth: '100%', height: 'auto' }}
    >
      <defs>
        <linearGradient id="threadGrad" x1="0" y1="0" x2="0" y2="1">
          {phaseLabels.map((p, i) => (
            <stop
              key={i}
              offset={`${(p.y / height) * 100}%`}
              stopColor={p.color}
            />
          ))}
        </linearGradient>
      </defs>

      {phaseLabels.map((p, i) => (
        <text
          key={i}
          x={12}
          y={p.y + 5}
          fontSize={11}
          fill={p.color}
          fontWeight={600}
          opacity={0.8}
        >
          {p.phase}
        </text>
      ))}

      <path
        d={pathD}
        fill="none"
        stroke="url(#threadGrad)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
