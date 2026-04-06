# Data-Art Visualizations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 3 data-art visualization components (Racetrack, Venn Diagram, Stacked Dots) that render ~1,652 nights of sleep data as D3/Canvas art pieces, integrated alongside the existing scrollytelling sections.

**Architecture:** Each data-art piece is a standalone React component that receives loaded JSON data as props. A shared data loader fetches `nightly_sleep_processed.json` once and passes it down. Each component uses D3 for computation and Canvas (or SVG for Night Grid) for rendering. Components sit inside `ScrollySection` wrappers in `App.jsx`.

**Tech Stack:** React 19, D3 7, Canvas 2D API, SVG (for Night Grid), Framer Motion (scroll triggers), Vite 8.

**Spec:** `docs/superpowers/specs/2026-03-23-data-art-concepts-design.md`

---

## File Structure

```
web/
├── public/data/
│   └── nightly_sleep_processed.json    # COPY from /data/
├── src/
│   ├── App.jsx                          # MODIFY — add data-art sections
│   ├── hooks/
│   │   ├── useScrollProgress.js         # EXISTS
│   │   └── useSleepData.js              # CREATE — shared data loader
│   ├── components/
│   │   ├── ScrollySection.jsx           # EXISTS
│   │   ├── NightGrid.jsx                # CREATE — Concept E
│   │   ├── Blanket.jsx                  # CREATE — Concept A
│   │   ├── Thread.jsx                   # CREATE — Concept B
│   │   └── CoralGrowth.jsx              # CREATE — Concept D
│   ├── utils/
│   │   └── sleepDataUtils.js            # CREATE — shared data helpers
│   └── styles/
│       └── theme.js                     # EXISTS (no changes needed)
```

---

## Task 0: Copy Data & Create Data Loader

**Files:**
- Copy: `data/nightly_sleep_processed.json` → `web/public/data/nightly_sleep_processed.json`
- Create: `web/src/hooks/useSleepData.js`
- Create: `web/src/utils/sleepDataUtils.js`

- [ ] **Step 1: Copy processed JSON to web public directory**

```bash
cp "/Users/ekaterinablagireva/Documents/Design/information design/Mom_pace_apple_health_export/data/nightly_sleep_processed.json" "/Users/ekaterinablagireva/Documents/Design/information design/Mom_pace_apple_health_export/web/public/data/nightly_sleep_processed.json"
```

- [ ] **Step 2: Create shared data utilities**

Create `web/src/utils/sleepDataUtils.js`:

```javascript
import { timeWeek, timeParse } from 'd3';

const parseDate = timeParse('%Y-%m-%d');

export const PHASE_COLORS = {
  'Pre-pregnancy': '#2A9D8F',
  'Pregnancy 1': '#FF9F1C',
  'Postpartum 1': '#E63946',
  'Pregnancy 2': '#FF9F1C',
  'Postpartum 2': '#E63946',
};

/** Parse date strings into Date objects and add derived fields */
export function enrichNights(nights) {
  return nights.map((d) => ({
    ...d,
    date: parseDate(d.night_date),
    color: PHASE_COLORS[d.phase] || '#999',
  }));
}

/** Group nights by ISO week for weekly aggregation */
export function groupByWeek(nights) {
  const weeks = new Map();
  for (const night of nights) {
    const weekStart = timeWeek.floor(night.date);
    const key = weekStart.toISOString();
    if (!weeks.has(key)) weeks.set(key, { weekStart, nights: [] });
    weeks.get(key).nights.push(night);
  }
  return Array.from(weeks.values()).sort(
    (a, b) => a.weekStart - b.weekStart
  );
}
```

- [ ] **Step 3: Create data loading hook**

Create `web/src/hooks/useSleepData.js`:

```javascript
import { useState, useEffect } from 'react';
import { enrichNights } from '../utils/sleepDataUtils';

export default function useSleepData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/nightly_sleep_processed.json')
      .then((r) => r.json())
      .then((raw) => {
        setData(enrichNights(raw));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load sleep data:', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
```

- [ ] **Step 4: Verify data loads in the app**

Temporarily add to `App.jsx`:

```javascript
import useSleepData from './hooks/useSleepData';
// Inside App():
const { data, loading } = useSleepData();
console.log('Sleep data:', data?.length, 'nights');
```

Run: `cd web && npm run dev`
Expected: Console shows "Sleep data: 1652 nights"

- [ ] **Step 5: Commit**

```bash
git add web/public/data/nightly_sleep_processed.json web/src/hooks/useSleepData.js web/src/utils/sleepDataUtils.js web/src/App.jsx
git commit -m "feat: add sleep data loader and shared utilities"
```

---

## Task 1: Night Grid (Concept E)

The most data-precise art piece. SVG grid of 1,652 circles: 7 columns (weekdays) x ~236 rows (weeks). Circle size = sleep hours, fragmentation = awakenings, color = phase. Bad consecutive nights merge into blobs.

**Files:**
- Create: `web/src/components/NightGrid.jsx`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Create NightGrid component — basic grid layout**

Create `web/src/components/NightGrid.jsx`:

```jsx
import { useState, useMemo, useCallback } from 'react';
import { scaleLinear, timeMonday, max } from 'd3';
import { PHASE_COLORS } from '../utils/sleepDataUtils';

const CELL = 18;       // cell size in px
const GAP = 3;         // gap between cells
const COLS = 7;        // days of week
const MARGIN = { top: 30, right: 20, bottom: 20, left: 50 };
const BAD_THRESHOLD_SLEEP = 5;
const BAD_THRESHOLD_AWAKENINGS = 3;

const isBadNight = (n) =>
  n.sleep_hours < BAD_THRESHOLD_SLEEP &&
  n.awakenings > BAD_THRESHOLD_AWAKENINGS;

export default function NightGrid({ data, width = 700 }) {
  const [tooltip, setTooltip] = useState(null);
  const svgRef = useCallback((node) => {
    if (node) setTooltip((prev) => ({ ...prev, _svgNode: node }));
  }, []);

  const grid = useMemo(() => {
    if (!data) return [];

    const sorted = [...data].sort((a, b) => a.date - b.date);
    const firstMonday = timeMonday.floor(sorted[0].date);

    return sorted.map((night) => {
      // Use actual weekday from date, not day-count modulo (handles gaps)
      const jsDay = night.date.getDay(); // 0=Sun
      const col = jsDay === 0 ? 6 : jsDay - 1; // 0=Mon, 6=Sun
      const row = timeMonday.count(firstMonday, timeMonday.floor(night.date));

      return { ...night, col, row };
    });
  }, [data]);

  // Blob connections — must be a top-level hook, not after conditionals
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

  /** Convert SVG coords to screen coords for tooltip */
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
        ref={svgRef}
        width={svgWidth}
        height={svgHeight}
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        style={{ maxWidth: '100%', height: 'auto' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Day-of-week headers */}
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

        {/* Blob connections between bad nights */}
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

        {/* Night circles */}
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

      {/* Tooltip — positioned in screen coords */}
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

/** Single night circle with fragmentation based on awakenings */
function NightCircle({ cx, cy, r, awakenings, color, onMouseEnter }) {
  if (awakenings <= 0) {
    return (
      <circle
        cx={cx} cy={cy} r={r} fill={color} opacity={0.85}
        onMouseEnter={onMouseEnter}
      />
    );
  }

  // Fragmented: split into segments with gaps
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

  // Event handler on the <g> so it covers all segments
  return <g onMouseEnter={onMouseEnter}>{arcs}</g>;
}
```

- [ ] **Step 2: Add NightGrid to App.jsx**

Add import and a new ScrollySection in `App.jsx`:

```jsx
import NightGrid from './components/NightGrid';

// Inside App(), after the existing 3 sections, add:
<ScrollySection
  phaseColor={null}
  text={
    <>
      <h2 style={styles.heading}>Every Night, One Circle</h2>
      <p>
        1,652 nights. Each circle is one night of sleep.
        Larger circles mean more hours. Fragmented circles
        mean interrupted sleep. Watch how the grid breaks
        apart after each birth.
      </p>
    </>
  }
>
  {!loading && data && <NightGrid data={data} />}
</ScrollySection>
```

- [ ] **Step 3: Run and verify basic grid renders**

Run: `cd web && npm run dev`
Expected: A grid of colored circles appears — teal dots at top, transitioning to amber/red further down. Circles vary in size. Fragmented circles visible in postpartum rows.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/NightGrid.jsx web/src/App.jsx
git commit -m "feat: add Night Grid data-art visualization with blob merging"
```

---

## Task 2: The Blanket (Concept A)

Horizontal panoramic strip. Each of 1,652 nights is a vertical "stitch" — a set of parallel lines with knot deformations for awakenings. Height = sleep hours, color = phase.

**Files:**
- Create: `web/src/components/Blanket.jsx`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Create Blanket component — Canvas-based rendering**

Create `web/src/components/Blanket.jsx`:

```jsx
import { useRef, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3';

const STITCH_WIDTH = 3;
const STITCH_GAP = 1;
const STRAND_COUNT = 5;
const MAX_HEIGHT = 300;
const MARGIN = { top: 20, bottom: 40 };

/** Deterministic pseudo-random based on seed (avoids flicker on re-render) */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function Blanket({ data }) {
  const canvasRef = useRef(null);

  const totalWidth = useMemo(
    () => (data ? data.length * (STITCH_WIDTH + STITCH_GAP) + STITCH_GAP : 800),
    [data]
  );

  useEffect(() => {
    if (!data) return;

    const sorted = [...data].sort((a, b) => a.date - b.date);
    const totalHeight = MAX_HEIGHT + MARGIN.top + MARGIN.bottom;

    const canvas = canvasRef.current;
    canvas.width = totalWidth * 2;
    canvas.height = totalHeight * 2;
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${totalHeight}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);

    const heightScale = scaleLinear()
      .domain([0, 10])
      .range([0, MAX_HEIGHT])
      .clamp(true);

    sorted.forEach((night, i) => {
      const rand = seededRandom(i * 1000 + 7);
      const x = i * (STITCH_WIDTH + STITCH_GAP) + STITCH_GAP;
      const stitchHeight = heightScale(night.sleep_hours);
      const yTop = MARGIN.top + (MAX_HEIGHT - stitchHeight);
      const yBottom = MARGIN.top + MAX_HEIGHT;

      ctx.strokeStyle = night.color;
      ctx.lineWidth = 0.4;
      ctx.globalAlpha = 0.85;

      for (let s = 0; s < STRAND_COUNT; s++) {
        const sx = x + (s * STITCH_WIDTH) / (STRAND_COUNT - 1);
        ctx.beginPath();

        if (night.awakenings === 0) {
          ctx.moveTo(sx, yTop);
          ctx.lineTo(sx, yBottom);
        } else {
          ctx.moveTo(sx, yTop);
          const knotSpacing = stitchHeight / (night.awakenings + 1);
          for (let k = 1; k <= night.awakenings; k++) {
            const ky = yTop + knotSpacing * k;
            ctx.lineTo(sx, ky - 3);
            const bulge = 2 + rand() * 1.5;
            const dir = s < STRAND_COUNT / 2 ? -1 : 1;
            ctx.bezierCurveTo(
              sx + dir * bulge, ky - 2,
              sx + dir * bulge, ky + 2,
              sx, ky + 3
            );
          }
          ctx.lineTo(sx, yBottom);
        }

        ctx.stroke();
      }
    });

    ctx.globalAlpha = 1;
  }, [data, totalWidth]);

  return (
    <div
      style={{
        overflowX: 'auto',
        overflowY: 'hidden',
        maxWidth: '100%',
        borderRadius: 8,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          height: MAX_HEIGHT + MARGIN.top + MARGIN.bottom,
        }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add Blanket to App.jsx**

```jsx
import Blanket from './components/Blanket';

// New ScrollySection:
<ScrollySection
  phaseColor={null}
  text={
    <>
      <h2 style={styles.heading}>The Blanket</h2>
      <p>
        Each vertical stitch is one night. Smooth lines mean
        unbroken sleep. Knots mark each awakening. Scroll
        sideways to trace 4.7 years of nights.
      </p>
    </>
  }
>
  {!loading && data && <Blanket data={data} />}
</ScrollySection>
```

- [ ] **Step 3: Run and verify — horizontal scrollable blanket renders**

Expected: A wide strip of vertical lines, colored by phase. Pre-pregnancy zone is tall and smooth. Postpartum zones are short with visible knot deformations. Scrollable horizontally.

- [ ] **Step 4: Commit**

```bash
git add web/src/components/Blanket.jsx web/src/App.jsx
git commit -m "feat: add Blanket data-art visualization"
```

---

## Task 3: The Thread (Concept B)

One continuous SVG path flowing vertically. Amplitude = sleep duration, frequency/tangling = awakenings. The thread tangles into knot-balls during postpartum.

**Files:**
- Create: `web/src/components/Thread.jsx`
- Modify: `web/src/App.jsx`

- [ ] **Step 1: Create Thread component**

Create `web/src/components/Thread.jsx`:

```jsx
import { useMemo } from 'react';
import { scaleLinear, line, curveBasisOpen } from 'd3';

const WIDTH = 500;
const NIGHT_HEIGHT = 2.5;    // vertical pixels per night
const MARGIN = { top: 30, bottom: 30, left: 20, right: 20 };
const CENTER_X = WIDTH / 2;
const MAX_AMPLITUDE = 180;   // max horizontal spread

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
        // Smooth wave — single sine curve
        const side = i % 2 === 0 ? 1 : -1;
        points.push({ x: CENTER_X + side * amplitude * 0.5, y });
      } else {
        // Tangled — multiple oscillations within this night's vertical space
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

    // Generate smooth path through points
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

      {/* Phase labels on the left */}
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

      {/* The thread */}
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
```

- [ ] **Step 2: Add Thread to App.jsx**

```jsx
import Thread from './components/Thread';

<ScrollySection
  phaseColor={null}
  text={
    <>
      <h2 style={styles.heading}>The Thread</h2>
      <p>
        One unbroken line — 1,652 nights as a single thread
        of life. Wide, smooth waves are restful sleep. Tight
        tangles are nights shattered by awakenings.
      </p>
    </>
  }
>
  {!loading && data && <Thread data={data} />}
</ScrollySection>
```

- [ ] **Step 3: Run and verify thread renders**

Expected: A vertical flowing line, wide and smooth in teal (pre-baby), tight and tangled in red (postpartum). Color gradient transitions along the path. Phase labels on the left.

- [ ] **Step 4: Iterate on tangle density if needed**

Look at the postpartum sections — they should be visibly more chaotic than pre-pregnancy. Adjust `MAX_AMPLITUDE`, `tangle` multiplier, and `loopHeight` if the contrast isn't strong enough.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/Thread.jsx web/src/App.jsx
git commit -m "feat: add Thread data-art visualization"
```

---

## Task 4: Coral Growth (Concept D)

Recursive branching organism growing upward. Weekly aggregation. Branch height = avg sleep, splits = avg awakenings. Uses Canvas for performance.

**Files:**
- Create: `web/src/components/CoralGrowth.jsx`
- Modify: `web/src/App.jsx`
- Modify: `web/src/utils/sleepDataUtils.js` (already has `groupByWeek`)

- [ ] **Step 1: Create CoralGrowth component**

Create `web/src/components/CoralGrowth.jsx`:

```jsx
import { useRef, useEffect, useMemo } from 'react';
import { groupByWeek } from '../utils/sleepDataUtils';
import { mean, scaleLinear } from 'd3';

const WIDTH = 600;
const HEIGHT = 900;
const BASE_Y = HEIGHT - 40;
const TRUNK_X = WIDTH / 2;

/** Deterministic pseudo-random based on seed */
function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export default function CoralGrowth({ data }) {
  const canvasRef = useRef(null);

  const weeks = useMemo(() => {
    if (!data) return [];
    return groupByWeek(data).map((w) => ({
      ...w,
      avgSleep: mean(w.nights, (n) => n.sleep_hours),
      avgAwakenings: mean(w.nights, (n) => n.awakenings),
      phase: w.nights[Math.floor(w.nights.length / 2)].phase,
      color: w.nights[Math.floor(w.nights.length / 2)].color,
    }));
  }, [data]);

  useEffect(() => {
    if (!weeks.length) return;

    const canvas = canvasRef.current;
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.lineCap = 'round';

    const growthScale = scaleLinear()
      .domain([2, 9])
      .range([1.5, 5])
      .clamp(true);

    const branchScale = scaleLinear()
      .domain([0, 5])
      .range([1, 4])
      .clamp(true);

    function drawBranch(x, y, angle, length, thickness, depth, color) {
      if (depth <= 0 || thickness < 0.3) return;

      const endX = x + Math.cos(angle) * length;
      const endY = y + Math.sin(angle) * length;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.globalAlpha = 0.7 + depth * 0.05;
      ctx.stroke();

      return { x: endX, y: endY };
    }

    let currentX = TRUNK_X;
    let currentY = BASE_Y;
    let currentAngle = -Math.PI / 2;

    weeks.forEach((week, i) => {
      const rand = seededRandom(i * 997 + 13);
      const growth = growthScale(week.avgSleep);
      const branches = Math.round(branchScale(week.avgAwakenings));
      const thickness = Math.max(1, 4 - i * 0.015);

      const jitter = (rand() - 0.5) * 0.08;
      const end = drawBranch(
        currentX,
        currentY,
        currentAngle + jitter,
        growth,
        thickness,
        10,
        week.color
      );

      if (!end) return;

      if (branches >= 2) {
        for (let b = 0; b < branches - 1; b++) {
          const branchAngle =
            currentAngle +
            ((b % 2 === 0 ? 1 : -1) * (0.4 + rand() * 0.5));
          const branchLen = growth * (0.3 + rand() * 0.4);

          const branchEnd = drawBranch(
            end.x,
            end.y,
            branchAngle,
            branchLen,
            thickness * 0.5,
            3,
            week.color
          );

          if (branchEnd && branches >= 4) {
            const subAngle = branchAngle + ((rand() - 0.5) * 0.8);
            drawBranch(
              branchEnd.x,
              branchEnd.y,
              subAngle,
              branchLen * 0.5,
              thickness * 0.25,
              1,
              week.color
            );
          }
        }
      }

      currentX = end.x;
      currentY = end.y;
      // Stronger drift correction to keep coral within canvas bounds
      currentAngle =
        -Math.PI / 2 + (TRUNK_X - currentX) * 0.008 + jitter;
    });

    ctx.globalAlpha = 1;
  }, [weeks]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  );
}
```

- [ ] **Step 2: Add CoralGrowth to App.jsx**

```jsx
import CoralGrowth from './components/CoralGrowth';

<ScrollySection
  phaseColor={null}
  text={
    <>
      <h2 style={styles.heading}>Growth</h2>
      <p>
        A living form shaped by sleep. Tall, straight growth
        marks restful weeks. Dense branching marks the chaos
        of fragmented nights. The organism keeps growing
        through it all.
      </p>
    </>
  }
>
  {!loading && data && <CoralGrowth data={data} />}
</ScrollySection>
```

- [ ] **Step 3: Run and verify coral renders**

Expected: An upward-growing branching structure. Teal trunk at the bottom (pre-pregnancy, relatively straight). Red/amber explosive branching in the middle (postpartum). The silhouette narrows → widens → narrows → widens.

- [ ] **Step 4: Tune branching parameters**

The coral is the most organic piece — it will need visual tuning:
- If too chaotic everywhere, increase the `growthScale` minimum (taller segments between branches)
- If postpartum isn't dramatic enough, increase the `branchScale` range
- If it grows off-canvas, increase the center drift correction factor
- If branches look too mechanical, add more angle randomization

- [ ] **Step 5: Commit**

```bash
git add web/src/components/CoralGrowth.jsx web/src/App.jsx
git commit -m "feat: add Coral Growth data-art visualization"
```

---

## Task 5: Final Integration & Polish

**Files:**
- Modify: `web/src/App.jsx` — final section ordering and cleanup

- [ ] **Step 1: Order all sections in App.jsx**

Final section order in the scrollytelling page:

1. Hero header (existing)
2. "Before" section (existing)
3. "During" section (existing)
4. "After" section (existing)
5. **The Blanket** — horizontal panorama (unfurl the story)
6. **The Thread** — vertical continuous line
7. **The Night Grid** — every night as a circle
8. **Coral Growth** — the living form

- [ ] **Step 2: Remove temporary console.log from Task 0**

- [ ] **Step 3: Run full scroll-through**

Run: `cd web && npm run dev`
Verify: All 8 sections render, scroll animations trigger, data-art pieces show real data with phase colors.

- [ ] **Step 4: Final commit**

```bash
git add -u
git commit -m "feat: integrate all 4 data-art visualizations into scrollytelling"
```

---

## Verification Checklist

- [ ] Data loads: 1,652 nights with dates, sleep_hours, awakenings, phase, color
- [ ] Night Grid: circles sized by sleep, fragmented by awakenings, blob-merged bad nights
- [ ] Blanket: horizontal strip with smooth/knotted stitches, phase-colored
- [ ] Thread: continuous path, smooth pre-baby, tangled postpartum, color gradient
- [ ] Coral: upward growth, straight trunk → explosive branching at postpartum
- [ ] All 4 pieces sit inside ScrollySections alongside text
- [ ] Phase colors match theme: teal (#2A9D8F), amber (#FF9F1C), red (#E63946)
- [ ] No console errors, no missing data
