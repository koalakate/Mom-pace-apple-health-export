import { useRef, useEffect, useMemo, useState, useCallback } from 'react';

/* ── layout ───────────────────────────────────────────────── */
const DOT_R    = 3;        // dot radius
const DOT_GAP  = 1;        // gap between dots
const COL_W    = 4;        // width per night column
const BASELINE = 300;      // y position of the zero line
const MARGIN   = { top: 30, right: 20, bottom: 40, left: 60 };

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

/* efficiency → colour: green (good) → yellow → red (bad) */
function effColor(eff) {
  // 100=deep green, 80=green, 60=yellow, 40=orange, 20=red
  const t = Math.max(0, Math.min(1, (eff - 20) / 80));
  const h = t * 120; // 0 (red) → 120 (green)
  const s = 55 + (1 - Math.abs(t - 0.5) * 2) * 20; // more saturated at extremes
  const l = 42 + (1 - t) * 12;
  return { h, s, l };
}

/* ── component ────────────────────────────────────────────── */
export default function StackedDots({ data }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date - b.date);
  }, [data]);

  const canvasW = MARGIN.left + sorted.length * COL_W + MARGIN.right;
  const canvasH = BASELINE + 160 + MARGIN.bottom; // room below baseline for awake dots

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

    // baseline
    ctx.strokeStyle = '#E0DDD5';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN.left, BASELINE);
    ctx.lineTo(canvasW - MARGIN.right, BASELINE);
    ctx.stroke();

    // y-axis labels
    ctx.fillStyle = '#999';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';

    const step = DOT_R * 2 + DOT_GAP;

    // sleep hours labels (above baseline)
    for (let h = 2; h <= 10; h += 2) {
      const y = BASELINE - h * step - step / 2;
      ctx.fillText(`${h}h`, MARGIN.left - 8, y);
      // faint gridline
      ctx.strokeStyle = '#F0EDE5';
      ctx.beginPath();
      ctx.moveTo(MARGIN.left, y);
      ctx.lineTo(canvasW - MARGIN.right, y);
      ctx.stroke();
    }

    // awake label (below baseline)
    ctx.fillText('awake', MARGIN.left - 4, BASELINE + 30);

    // phase boundary markers & month labels
    let prevMonth = -1;
    let prevPhase = '';

    sorted.forEach((night, i) => {
      const x = MARGIN.left + i * COL_W;

      // month labels along bottom
      const m = night.date.getMonth();
      const y2 = night.date.getFullYear();
      const key = y2 * 12 + m;
      if (key !== prevMonth) {
        prevMonth = key;
        const names = ['J','F','M','A','M','J','J','A','S','O','N','D'];
        ctx.fillStyle = '#BBB';
        ctx.textAlign = 'center';
        ctx.font = '8px Inter, system-ui, sans-serif';
        ctx.fillText(names[m], x, canvasH - MARGIN.bottom + 12);
        // year label on Jan
        if (m === 0 || i === 0) {
          ctx.fillStyle = '#999';
          ctx.font = '9px Inter, system-ui, sans-serif';
          ctx.fillText(String(y2), x, canvasH - MARGIN.bottom + 24);
        }
      }

      // phase boundaries
      if (night.phase !== prevPhase) {
        if (prevPhase) {
          ctx.strokeStyle = night.color;
          ctx.lineWidth = 1;
          ctx.globalAlpha = 0.4;
          ctx.beginPath();
          ctx.moveTo(x, MARGIN.top);
          ctx.lineTo(x, canvasH - MARGIN.bottom);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        prevPhase = night.phase;
      }
    });

    // draw dots
    sorted.forEach((night, i) => {
      const x = MARGIN.left + i * COL_W + COL_W / 2;
      const sleep = Math.round(night.sleep_hours || 0);
      const eff = night.efficiency || 80;
      const awakenings = night.awakenings || 0;
      const awakeMin = night.awake_min || 0;
      const [phaseH, phaseS] = hexToHSL(night.color);
      const ec = effColor(eff);

      // sleep dots above baseline (stacked upward)
      for (let d = 0; d < sleep; d++) {
        const dotY = BASELINE - (d + 1) * step;
        // blend phase hue with efficiency hue
        const blendH = (phaseH * 0.4 + ec.h * 0.6 + 360) % 360;
        const alpha = 0.7 + (d / sleep) * 0.2;
        ctx.fillStyle = hsla(blendH, ec.s, ec.l, alpha);
        ctx.beginPath();
        ctx.arc(x, dotY, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // awake dots below baseline (stacked downward)
      // 1 dot per 10 min awake
      const awakeDots = Math.round(awakeMin / 10);
      for (let d = 0; d < awakeDots; d++) {
        const dotY = BASELINE + (d + 1) * step;
        // dark, warm tones for awake time
        ctx.fillStyle = hsla(phaseH + 15, 25, 18 + d * 2, 0.6);
        ctx.beginPath();
        ctx.arc(x, dotY, DOT_R, 0, Math.PI * 2);
        ctx.fill();
      }

      // awakening markers: slightly larger, darker dots on top of stack
      for (let w = 0; w < Math.min(awakenings, 8); w++) {
        const dotY = BASELINE + (awakeDots + w + 1) * step;
        ctx.fillStyle = hsla(0, 40, 12, 0.55);
        ctx.beginPath();
        ctx.arc(x, dotY, DOT_R * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }, [sorted, canvasW, canvasH]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvasW / rect.width;
    const mx = (e.clientX - rect.left) * scaleX - MARGIN.left;
    const idx = Math.floor(mx / COL_W);
    if (idx < 0 || idx >= sorted.length) { setTooltip(null); return; }

    const night = sorted[idx];
    setTooltip({
      ...night,
      screenX: e.clientX + 14,
      screenY: e.clientY - 12,
    });
  }, [sorted, canvasW]);

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
        </div>
      )}
    </div>
  );
}
