import { useMemo } from 'react';
import { scaleLinear, line, curveBasisOpen } from 'd3';

const WIDTH = 500;
const NIGHT_HEIGHT = 2.5;
const MARGIN = { top: 30, bottom: 30, left: 20, right: 20 };
const CENTER_X = WIDTH / 2;
const MAX_AMPLITUDE = 180;

export default function Thread({ data }) {
  const { path, height, phaseLabels } = useMemo(() => {
    if (!data) return { path: '', height: 0, phaseLabels: [] };

    const sorted = [...data].sort((a, b) => a.date - b.date);
    const totalHeight =
      MARGIN.top + sorted.length * NIGHT_HEIGHT + MARGIN.bottom;

    const ampScale = scaleLinear()
      .domain([0, 10])
      .range([5, MAX_AMPLITUDE])
      .clamp(true);

    const points = [];
    let currentPhase = null;
    const labels = [];

    sorted.forEach((night, i) => {
      const y = MARGIN.top + i * NIGHT_HEIGHT;
      const amplitude = ampScale(night.sleep_hours);

      if (night.phase !== currentPhase) {
        currentPhase = night.phase;
        labels.push({ phase: night.phase, y, color: night.color });
      }

      if (night.awakenings <= 1) {
        const side = i % 2 === 0 ? 1 : -1;
        points.push({ x: CENTER_X + side * amplitude * 0.5, y });
      } else {
        const loops = Math.min(night.awakenings, 6);
        const loopHeight = NIGHT_HEIGHT / loops;

        for (let k = 0; k < loops; k++) {
          const side = k % 2 === 0 ? 1 : -1;
          const tangle =
            night.sleep_hours < 5 && night.awakenings > 3 ? 1.3 : 0.7;
          points.push({
            x: CENTER_X + side * amplitude * tangle * 0.4,
            y: y + k * loopHeight,
          });
        }
      }
    });

    const lineGen = line()
      .x((d) => d.x)
      .y((d) => d.y)
      .curve(curveBasisOpen);

    return {
      path: lineGen(points),
      height: totalHeight,
      phaseLabels: labels,
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
          x={10}
          y={p.y + 4}
          fontSize={10}
          fill={p.color}
          fontWeight={600}
        >
          {p.phase}
        </text>
      ))}

      <path
        d={path}
        fill="none"
        stroke="url(#threadGrad)"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}
