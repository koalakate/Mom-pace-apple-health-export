import { useRef, useEffect, useMemo, useState, useCallback } from 'react';

/* ── layout ───────────────────────────────────────────────── */
const SIZE       = 900;          // canvas width & height
const CX         = SIZE / 2;     // center x
const CY         = SIZE / 2;     // center y
const INNER_R    = 60;           // innermost ring radius
const RING_GAP   = 8;            // gap between year rings
const BAR_MAX    = 60;           // max bar height (px outward)
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

/* efficiency → hue: 100=210 (blue), 50=30 (orange), 0=0 (red) */
function effToHue(eff) {
  const t = Math.max(0, Math.min(1, eff / 100));
  return t * 210;
}

/* ── group nights by year ─────────────────────────────────── */
function groupByYear(sorted) {
  const years = new Map();
  for (const night of sorted) {
    const y = night.date.getFullYear();
    if (!years.has(y)) years.set(y, []);
    years.get(y).push(night);
  }
  return Array.from(years.entries()).sort((a, b) => a[0] - b[0]);
}

/* day-of-year (0–365) */
function dayOfYear(date) {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  return Math.floor(diff / 86400000);
}

/* ── component ────────────────────────────────────────────── */
export default function SpiralCalendar({ data }) {
  const canvasRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const sorted = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => a.date - b.date);
  }, [data]);

  const yearGroups = useMemo(() => groupByYear(sorted), [sorted]);

  const ringWidth = useMemo(() => {
    if (yearGroups.length === 0) return BAR_MAX;
    const available = (SIZE / 2 - INNER_R - 40) / yearGroups.length;
    return Math.min(BAR_MAX, Math.max(20, available - RING_GAP));
  }, [yearGroups]);

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

    // month spoke lines and labels
    ctx.strokeStyle = '#E8E5DD';
    ctx.lineWidth = 0.5;
    ctx.fillStyle = '#999';
    ctx.font = '11px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const outerR = INNER_R + yearGroups.length * (ringWidth + RING_GAP) + 20;

    for (let m = 0; m < 12; m++) {
      const angle = (m / 12) * Math.PI * 2 - Math.PI / 2;
      const x1 = CX + INNER_R * 0.8 * Math.cos(angle);
      const y1 = CY + INNER_R * 0.8 * Math.sin(angle);
      const x2 = CX + outerR * Math.cos(angle);
      const y2 = CY + outerR * Math.sin(angle);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      // label
      const labelR = outerR + 18;
      const lx = CX + labelR * Math.cos(angle);
      const ly = CY + labelR * Math.sin(angle);
      ctx.fillText(MONTH_NAMES[m], lx, ly);
    }

    // year labels on left
    ctx.fillStyle = '#BBB';
    ctx.font = '10px Inter, system-ui, sans-serif';
    ctx.textAlign = 'right';

    // draw each year ring
    yearGroups.forEach(([year, nights], yi) => {
      const baseR = INNER_R + yi * (ringWidth + RING_GAP);

      // year label
      ctx.fillStyle = '#BBB';
      ctx.textAlign = 'right';
      const labelAngle = -Math.PI / 2 - 0.15;
      ctx.fillText(
        String(year),
        CX + (baseR + ringWidth / 2) * Math.cos(labelAngle) - 5,
        CY + (baseR + ringWidth / 2) * Math.sin(labelAngle)
      );

      // faint ring outline
      ctx.strokeStyle = '#F0EDE5';
      ctx.lineWidth = 0.3;
      ctx.beginPath();
      ctx.arc(CX, CY, baseR, 0, Math.PI * 2);
      ctx.stroke();

      const daysInYear = new Date(year, 11, 31).getDate() === 31 ?
        (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000 : 365;

      for (const night of nights) {
        const doy = dayOfYear(night.date);
        const angle = (doy / daysInYear) * Math.PI * 2 - Math.PI / 2;
        const nextAngle = ((doy + 1) / daysInYear) * Math.PI * 2 - Math.PI / 2;
        const sliceAngle = nextAngle - angle;

        // bar height proportional to sleep hours (0-10 → 0-ringWidth)
        const sleep = night.sleep_hours || 0;
        const barH = (sleep / 10) * ringWidth;
        const eff = night.efficiency || 80;

        // colour: phase-tinted efficiency
        const [phaseH, phaseS] = hexToHSL(night.color);
        const effH = effToHue(eff);
        const blendH = (phaseH * 0.35 + effH * 0.65 + 360) % 360;
        const s = 40 + (eff / 100) * 35;
        const l = 35 + (sleep / 10) * 20;

        // draw radial bar as arc segment
        const r1 = baseR;
        const r2 = baseR + barH;

        ctx.fillStyle = hsla(blendH, s, l, 0.85);
        ctx.beginPath();
        ctx.arc(CX, CY, r2, angle, angle + sliceAngle * 0.85);
        ctx.arc(CX, CY, r1, angle + sliceAngle * 0.85, angle, true);
        ctx.closePath();
        ctx.fill();

        // awake time: small dark extension beyond sleep bar
        const awakeMin = night.awake_min || 0;
        if (awakeMin > 0) {
          const awakeH = (awakeMin / 120) * (ringWidth - barH) * 0.6;
          if (awakeH > 0.5) {
            ctx.fillStyle = hsla(phaseH, 15, 15, 0.5);
            ctx.beginPath();
            ctx.arc(CX, CY, r2 + awakeH, angle, angle + sliceAngle * 0.85);
            ctx.arc(CX, CY, r2, angle + sliceAngle * 0.85, angle, true);
            ctx.closePath();
            ctx.fill();
          }
        }
      }
    });
  }, [sorted, yearGroups, ringWidth]);

  // tooltip on hover
  const handleMouseMove = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas || sorted.length === 0) return;
    const rect = canvas.getBoundingClientRect();
    const scale = SIZE / rect.width;
    const mx = (e.clientX - rect.left) * scale - CX;
    const my = (e.clientY - rect.top)  * scale - CY;
    const dist = Math.sqrt(mx * mx + my * my);
    let angle = Math.atan2(my, mx) + Math.PI / 2;
    if (angle < 0) angle += Math.PI * 2;
    const dayFrac = angle / (Math.PI * 2);

    // which ring?
    for (let yi = 0; yi < yearGroups.length; yi++) {
      const baseR = INNER_R + yi * (ringWidth + RING_GAP);
      if (dist >= baseR && dist < baseR + ringWidth + 15) {
        const [year, nights] = yearGroups[yi];
        const daysInYear = (new Date(year + 1, 0, 1) - new Date(year, 0, 1)) / 86400000;
        const targetDoy = Math.floor(dayFrac * daysInYear);
        const night = nights.find(n => Math.abs(dayOfYear(n.date) - targetDoy) <= 1);
        if (night) {
          setTooltip({ ...night, screenX: e.clientX + 14, screenY: e.clientY - 12 });
          return;
        }
      }
    }
    setTooltip(null);
  }, [sorted, yearGroups, ringWidth]);

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
