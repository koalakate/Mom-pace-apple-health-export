import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { timeMonday } from 'd3';

/*
 * Patterned Venn — simplified, two measures only
 *
 * Circle A (dots):  total sleep time in minutes
 * Circle B (lines): total awake time in minutes
 * Overlap (distance): ratio of awake/sleep — higher ratio = more overlap
 *
 * Both circles scaled in the same unit (minutes) so they're directly
 * comparable. A night with 400min sleep and 40min awake → big dot circle,
 * small line circle, moderate overlap (10% ratio).
 */

/* ── layout ───────────────────────────────────────────────── */
const WEEKS    = 12;
const COLS     = 6;
const PAD      = 48;
const LABEL_W  = 56;
const MIN_R    = 6;

/* ── circle intersection geometry (venn.js approach) ──────── */

/** Intersection area of two circles at distance d */
function circleOverlapArea(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d + Math.min(r1, r2) <= Math.max(r1, r2))
    return Math.PI * Math.min(r1, r2) ** 2;
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  return (
    r1 * r1 * Math.acos(a / r1) +
    r2 * r2 * Math.acos((d - a) / r2) -
    d * Math.sqrt(Math.max(0, r1 * r1 - a * a))
  );
}

/** Binary-search for distance d where overlap area = target */
function distanceForOverlap(r1, r2, targetArea) {
  if (targetArea <= 0) return r1 + r2;
  const minCircle = Math.PI * Math.min(r1, r2) ** 2;
  if (targetArea >= minCircle) return Math.abs(r1 - r2);

  let lo = Math.abs(r1 - r2);
  let hi = r1 + r2;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    if (circleOverlapArea(r1, r2, mid) > targetArea) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/* ── pattern fills ────────────────────────────────────────── */
function fillDots(ctx, bounds, spacing, dotR) {
  ctx.fillStyle = 'rgba(30,30,30,0.6)';
  for (let y = bounds.y0; y <= bounds.y1; y += spacing) {
    for (let x = bounds.x0; x <= bounds.x1; x += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function fillLines(ctx, bounds, spacing, lineW) {
  ctx.strokeStyle = 'rgba(30,30,30,0.5)';
  ctx.lineWidth = lineW;
  ctx.lineCap = 'round';
  const span = bounds.y1 - bounds.y0 + bounds.x1 - bounds.x0;
  for (let d = -span; d <= span; d += spacing) {
    ctx.beginPath();
    ctx.moveTo(bounds.x0, bounds.y0 + d);
    ctx.lineTo(bounds.x1, bounds.y0 + d + (bounds.x1 - bounds.x0));
    ctx.stroke();
  }
}

/* ── clip helpers ─────────────────────────────────────────── */

/* ── weekly aggregation ───────────────────────────────────── */
function aggregateWeeks(sorted) {
  const weeks = [];
  let current = null;

  for (const night of sorted) {
    const weekStart = timeMonday.floor(night.date);
    const key = weekStart.toISOString();

    if (!current || current.key !== key) {
      if (current) weeks.push(current);
      current = { key, weekStart, nights: [], phase: night.phase, color: night.color };
    }
    current.nights.push(night);
    current.phase = night.phase;
    current.color = night.color;
  }
  if (current) weeks.push(current);

  return weeks.map((w) => {
    const n = w.nights.length;
    const avgSleepMin = w.nights.reduce((s, d) => s + (d.total_sleep_min || d.sleep_hours * 60 || 0), 0) / n;
    const avgAwakeMin = w.nights.reduce((s, d) => s + (d.awake_min || 0), 0) / n;
    return {
      weekStart: w.weekStart,
      phase: w.phase,
      color: w.color,
      nightCount: n,
      avgSleepMin,
      avgAwakeMin,
      ratio: avgSleepMin > 0 ? avgAwakeMin / avgSleepMin : 0,
      dateLabel: w.nights[0].night_date,
    };
  });
}

/* ── component ────────────────────────────────────────────── */
export default function TangentKnit({ data }) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);
  const [containerW, setContainerW] = useState(0);

  // measure container width (80vw)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(([entry]) => {
      setContainerW(Math.floor(entry.contentRect.width));
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const weeks = useMemo(() => {
    if (!data) return [];
    const sorted = [...data].sort((a, b) => a.date - b.date);
    const allWeeks = aggregateWeeks(sorted);
    return allWeeks.slice(-WEEKS);
  }, [data]);

  // find max sleep/awake to scale both on same axis
  const maxMin = useMemo(() => {
    if (weeks.length === 0) return 1;
    return Math.max(
      ...weeks.map((w) => w.avgSleepMin),
      ...weeks.map((w) => w.avgAwakeMin)
    );
  }, [weeks]);

  // derive cell size from container width
  const CELL = containerW > 0 ? Math.floor((containerW - LABEL_W - PAD) / COLS) : 140;
  const MAX_R = Math.floor(CELL * 0.4);
  const rows = Math.ceil(weeks.length / COLS);
  const canvasW = LABEL_W + COLS * CELL + PAD;
  const canvasH = PAD + rows * CELL + PAD;

  const monthLabels = useMemo(() => {
    const labels = [];
    let prev = -1;
    const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    weeks.forEach((w, i) => {
      const d = w.weekStart;
      const m = d.getMonth();
      const y = d.getFullYear();
      const key = y * 12 + m;
      if (key !== prev) {
        prev = key;
        const row = Math.floor(i / COLS);
        labels.push({
          text: `${names[m]} ${String(y).slice(2)}`,
          y: PAD + row * CELL + CELL / 2,
        });
      }
    });
    return labels;
  }, [weeks]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || weeks.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = canvasW * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    ctx.fillStyle = '#EFECE5';
    ctx.fillRect(0, 0, canvasW, canvasH);

    // month labels
    ctx.fillStyle = '#AAA';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    for (const label of monthLabels) {
      ctx.fillText(label.text, 2, label.y);
    }

    const k = CELL / 140;  // scale patterns with cell size
    const dotSpacing  = 6 * k;
    const dotR        = 1.2 * k;
    const lineSpacing = 5 * k;
    const lineW       = 0.7 * k;

    weeks.forEach((week, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cellCx = LABEL_W + col * CELL + CELL / 2;
      const cellCy = PAD + row * CELL + CELL / 2;

      // Circle areas proportional to minutes (sqrt → radius)
      // Scale factor: largest sleep circle fills MAX_R
      const scale = (MAX_R * MAX_R * Math.PI) / maxMin;
      const rA = Math.max(MIN_R, Math.sqrt(week.avgSleepMin * scale / Math.PI));
      const rB = Math.max(MIN_R, Math.sqrt(week.avgAwakeMin * scale / Math.PI));

      // Intersection area from venn.js approach:
      // |A∩B| proportional to ratio × |B| (awake time shared with sleep)
      const intersectionArea = week.ratio * week.avgAwakeMin * scale;
      const dist = distanceForOverlap(rA, rB, intersectionArea);

      const ax = cellCx - dist / 2;
      const bx = cellCx + dist / 2;
      const ay = cellCy;
      const by = cellCy;

      const bounds = {
        x0: cellCx - CELL / 2,
        y0: cellCy - CELL / 2,
        x1: cellCx + CELL / 2,
        y1: cellCy + CELL / 2,
      };

      // Dots inside circle A (sleep)
      ctx.save();
      ctx.beginPath();
      ctx.arc(ax, ay, rA, 0, Math.PI * 2);
      ctx.clip();
      fillDots(ctx, bounds, dotSpacing, dotR);
      ctx.restore();

      // Lines inside circle B (awake) — overlap region naturally gets both
      ctx.save();
      ctx.beginPath();
      ctx.arc(bx, by, rB, 0, Math.PI * 2);
      ctx.clip();
      fillLines(ctx, bounds, lineSpacing, lineW);
      ctx.restore();

      // faint outlines
      ctx.strokeStyle = 'rgba(30,30,30,0.12)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.arc(ax, ay, rA, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(bx, by, rB, 0, Math.PI * 2);
      ctx.stroke();

      // week date label
      const d = week.weekStart;
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      ctx.fillStyle = '#999';
      ctx.font = `${Math.round(10 * k)}px Inter, system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(label, cellCx, cellCy + MAX_R + 6);
    });
  }, [weeks, maxMin, canvasW, canvasH, CELL, MAX_R, monthLabels]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || weeks.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const scaleY = canvasH / rect.height;
    const mx = (e.clientX - rect.left) * scaleX - LABEL_W;
    const my = (e.clientY - rect.top) * scaleY - PAD;

    const col = Math.floor(mx / CELL);
    const row = Math.floor(my / CELL);
    if (col < 0 || col >= COLS || row < 0) { setTooltip(null); return; }

    const idx = row * COLS + col;
    if (idx >= weeks.length) { setTooltip(null); return; }

    const w = weeks[idx];
    setTooltip({
      screenX: e.clientX + 14,
      screenY: e.clientY - 12,
      week: w,
    });
  }, [weeks, canvasW, canvasH, CELL]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '80vw', margin: '0 auto' }}>
      <canvas
        ref={canvasRef}
        style={{ width: canvasW, height: canvasH, display: 'block', maxWidth: '100%' }}
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
          fontSize: 12,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 10,
          lineHeight: 1.5,
        }}>
          <strong>Week of {tooltip.week.dateLabel}</strong> · {tooltip.week.phase}<br />
          {Math.round(tooltip.week.avgSleepMin)} min sleep · {Math.round(tooltip.week.avgAwakeMin)} min awake<br />
          ratio {(tooltip.week.ratio * 100).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
