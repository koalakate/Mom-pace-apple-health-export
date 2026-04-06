import { useRef, useEffect, useMemo, useState, useCallback } from 'react';

/* ── layout ───────────────────────────────────────────────── */
const W         = 600;
const MARGIN    = { top: 40, right: 30, bottom: 50, left: 30 };
const RIBBON_W  = W - MARGIN.left - MARGIN.right;
const WINDOW    = 14;        // rolling average window (days)
const LINE_GAP  = 2.5;       // horizontal texture line spacing
const PHASE_COLORS = {
  'Pre-pregnancy': '#2A9D8F',
  'Pregnancy 1':   '#FF9F1C',
  'Postpartum 1':  '#E63946',
  'Pregnancy 2':   '#FF9F1C',
  'Postpartum 2':  '#E63946',
};

/* ── colour helpers ───────────────────────────────────────── */
function hexToRGBA(hex, a) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

/* ── rolling average ──────────────────────────────────────── */
function rolling(arr, key, win) {
  const out = [];
  let sum = 0;
  for (let i = 0; i < arr.length; i++) {
    sum += arr[i][key] || 0;
    if (i >= win) sum -= arr[i - win][key] || 0;
    const n = Math.min(i + 1, win);
    out.push(sum / n);
  }
  return out;
}

/* ── bezier smoothed path from points ─────────────────────── */
function smoothPath(points) {
  if (points.length < 2) return '';
  let d = `M ${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const cpx = (x0 + x1) / 2;
    d += ` C ${cpx} ${y0}, ${cpx} ${y1}, ${x1} ${y1}`;
  }
  return d;
}

/* ── component ────────────────────────────────────────────── */
export default function LayeredRibbons({ data }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date - b.date);
  }, [data]);

  // compute rolling averages for each metric
  const metrics = useMemo(() => {
    if (sorted.length === 0) return null;
    return {
      sleep:      rolling(sorted, 'sleep_hours', WINDOW),
      awake:      rolling(sorted, 'awake_min', WINDOW),
      efficiency: rolling(sorted, 'efficiency', WINDOW),
      awakenings: rolling(sorted, 'awakenings', WINDOW),
    };
  }, [sorted]);

  // vertical space: each ribbon gets a band
  // sleep: 0-10h, awake: 0-120min, efficiency: 0-100, awakenings: 0-10
  const ribbons = useMemo(() => {
    if (!metrics) return [];
    const bandH = 140;
    return [
      {
        name: 'Sleep Hours',
        values: metrics.sleep,
        yBase: MARGIN.top,
        bandH,
        domain: [0, 10],
        color: '#2A9D8F',
        lightColor: '#B8E4DE',
      },
      {
        name: 'Awake Minutes',
        values: metrics.awake,
        yBase: MARGIN.top + bandH + 20,
        bandH,
        domain: [0, 90],
        color: '#E63946',
        lightColor: '#F5C6CB',
      },
      {
        name: 'Efficiency %',
        values: metrics.efficiency,
        yBase: MARGIN.top + (bandH + 20) * 2,
        bandH,
        domain: [50, 100],
        color: '#5B5EA6',
        lightColor: '#C5C6E8',
      },
      {
        name: 'Awakenings',
        values: metrics.awakenings,
        yBase: MARGIN.top + (bandH + 20) * 3,
        bandH,
        domain: [0, 8],
        color: '#FF9F1C',
        lightColor: '#FFE0A3',
      },
    ];
  }, [metrics]);

  const canvasH = MARGIN.top + 4 * 160 + MARGIN.bottom;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0 || !metrics) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = W * dpr;
    canvas.height = canvasH * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, canvasH);

    // background
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, W, canvasH);

    const n = sorted.length;
    const xStep = RIBBON_W / n;

    for (const ribbon of ribbons) {
      const { values, yBase, bandH, domain, color, lightColor, name } = ribbon;
      const [dMin, dMax] = domain;

      // map value to y
      const valToY = (v) => {
        const t = Math.max(0, Math.min(1, (v - dMin) / (dMax - dMin)));
        return yBase + bandH - t * bandH;
      };

      // ribbon label
      ctx.fillStyle = '#888';
      ctx.font = '10px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(name, MARGIN.left, yBase - 8);

      // build top and bottom edges of ribbon
      // top = rolling avg, bottom = band base (or slightly above)
      const topPts = [];
      const botPts = [];

      for (let i = 0; i < n; i++) {
        const x = MARGIN.left + i * xStep;
        const yTop = valToY(values[i]);
        const yBot = yBase + bandH;
        topPts.push([x, yTop]);
        botPts.push([x, yBot]);
      }

      // draw filled ribbon with phase-colored segments
      // split by phase boundaries
      let segStart = 0;
      for (let i = 0; i <= n; i++) {
        const atEnd = i === n;
        const phaseChanged = !atEnd && i > 0 && sorted[i].phase !== sorted[i - 1].phase;

        if (atEnd || phaseChanged) {
          const segEnd = atEnd ? n - 1 : i - 1;
          const phaseColor = PHASE_COLORS[sorted[segStart].phase] || color;

          // filled shape: top edge forward, bottom edge backward
          ctx.beginPath();
          ctx.moveTo(topPts[segStart][0], topPts[segStart][1]);
          for (let j = segStart + 1; j <= segEnd; j++) {
            const [x0, y0] = topPts[j - 1];
            const [x1, y1] = topPts[j];
            const cpx = (x0 + x1) / 2;
            ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
          }
          // line down to bottom
          ctx.lineTo(botPts[segEnd][0], botPts[segEnd][1]);
          // bottom edge backward
          for (let j = segEnd; j > segStart; j--) {
            const [x0, y0] = botPts[j];
            const [x1, y1] = botPts[j - 1];
            const cpx = (x0 + x1) / 2;
            ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
          }
          ctx.closePath();

          ctx.fillStyle = hexToRGBA(phaseColor, 0.25);
          ctx.fill();

          // horizontal line texture
          ctx.save();
          ctx.clip();
          ctx.strokeStyle = hexToRGBA(phaseColor, 0.12);
          ctx.lineWidth = 0.5;
          for (let ly = yBase; ly <= yBase + bandH; ly += LINE_GAP) {
            ctx.beginPath();
            ctx.moveTo(topPts[segStart][0], ly);
            ctx.lineTo(topPts[segEnd][0], ly);
            ctx.stroke();
          }
          ctx.restore();

          // top edge stroke
          ctx.strokeStyle = hexToRGBA(phaseColor, 0.7);
          ctx.lineWidth = 1.5;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(topPts[segStart][0], topPts[segStart][1]);
          for (let j = segStart + 1; j <= segEnd; j++) {
            const [x0, y0] = topPts[j - 1];
            const [x1, y1] = topPts[j];
            const cpx = (x0 + x1) / 2;
            ctx.bezierCurveTo(cpx, y0, cpx, y1, x1, y1);
          }
          ctx.stroke();

          if (!atEnd) segStart = i;
        }
      }
    }

    // year labels along bottom
    ctx.fillStyle = '#AAA';
    ctx.font = '9px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    let prevYear = -1;
    sorted.forEach((night, i) => {
      const y = night.date.getFullYear();
      const m = night.date.getMonth();
      if (y !== prevYear && m <= 1) {
        prevYear = y;
        ctx.fillText(String(y), MARGIN.left + i * xStep, canvasH - 10);
      }
    });
  }, [sorted, metrics, ribbons, canvasH]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scale = W / rect.width;
    const mx = (e.clientX - rect.left) * scale - MARGIN.left;
    const idx = Math.floor(mx / (RIBBON_W / sorted.length));
    if (idx >= 0 && idx < sorted.length) {
      const night = sorted[idx];
      setTooltip({ ...night, screenX: e.clientX + 14, screenY: e.clientY - 12 });
    } else {
      setTooltip(null);
    }
  }, [sorted]);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{ width: W, height: canvasH, display: 'block', maxWidth: '100%' }}
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
