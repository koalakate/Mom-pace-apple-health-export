import { useState, useMemo } from 'react';
import { scaleLinear, timeMonday, max } from 'd3';

const CELL = 18;
const GAP = 3;
const COLS = 7;
const MARGIN = { top: 30, right: 20, bottom: 20, left: 50 };
const BAD_THRESHOLD_SLEEP = 5;
const BAD_THRESHOLD_AWAKENINGS = 3;

const isBadNight = (n) =>
  n.sleep_hours < BAD_THRESHOLD_SLEEP &&
  n.awakenings > BAD_THRESHOLD_AWAKENINGS;

export default function NightGrid({ data }) {
  const [tooltip, setTooltip] = useState(null);

  const grid = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => a.date - b.date);
    const firstMonday = timeMonday.floor(sorted[0].date);

    return sorted.map((night) => {
      const jsDay = night.date.getDay();
      const col = jsDay === 0 ? 6 : jsDay - 1;
      const row = timeMonday.count(firstMonday, timeMonday.floor(night.date));
      return { ...night, col, row };
    });
  }, [data]);

  const blobConnections = useMemo(() => {
    if (!grid.length) return [];
    const connections = [];
    const lookup = new Map();
    for (const n of grid) lookup.set(`${n.row},${n.col}`, n);

    for (const night of grid) {
      if (!isBadNight(night)) continue;
      const right = lookup.get(`${night.row},${night.col + 1}`);
      if (right && isBadNight(right)) {
        connections.push({ from: night, to: right, direction: 'h' });
      }
      const below = lookup.get(`${night.row + 1},${night.col}`);
      if (below && isBadNight(below)) {
        connections.push({ from: night, to: below, direction: 'v' });
      }
    }
    return connections;
  }, [grid]);

  const maxRow = max(grid, (d) => d.row) || 0;
  const step = CELL + GAP;
  const svgWidth = MARGIN.left + COLS * step + MARGIN.right;
  const svgHeight = MARGIN.top + (maxRow + 1) * step + MARGIN.bottom;

  const radiusScale = scaleLinear()
    .domain([0, 10])
    .range([1, CELL / 2])
    .clamp(true);

  const handleMouseEnter = (e, night, cx, cy) => {
    const svgEl = e.target.closest('svg');
    const rect = svgEl.getBoundingClientRect();
    const scaleX = rect.width / svgWidth;
    const scaleY = rect.height / svgHeight;
    setTooltip({
      ...night,
      screenX: rect.left + cx * scaleX + 15,
      screenY: rect.top + cy * scaleY - 10,
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ maxWidth: '100%', height: 'auto' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d, i) => (
          <text
            key={d}
            x={MARGIN.left + i * step + CELL / 2}
            y={MARGIN.top - 10}
            textAnchor="middle"
            fontSize={10}
            fill="#6B6B6B"
          >
            {d}
          </text>
        ))}

        {blobConnections.map((conn, i) => {
          const fromCx = MARGIN.left + conn.from.col * step + CELL / 2;
          const fromCy = MARGIN.top + conn.from.row * step + CELL / 2;
          const toCx = MARGIN.left + conn.to.col * step + CELL / 2;
          const toCy = MARGIN.top + conn.to.row * step + CELL / 2;
          const fromR = radiusScale(conn.from.sleep_hours);
          const toR = radiusScale(conn.to.sleep_hours);
          const neckWidth = Math.min(fromR, toR) * 0.5;

          return conn.direction === 'h' ? (
            <rect
              key={`conn-${i}`}
              x={fromCx + fromR * 0.3}
              y={fromCy - neckWidth / 2}
              width={toCx - fromCx - (fromR + toR) * 0.3}
              height={neckWidth}
              rx={neckWidth / 3}
              fill={conn.from.color}
              opacity={0.5}
            />
          ) : (
            <rect
              key={`conn-${i}`}
              x={fromCx - neckWidth / 2}
              y={fromCy + fromR * 0.3}
              width={neckWidth}
              height={toCy - fromCy - (fromR + toR) * 0.3}
              rx={neckWidth / 3}
              fill={conn.from.color}
              opacity={0.5}
            />
          );
        })}

        {grid.map((night) => {
          const cx = MARGIN.left + night.col * step + CELL / 2;
          const cy = MARGIN.top + night.row * step + CELL / 2;
          const r = radiusScale(night.sleep_hours);

          return (
            <NightCircle
              key={night.night_date}
              cx={cx}
              cy={cy}
              r={r}
              awakenings={night.awakenings}
              color={night.color}
              onMouseEnter={(e) => handleMouseEnter(e, night, cx, cy)}
            />
          );
        })}
      </svg>

      {tooltip && tooltip.screenX && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.screenX,
            top: tooltip.screenY,
            background: '#1A1A1A',
            color: '#fff',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: 13,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          <strong>{tooltip.night_date}</strong>
          <br />
          {tooltip.sleep_hours.toFixed(1)}h sleep
          {tooltip.awakenings > 0 && ` · ${tooltip.awakenings} awakenings`}
          <br />
          {tooltip.phase}
        </div>
      )}
    </div>
  );
}

function NightCircle({ cx, cy, r, awakenings, color, onMouseEnter }) {
  if (awakenings <= 0) {
    return (
      <circle
        cx={cx} cy={cy} r={r} fill={color} opacity={0.85}
        onMouseEnter={onMouseEnter}
      />
    );
  }

  const segments = awakenings + 1;
  const gapAngle = Math.min(0.15, awakenings * 0.04);
  const totalGap = gapAngle * awakenings;
  const segmentAngle = (2 * Math.PI - totalGap) / segments;

  const arcs = [];
  let angle = -Math.PI / 2;

  for (let s = 0; s < segments; s++) {
    const startAngle = angle;
    const endAngle = angle + segmentAngle;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = segmentAngle > Math.PI ? 1 : 0;

    arcs.push(
      <path
        key={s}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={color}
        opacity={0.85}
      />
    );
    angle = endAngle + gapAngle;
  }

  return <g onMouseEnter={onMouseEnter}>{arcs}</g>;
}
