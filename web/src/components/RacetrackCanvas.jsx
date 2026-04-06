import { useRef, useEffect, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PHASE_COLORS } from '../utils/sleepDataUtils';

/* ── Constants ──────────────────────────────────────────────── */
const H_SCALE  = 12;
const LANE_H   = 14 * H_SCALE;          // 168 px
const ROW_H    = 5;
const ROW_GAP  = 1.5;
const ROW_STEP = ROW_H + ROW_GAP;
const R_INNER  = 24;
const R_OUTER  = R_INNER + LANE_H;
const R_MID    = (R_INNER + R_OUTER) / 2;
const MARGIN_Y = 50;
const SEG_R    = ROW_H / 2;

/* Arcade-neon phase colors */
const ARCADE_PHASE = {
  'Pre-pregnancy': '#2af5d6',
  'Pregnancy 1':   '#ffb347',
  'Postpartum 1':  '#b36bff',
  'Pregnancy 2':   '#ffd642',
  'Postpartum 2':  '#ff4da6',
};

/* ── Component ──────────────────────────────────────────────── */
const RacetrackCanvas = forwardRef(function RacetrackCanvas({ data, onHoverNight }, ref) {
  const canvasRef    = useRef(null);
  const containerRef = useRef(null);
  const positionsRef = useRef([]);   // [{x, y, laneTop, laneBot, night}]
  const geometryRef  = useRef(null);

  useImperativeHandle(ref, () => ({
    getNightPosition(idx) {
      return positionsRef.current[idx] || null;
    },
    getGeometry() {
      return geometryRef.current;
    },
    getTotalNights() {
      return data ? data.length : 0;
    },
    getContainerElement() {
      return containerRef.current;
    },
  }));

  useEffect(() => {
    if (!data || !containerRef.current) return;

    const W   = containerRef.current.clientWidth;
    const dpr = window.devicePixelRatio || 1;

    /* ── Track geometry ─────────────────────────────────── */
    const xLeft     = R_OUTER + 20;
    const xRight    = W - R_OUTER - 20;
    const straightW = xRight - xLeft;
    const N_straight = Math.max(1, Math.floor(straightW / ROW_STEP));
    const dTheta    = ROW_STEP / R_MID;
    const N_curve   = Math.floor(Math.PI / dTheta);
    const N_loop    = 2 * N_straight + 2 * N_curve;
    const loops     = Math.ceil(data.length / N_loop);
    const pairH     = 2 * LANE_H + 4 * R_INNER;

    /* Figure out how far the last data point reaches in the last loop */
    const lastPos   = (data.length - 1) % N_loop;
    const lastLoop  = Math.floor((data.length - 1) / N_loop);
    // 0 = in lane 0, 1 = in right curve, 2 = in lane 1, 3 = in left curve
    let lastSeg = 0;
    if (lastPos < N_straight) lastSeg = 0;
    else if (lastPos < N_straight + N_curve) lastSeg = 1;
    else if (lastPos < 2 * N_straight + N_curve) lastSeg = 2;
    else lastSeg = 3;

    /* Trim canvas height: only draw up to the last used lane section */
    let trimH;
    const lastBaseY = MARGIN_Y + lastLoop * pairH;
    if (lastSeg === 0) trimH = lastBaseY + LANE_H + MARGIN_Y;
    else if (lastSeg === 1) trimH = lastBaseY + LANE_H + 2 * R_INNER + MARGIN_Y;
    else if (lastSeg === 2) trimH = lastBaseY + 2 * LANE_H + 2 * R_INNER + MARGIN_Y;
    else trimH = lastBaseY + pairH + MARGIN_Y;

    const totalH = trimH;

    geometryRef.current = { W, totalH, xLeft, xRight, N_straight, N_curve, N_loop, loops, pairH };

    /* ── Canvas setup ───────────────────────────────────── */
    const canvas = canvasRef.current;
    canvas.width  = W * dpr;
    canvas.height = totalH * dpr;
    canvas.style.width  = `${W}px`;
    canvas.style.height = `${totalH}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, totalH);

    /* ── Track outline ──────────────────────────────────── */
    drawTrackOutline(ctx, loops, pairH, xLeft, xRight, lastLoop, lastSeg);

    /* ── Draw nights + record positions ─────────────────── */
    const positions = [];

    data.forEach((night, idx) => {
      const loop = Math.floor(idx / N_loop);
      const pos  = idx % N_loop;
      const color = ARCADE_PHASE[night.phase] || PHASE_COLORS[night.phase] || '#666';
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.88;

      const baseY = MARGIN_Y + loop * pairH;
      let nx, ny;

      if (pos < N_straight) {
        /* Lane 0: left → right — avatar runs along the top edge */
        const x = xLeft + pos * ROW_STEP;
        drawStraightNight(ctx, night.segments, x, baseY, false);
        nx = x + ROW_H / 2;
        ny = baseY;

      } else if (pos < N_straight + N_curve) {
        /* Right curve — draw data on curve, avatar slides down the right edge */
        const i  = pos - N_straight;
        const cx = xRight;
        const cy = baseY + LANE_H + R_INNER;
        const t  = (i + 0.5) / N_curve;
        const angle = -Math.PI / 2 + t * Math.PI;
        drawCurveNight(ctx, night.segments, cx, cy, angle, (ROW_H / 2) / R_MID, false);
        /* avatar: interpolate from end of lane 0 to start of lane 1 */
        const lane1Top = baseY + LANE_H + 2 * R_INNER;
        nx = xRight + R_MID * Math.cos(angle);
        ny = baseY + t * (lane1Top - baseY);

      } else if (pos < 2 * N_straight + N_curve) {
        /* Lane 1: right → left — avatar runs along top edge of lane 1 */
        const i = pos - N_straight - N_curve;
        const laneTop = baseY + LANE_H + 2 * R_INNER;
        const x = xRight - (i + 1) * ROW_STEP;
        drawStraightNight(ctx, night.segments, x, laneTop, true);
        nx = x + ROW_H / 2;
        ny = laneTop;

      } else {
        /* Left curve — draw data on curve, avatar slides down the left edge */
        const i  = pos - 2 * N_straight - N_curve;
        const cx = xLeft;
        const cy = baseY + 2 * LANE_H + 3 * R_INNER;
        const t  = (i + 0.5) / N_curve;
        const angle = -Math.PI / 2 - t * Math.PI;
        drawCurveNight(ctx, night.segments, cx, cy, angle, (ROW_H / 2) / R_MID, true);
        /* avatar: interpolate from end of lane 1 to start of next lane 0 */
        const lane1Top = baseY + LANE_H + 2 * R_INNER;
        const nextBaseY = baseY + pairH;
        nx = xLeft + R_MID * Math.cos(angle);
        ny = lane1Top + t * (nextBaseY - lane1Top);
      }

      positions.push({ x: nx, y: ny, night });
    });

    positionsRef.current = positions;
    ctx.globalAlpha = 1;

    /* ── Time labels ────────────────────────────────────── */
    ctx.fillStyle = '#8b88a8';
    ctx.font = "9px 'JetBrains Mono', monospace";
    ctx.textAlign = 'right';
    [
      [2, '22:00'], [4, '00:00'], [6, '02:00'],
      [8, '04:00'], [10, '06:00'], [12, '08:00'],
    ].forEach(([h, label]) => {
      ctx.fillText(label, xLeft - 6, MARGIN_Y + h * H_SCALE + 3);
    });

  }, [data]);

  /* ── Mouse hover detection ───────────────────────────────── */
  const handleMouseMove = useCallback((e) => {
    if (!positionsRef.current.length || !containerRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = (canvasRef.current.width / (window.devicePixelRatio || 1)) / rect.width;
    const scaleY = (canvasRef.current.height / (window.devicePixelRatio || 1)) / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    /* Column-first matching: find nights within X tolerance,
       then pick the one whose lane Y range contains the mouse */
    let closest = null;
    let closestDist = Infinity;
    const xSnap = ROW_STEP * 2; // generous X snap

    for (let i = 0; i < positionsRef.current.length; i++) {
      const p = positionsRef.current[i];
      const dx = Math.abs(p.x - cx);
      if (dx > xSnap) continue;
      /* check Y is within the lane (night position ± LANE_H) */
      const dy = Math.abs(p.y + LANE_H / 2 - cy);
      if (dy > LANE_H) continue;
      const dist = dx + dy * 0.1; // heavily favor X proximity
      if (dist < closestDist) {
        closestDist = dist;
        closest = { index: i, ...p, screenX: e.clientX, screenY: e.clientY };
      }
    }
    onHoverNight?.(closest);
  }, [onHoverNight]);

  const handleMouseLeave = useCallback(() => {
    onHoverNight?.(null);
  }, [onHoverNight]);

  return (
    <div ref={containerRef} style={{ width: '100%', position: 'relative' }}>
      {data ? (
        <canvas
          ref={canvasRef}
          style={{ display: 'block', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        />
      ) : (
        <p style={{ color: '#8b88a8', padding: '2rem', fontFamily: "'Press Start 2P', monospace", fontSize: '10px' }}>
          LOADING...
        </p>
      )}
    </div>
  );
});

export default RacetrackCanvas;

/* ── Drawing helpers ────────────────────────────────────────── */

function drawStraightNight(ctx, segments, x, laneTop, flipped) {
  segments.forEach((seg) => {
    let y0, y1;
    if (!flipped) {
      y0 = laneTop + seg.s * H_SCALE;
      y1 = laneTop + seg.e * H_SCALE;
    } else {
      y0 = laneTop + LANE_H - seg.e * H_SCALE;
      y1 = laneTop + LANE_H - seg.s * H_SCALE;
    }
    const h = y1 - y0;
    if (h < 1) return;
    roundRect(ctx, x, y0, ROW_H, h, Math.min(SEG_R, h / 2));
  });
}

function drawCurveNight(ctx, segments, cx, cy, angle, halfDAngle, isLeft) {
  ctx.lineCap = 'round';
  ctx.lineWidth = ROW_H;
  segments.forEach((seg) => {
    let rStart, rEnd;
    if (!isLeft) {
      rStart = R_OUTER - seg.s * H_SCALE;
      rEnd   = R_OUTER - seg.e * H_SCALE;
    } else {
      rStart = R_INNER + seg.s * H_SCALE;
      rEnd   = R_INNER + seg.e * H_SCALE;
    }
    const rOuter = Math.max(rStart, rEnd);
    const rInner = Math.min(rStart, rEnd);
    if (rOuter - rInner < 1) return;
    const pad = ROW_H / 2;
    const ri = rInner + pad;
    const ro = rOuter - pad;
    if (ro <= ri) return;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    ctx.moveTo(cx + ri * Math.cos(angle), cy + ri * Math.sin(angle));
    ctx.lineTo(cx + ro * Math.cos(angle), cy + ro * Math.sin(angle));
    ctx.stroke();
  });
}

function drawTrackOutline(ctx, loops, pairH, xLeft, xRight, lastLoop, lastSeg) {
  ctx.strokeStyle = '#3d3b6e';
  ctx.lineWidth = 0.5;
  for (let loop = 0; loop < loops; loop++) {
    const isLast = loop === lastLoop;
    const baseY = MARGIN_Y + loop * pairH;

    // Lane 0 (always drawn)
    const l0top = baseY;
    const l0bot = baseY + LANE_H;
    ctx.beginPath();
    ctx.moveTo(xLeft, l0top); ctx.lineTo(xRight, l0top);
    ctx.moveTo(xLeft, l0bot); ctx.lineTo(xRight, l0bot);
    ctx.stroke();

    if (isLast && lastSeg === 0) continue;

    // Right curve
    const rcCy = l0bot + R_INNER;
    ctx.beginPath(); ctx.arc(xRight, rcCy, R_INNER, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(xRight, rcCy, R_OUTER, -Math.PI / 2, Math.PI / 2); ctx.stroke();

    if (isLast && lastSeg === 1) continue;

    // Lane 1
    const l1top = baseY + LANE_H + 2 * R_INNER;
    const l1bot = l1top + LANE_H;
    ctx.beginPath();
    ctx.moveTo(xLeft, l1top); ctx.lineTo(xRight, l1top);
    ctx.moveTo(xLeft, l1bot); ctx.lineTo(xRight, l1bot);
    ctx.stroke();

    if (isLast && lastSeg === 2) continue;

    // Left curve
    const lcCy = l1bot + R_INNER;
    ctx.beginPath(); ctx.arc(xLeft, lcCy, R_INNER, Math.PI / 2, -Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(xLeft, lcCy, R_OUTER, Math.PI / 2, -Math.PI / 2); ctx.stroke();
  }
}

function roundRect(ctx, x, y, w, h, r) {
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
  ctx.fill();
}
