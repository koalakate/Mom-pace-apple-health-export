import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { seededRandom } from '../../utils/sleepDataUtils';

/* ── layout ───────────────────────────────────────────────── */
const CELL   = 72;       // px per night cell
const GAP    = 3;        // gap between cells
const COLS   = 14;       // 2 weeks per row
const HALF   = CELL / 2;
const LABEL_W = 52;      // month labels

/* ── colour helpers ───────────────────────────────────────── */
function hexToHSL(hex) {
  let r = parseInt(hex.slice(1, 3), 16) / 255;
  let g = parseInt(hex.slice(3, 5), 16) / 255;
  let b = parseInt(hex.slice(5, 7), 16) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  let h, s, l = (mx + mn) / 2;
  if (mx === mn) { h = s = 0; }
  else {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else               h = ((r - g) / d + 4) / 6;
  }
  return [h * 360, s * 100, l * 100];
}

function hsla(h, s, l, a) {
  return `hsla(${((h % 360) + 360) % 360}, ${Math.min(100, Math.max(0, s))}%, ${Math.min(100, Math.max(0, l))}%, ${a})`;
}

/* bedtime → hue offset: early=0, late=+40 */
function bedtimeShift(hour) {
  let h = hour;
  if (h < 12) h += 24;
  return ((h - 20) / 8) * 40; // 0–40 degrees
}

/* ── drawing primitives ───────────────────────────────────── */

function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBlob(ctx, cx, cy, r, rng, lobes) {
  // organic blob using overlapping circles
  const pts = [];
  const n = lobes || 5;
  for (let i = 0; i < n; i++) {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    const jitter = 0.7 + rng() * 0.6;
    const px = cx + r * jitter * Math.cos(angle);
    const py = cy + r * jitter * Math.sin(angle);
    pts.push({ x: px, y: py });
  }
  ctx.beginPath();
  ctx.moveTo(
    (pts[pts.length - 1].x + pts[0].x) / 2,
    (pts[pts.length - 1].y + pts[0].y) / 2
  );
  for (let i = 0; i < pts.length; i++) {
    const next = pts[(i + 1) % pts.length];
    ctx.quadraticCurveTo(
      pts[i].x, pts[i].y,
      (pts[i].x + next.x) / 2,
      (pts[i].y + next.y) / 2
    );
  }
  ctx.closePath();
}

/* ── draw one night's glyph ───────────────────────────────── */
function drawNightGlyph(ctx, night, ox, oy, rng) {
  const sleep   = night.sleep_hours || 0;
  const awake   = night.awake_min || 0;
  const wakeups = night.awakenings || 0;
  const eff     = night.efficiency || 80;
  const bedH    = night.bedtime_hour || 23;

  const [phaseH, phaseS, phaseL] = hexToHSL(night.color);
  const hShift = bedtimeShift(bedH);
  const baseH  = phaseH + hShift;

  const cx = ox + HALF;
  const cy = oy + HALF;

  /* ── 1. Main sleep circle ──────────────────────────────── */
  // radius proportional to sleep hours (0–10h → 8–34px)
  const sleepR = 8 + (sleep / 10) * 26;
  const sleepOffX = (rng() - 0.5) * 6;
  const sleepOffY = (rng() - 0.5) * 6;

  ctx.fillStyle = hsla(baseH, phaseS * 0.9, phaseL + 5, 0.55);
  ctx.beginPath();
  ctx.arc(cx + sleepOffX, cy + sleepOffY, sleepR, 0, Math.PI * 2);
  ctx.fill();

  /* ── 2. Awake pill (rounded rect) ──────────────────────── */
  // width proportional to awake minutes (0–120 → 0–30px)
  if (awake > 0) {
    const pillW = Math.min(30, (awake / 120) * 30) + 4;
    const pillH = 8 + rng() * 8;
    const pillX = cx - pillW / 2 + (rng() - 0.5) * 12;
    const pillY = cy - pillH / 2 + (rng() - 0.5) * 14;

    // awake = darker, warmer, semi-transparent
    ctx.fillStyle = hsla(baseH + 20, 30 + awake * 0.3, 15 + rng() * 12, 0.6);
    drawRoundedRect(ctx, pillX, pillY, pillW, pillH, pillH / 2);
    ctx.fill();
  }

  /* ── 3. Efficiency arc ─────────────────────────────────── */
  // sweep angle proportional to efficiency (0–100 → 0–2π)
  const arcR = sleepR + 3 + rng() * 4;
  const sweep = (eff / 100) * Math.PI * 2;
  const startAngle = -Math.PI / 2 + (rng() - 0.5) * 0.5;

  ctx.strokeStyle = hsla(baseH - 15, phaseS * 0.7, phaseL - 10, 0.4);
  ctx.lineWidth = 2.5 + (eff / 100) * 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx + sleepOffX * 0.5, cy + sleepOffY * 0.5, arcR, startAngle, startAngle + sweep);
  ctx.stroke();

  /* ── 4. Awakening dots ─────────────────────────────────── */
  // small circles scattered, count = awakenings
  const dotR = 2 + rng() * 2;
  for (let i = 0; i < Math.min(wakeups, 12); i++) {
    const angle = (i / Math.max(wakeups, 1)) * Math.PI * 2 + rng() * 0.8;
    const dist = sleepR * (0.3 + rng() * 0.9);
    const dx = cx + dist * Math.cos(angle) + (rng() - 0.5) * 4;
    const dy = cy + dist * Math.sin(angle) + (rng() - 0.5) * 4;

    ctx.fillStyle = hsla(baseH + 40 + rng() * 30, 40, 10 + rng() * 15, 0.65);
    ctx.beginPath();
    ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ── 5. Sleep-quality blob overlay ─────────────────────── */
  // organic blob shape: bigger & more vivid for good sleep,
  // small & muted for fragmented nights
  const blobR = (eff / 100) * 18 + 6;
  const blobOff = (rng() - 0.5) * 10;
  const blobLobes = 4 + Math.floor(rng() * 3);

  ctx.fillStyle = hsla(
    baseH + (rng() - 0.5) * 20,
    phaseS * 0.6 + (eff / 100) * 30,
    phaseL + (rng() - 0.5) * 15,
    0.35
  );
  drawBlob(ctx, cx + blobOff, cy + blobOff * 0.7, blobR, rng, blobLobes);
  ctx.fill();

  /* ── 6. Bedtime indicator (small accent shape) ─────────── */
  // a small half-circle at the bottom: early bed = left, late = right
  const bedNorm = ((bedH < 12 ? bedH + 24 : bedH) - 20) / 8; // 0–1
  const accentX = cx - 12 + bedNorm * 24;
  const accentR = 3 + rng() * 3;

  ctx.fillStyle = hsla(baseH + 60, phaseS * 0.5, phaseL + 20, 0.4);
  ctx.beginPath();
  ctx.arc(accentX, oy + CELL - 6, accentR, Math.PI, 0);
  ctx.fill();
}

/* ── component ────────────────────────────────────────────── */
export default function BlobGlyphs({ data }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date - b.date);
  }, [data]);

  const rows = Math.ceil(sorted.length / COLS);
  const canvasW = LABEL_W + COLS * (CELL + GAP) + GAP;
  const canvasH = rows * (CELL + GAP) + GAP;

  const monthLabels = useMemo(() => {
    const labels = [];
    let prev = -1;
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    sorted.forEach((night, i) => {
      const m = night.date.getMonth();
      const y = night.date.getFullYear();
      const key = y * 12 + m;
      if (key !== prev) {
        prev = key;
        const row = Math.floor(i / COLS);
        labels.push({
          text: `${names[m]} ${String(y).slice(2)}`,
          y: GAP + row * (CELL + GAP) + HALF,
        });
      }
    });
    return labels;
  }, [sorted]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvasW * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvasW, canvasH);

    // background
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // month labels
    ctx.fillStyle = '#AAA';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const label of monthLabels) {
      ctx.fillText(label.text, 2, label.y);
    }

    // draw glyphs
    sorted.forEach((night, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const ox  = LABEL_W + GAP + col * (CELL + GAP);
      const oy  = GAP + row * (CELL + GAP);

      // faint cell background
      const [bh, bs] = hexToHSL(night.color);
      ctx.fillStyle = hsla(bh, bs * 0.15, 95, 0.6);
      drawRoundedRect(ctx, ox, oy, CELL, CELL, 6);
      ctx.fill();

      // the glyph
      const rng = seededRandom(i * 7919 + 31);
      drawNightGlyph(ctx, night, ox, oy, rng);
    });
  }, [sorted, canvasW, canvasH, monthLabels]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - LABEL_W;
    const my = (e.clientY - rect.top)  * scaleY;

    const col = Math.floor((mx - GAP) / (CELL + GAP));
    const row = Math.floor((my - GAP) / (CELL + GAP));
    if (col < 0 || col >= COLS || row < 0) { setTooltip(null); return; }

    const idx = row * COLS + col;
    if (idx >= sorted.length) { setTooltip(null); return; }

    const night = sorted[idx];
    setTooltip({
      ...night,
      screenX: e.clientX + 14,
      screenY: e.clientY - 12,
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
          {Math.round(tooltip.efficiency)}% eff
          {tooltip.bedtime_hour && ` · bed ${Math.floor(tooltip.bedtime_hour)}:${String(Math.round((tooltip.bedtime_hour % 1) * 60)).padStart(2, '0')}`}
        </div>
      )}
    </div>
  );
}
