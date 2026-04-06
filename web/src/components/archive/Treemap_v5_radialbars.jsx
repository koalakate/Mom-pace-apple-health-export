import { useRef, useEffect, useMemo, useState, useCallback } from 'react';

/* ── layout ───────────────────────────────────────────────── */
const SIZE      = 960;
const CX        = SIZE / 2;
const CY        = SIZE / 2;
const INNER_R   = 80;         // baseline radius
const OUTER_MAX = 340;        // max outward extent from baseline
const INNER_MAX = 50;         // max inward extent (awake time)
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

/* ── component ────────────────────────────────────────────── */
export default function RadialBars({ data }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date - b.date);
  }, [data]);

  const totalNights = sorted.length;
  const sliceAngle = (Math.PI * 2) / Math.max(totalNights, 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width  = SIZE * dpr;
    canvas.height = SIZE * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, SIZE, SIZE);

    // background
    ctx.fillStyle = '#FFFDF5';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // baseline circle
    ctx.strokeStyle = '#E8E5DD';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(CX, CY, INNER_R, 0, Math.PI * 2);
    ctx.stroke();

    // month labels at outer edge
    ctx.fillStyle = '#999';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // find month boundaries in data
    let prevMonth = -1;
    const monthAngles = [];
    sorted.forEach((night, i) => {
      const m = night.date.getMonth();
      const y = night.date.getFullYear();
      const key = y * 12 + m;
      if (key !== prevMonth) {
        prevMonth = key;
        monthAngles.push({ angle: i * sliceAngle - Math.PI / 2, m, y, i });
      }
    });

    // draw radial bars for each night
    sorted.forEach((night, i) => {
      const angle = i * sliceAngle - Math.PI / 2;
      const sleep = night.sleep_hours || 0;
      const awakeMin = night.awake_min || 0;
      const eff = night.efficiency || 80;
      const awakenings = night.awakenings || 0;
      const [phaseH, phaseS, phaseL] = hexToHSL(night.color);

      // outward bar: sleep hours (0-10 → 0-OUTER_MAX)
      const outH = (sleep / 10) * OUTER_MAX;
      const r1 = INNER_R;
      const r2 = INNER_R + outH;

      // colour: phase hue, lightness modulated by efficiency
      const s = 35 + (eff / 100) * 40;
      const l = 30 + (eff / 100) * 30;
      const alpha = 0.75 + (sleep / 10) * 0.2;

      ctx.fillStyle = hsla(phaseH, s, l, alpha);
      ctx.beginPath();
      ctx.arc(CX, CY, r2, angle, angle + sliceAngle * 0.88);
      ctx.arc(CX, CY, r1, angle + sliceAngle * 0.88, angle, true);
      ctx.closePath();
      ctx.fill();

      // awakening subdivisions: thin dark lines cutting the bar
      if (awakenings > 0 && outH > 5) {
        ctx.strokeStyle = hsla(phaseH, 10, 10, 0.35);
        ctx.lineWidth = 0.4;
        const segH = outH / (awakenings + 1);
        for (let w = 1; w <= awakenings; w++) {
          const cutR = r1 + segH * w;
          const midAngle = angle + sliceAngle * 0.44;
          ctx.beginPath();
          ctx.arc(CX, CY, cutR, angle + sliceAngle * 0.05, angle + sliceAngle * 0.83);
          ctx.stroke();
        }
      }

      // inward bar: awake time (0-120min → 0-INNER_MAX)
      if (awakeMin > 0) {
        const inH = Math.min(INNER_MAX, (awakeMin / 120) * INNER_MAX);
        const ri1 = INNER_R - inH;
        const ri2 = INNER_R;

        ctx.fillStyle = hsla(phaseH + 10, 20, 15, 0.55);
        ctx.beginPath();
        ctx.arc(CX, CY, ri2, angle, angle + sliceAngle * 0.88);
        ctx.arc(CX, CY, Math.max(5, ri1), angle + sliceAngle * 0.88, angle, true);
        ctx.closePath();
        ctx.fill();
      }
    });

    // month spoke lines and labels on top
    for (const { angle, m, y, i: idx } of monthAngles) {
      // spoke
      ctx.strokeStyle = '#D5D0C8';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(CX + (INNER_R - INNER_MAX - 5) * Math.cos(angle), CY + (INNER_R - INNER_MAX - 5) * Math.sin(angle));
      ctx.lineTo(CX + (INNER_R + OUTER_MAX + 10) * Math.cos(angle), CY + (INNER_R + OUTER_MAX + 10) * Math.sin(angle));
      ctx.stroke();

      // label
      const labelR = INNER_R + OUTER_MAX + 22;
      ctx.fillStyle = '#999';
      ctx.font = '9px Inter, system-ui, sans-serif';
      ctx.fillText(
        `${MONTH_NAMES[m]} ${String(y).slice(2)}`,
        CX + labelR * Math.cos(angle + sliceAngle * 4),
        CY + labelR * Math.sin(angle + sliceAngle * 4)
      );
    }
  }, [sorted, totalNights, sliceAngle]);

  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const mx = (e.clientX - rect.left) * scale - CX;
    const my = (e.clientY - rect.top)  * scale - CY;

    let angle = Math.atan2(my, mx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const idx = Math.floor(angle / sliceAngle);

    if (idx >= 0 && idx < sorted.length) {
      const night = sorted[idx];
      setTooltip({ ...night, screenX: e.clientX + 14, screenY: e.clientY - 12 });
    } else {
      setTooltip(null);
    }
  }, [sorted, sliceAngle]);

  return (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
      <canvas
        ref={canvasRef}
        style={{ width: SIZE, height: SIZE, display: 'block', maxWidth: '100%' }}
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
