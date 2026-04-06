import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { seededRandom } from '../../utils/sleepDataUtils';

/* ── layout constants ─────────────────────────────────────── */
const CELL = 64;          // px per night cell
const GAP  = 2;           // gap between cells
const COLS = 14;          // nights per row (~2 weeks)
const PAD  = 1.5;         // internal cell padding

/* ── colour helpers ───────────────────────────────────────── */
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h, s, l = (max + min) / 2;
  if (max === min) { h = s = 0; }
  else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hslToCSS(h, s, l) {
  return `hsl(${h.toFixed(0)}, ${s.toFixed(0)}%, ${l.toFixed(0)}%)`;
}

/* ── squarified treemap ───────────────────────────────────── */
function squarify(values, x, y, w, h) {
  const total = values.reduce((a, b) => a + b, 0);
  if (total === 0 || values.length === 0) return [];

  const rects = [];
  let remaining = [...values];
  let rx = x, ry = y, rw = w, rh = h;

  while (remaining.length > 0) {
    const remTotal = remaining.reduce((a, b) => a + b, 0);
    const isWide = rw >= rh;
    const side = isWide ? rh : rw;

    // find best row using squarify heuristic
    let row = [remaining[0]];
    let rowTotal = remaining[0];
    let bestRatio = worstRatio(row, rowTotal, side, remTotal, rw, rh, isWide);

    for (let i = 1; i < remaining.length; i++) {
      const candidate = [...row, remaining[i]];
      const candTotal = rowTotal + remaining[i];
      const candRatio = worstRatio(candidate, candTotal, side, remTotal, rw, rh, isWide);
      if (candRatio <= bestRatio) {
        row = candidate;
        rowTotal = candTotal;
        bestRatio = candRatio;
      } else break;
    }

    // lay out the row
    const rowFrac = rowTotal / remTotal;
    const rowThick = isWide ? rw * rowFrac : rh * rowFrac;
    let pos = 0;

    for (const val of row) {
      const frac = val / rowTotal;
      const len = side * frac;
      if (isWide) {
        rects.push({ x: rx, y: ry + pos, w: rowThick, h: len });
      } else {
        rects.push({ x: rx + pos, y: ry, w: len, h: rowThick });
      }
      pos += len;
    }

    // shrink remaining area
    if (isWide) { rx += rowThick; rw -= rowThick; }
    else        { ry += rowThick; rh -= rowThick; }

    remaining = remaining.slice(row.length);
  }
  return rects;
}

function worstRatio(row, rowTotal, side, areaTotal, w, h, isWide) {
  const frac = rowTotal / areaTotal;
  const thick = isWide ? w * frac : h * frac;
  let worst = 0;
  for (const val of row) {
    const len = (val / rowTotal) * side;
    const r = Math.max(thick / len, len / thick);
    if (r > worst) worst = r;
  }
  return worst;
}

/* ── bedtime-to-hue mapping ───────────────────────────────── */
// early bedtime (21h) → cool blue-green, late (1h+) → warm amber-pink
function bedtimeHue(bedtimeHour) {
  // normalise to 0-1 where 0 = 20:00, 1 = 04:00
  let h = bedtimeHour;
  if (h < 12) h += 24;           // treat 0-11 as next-day hours
  const t = Math.max(0, Math.min(1, (h - 20) / 8));
  // hue sweep: 180 (teal) → 30 (warm orange) → 340 (rose)
  if (t < 0.5) return 180 - t * 2 * 150;  // 180 → 30
  return 30 - (t - 0.5) * 2 * 50 + 360;   // 30 → 340
}

/* ── palette for sleep blocks (multi-dimensional) ─────────── */
function sleepBlockColor(night, rng) {
  const eff = night.efficiency || 80;
  const bedH = bedtimeHue(night.bedtime_hour || 23);
  const [phaseH, phaseS] = hexToHSL(night.color);

  // blend phase hue (identity) with bedtime hue (time signature)
  const blendH = (phaseH * 0.55 + bedH * 0.45 + (rng() - 0.5) * 30 + 720) % 360;
  // saturation from efficiency: good sleep → vivid, bad → muted
  const s = Math.min(90, Math.max(25, phaseS * 0.4 + (eff / 100) * 55 + (rng() - 0.5) * 15));
  // lightness: moderate variation for Mondrian texture
  const l = 35 + rng() * 30 + (eff - 70) * 0.15;
  return hslToCSS(blendH, s, Math.min(75, Math.max(25, l)));
}

/* ── build treemap children for one night ─────────────────── */
function nightToBlocks(night, rng) {
  const blocks = [];
  const sleepMin = night.total_sleep_min || night.sleep_hours * 60;
  const awakeMin = night.awake_min || 0;
  const awakenings = night.awakenings || 0;
  const efficiency = night.efficiency || 80;
  const [baseH] = hexToHSL(night.color);

  // Split sleep into segments
  const sleepSegs = Math.max(1, night.sleep_segments || awakenings + 1);
  const avgSleepSeg = sleepMin / sleepSegs;

  for (let i = 0; i < sleepSegs; i++) {
    const jitter = 0.7 + rng() * 0.6;
    const value = Math.max(1, avgSleepSeg * jitter);
    const color = sleepBlockColor(night, rng);
    blocks.push({ value, color, type: 'sleep' });
  }

  // Awake blocks — dark, desaturated, proportional to actual awake time
  if (awakenings > 0 && awakeMin > 0) {
    const avgAwakeSeg = awakeMin / awakenings;
    for (let i = 0; i < awakenings; i++) {
      const jitter = 0.6 + rng() * 0.8;
      const value = Math.max(0.5, avgAwakeSeg * jitter);
      // very dark with a faint warm hue (nocturnal wakefulness)
      const lAwake = 5 + rng() * 14;
      const sAwake = 8 + rng() * 15;
      const hAwake = (baseH + 10 + rng() * 20) % 360;
      blocks.push({ value, color: hslToCSS(hAwake, sAwake, lAwake), type: 'awake' });
    }
  }

  // Restlessness texture for poor efficiency
  if (efficiency < 65) {
    const restless = (100 - efficiency) * 0.6;
    blocks.push({
      value: restless,
      color: hslToCSS((baseH + 180) % 360, 25, 18),
      type: 'restless',
    });
  }

  // Short sleep → add a "missing" pale block representing deficit
  if (night.sleep_hours < 5) {
    const deficit = (5 - night.sleep_hours) * 12;
    blocks.push({
      value: deficit,
      color: hslToCSS(baseH, 8, 88 + rng() * 6),
      type: 'deficit',
    });
  }

  // Shuffle for visual variety
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }

  return blocks;
}

/* ── month labels on left edge ────────────────────────────── */
const LABEL_W = 48;  // space for month labels

/* ── component ────────────────────────────────────────────── */
export default function MondrianTreemap({ data }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date - b.date);
  }, [data]);

  const rows = Math.ceil(sorted.length / COLS);
  const canvasW = LABEL_W + COLS * (CELL + GAP) + GAP;
  const canvasH = rows * (CELL + GAP) + GAP;

  // precompute month label positions
  const monthLabels = useMemo(() => {
    const labels = [];
    let prevMonth = -1;
    sorted.forEach((night, i) => {
      const m = night.date.getMonth();
      const y = night.date.getFullYear();
      const key = y * 12 + m;
      if (key !== prevMonth) {
        prevMonth = key;
        const row = Math.floor(i / COLS);
        const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        labels.push({
          text: `${monthNames[m]} ${String(y).slice(2)}`,
          y: GAP + row * (CELL + GAP) + CELL / 2,
        });
      }
    });
    return labels;
  }, [sorted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvasW * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, canvasH);

    // cream background
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // month labels
    ctx.fillStyle = '#999';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const label of monthLabels) {
      ctx.fillText(label.text, 2, label.y);
    }

    sorted.forEach((night, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx = LABEL_W + GAP + col * (CELL + GAP);
      const cy = GAP + row * (CELL + GAP);

      // cell background — very faint phase tint
      const [bh, bs] = hexToHSL(night.color);
      ctx.fillStyle = hslToCSS(bh, bs * 0.3, 92);
      ctx.fillRect(cx, cy, CELL, CELL);

      // generate treemap blocks
      const rng = seededRandom(i * 7919 + 31);
      const blocks = nightToBlocks(night, rng);
      const values = blocks.map((b) => b.value);
      const rects = squarify(
        values,
        cx + PAD, cy + PAD,
        CELL - PAD * 2, CELL - PAD * 2
      );

      // draw blocks
      rects.forEach((rect, j) => {
        if (j >= blocks.length) return;
        ctx.fillStyle = blocks[j].color;
        ctx.fillRect(
          rect.x + 0.5, rect.y + 0.5,
          Math.max(1, rect.w - 1), Math.max(1, rect.h - 1)
        );
      });
    });
  }, [sorted, canvasW, canvasH, monthLabels]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - LABEL_W;
    const my = (e.clientY - rect.top) * scaleY;

    const col = Math.floor((mx - GAP) / (CELL + GAP));
    const row = Math.floor((my - GAP) / (CELL + GAP));
    if (col < 0 || col >= COLS || row < 0) { setTooltip(null); return; }

    const idx = row * COLS + col;
    if (idx >= sorted.length) { setTooltip(null); return; }

    const night = sorted[idx];
    setTooltip({
      ...night,
      screenX: e.clientX + 12,
      screenY: e.clientY - 10,
    });
  }, [sorted, canvasW, canvasH]);

  return (
    <div style={{ position: 'relative', overflowX: 'auto', maxWidth: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: canvasW, height: canvasH, display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      />
      {tooltip && (
        <div style={{
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
        }}>
          <strong>{tooltip.night_date}</strong> · {tooltip.phase}<br />
          {tooltip.sleep_hours.toFixed(1)}h sleep
          {tooltip.awakenings > 0 && ` · ${tooltip.awakenings} wake-ups`}<br />
          {tooltip.awake_min > 0 && `${Math.round(tooltip.awake_min)}min awake · `}
          {Math.round(tooltip.efficiency)}% efficiency
        </div>
      )}
    </div>
  );
}
