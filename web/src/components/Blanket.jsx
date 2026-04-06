import { useRef, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3';
import { seededRandom } from '../utils/sleepDataUtils';

const COL_WIDTH = 8;
const COL_GAP = 2;
const STRAND_COUNT = 5;
const STRAND_WIDTH = 1.4;
const MAX_HEIGHT = 500;
const MARGIN = { top: 30, bottom: 50 };
const KNOT_SIZE = 5;

export default function Blanket({ data }) {
  const canvasRef = useRef(null);

  const totalWidth = useMemo(
    () => (data ? data.length * (COL_WIDTH + COL_GAP) + COL_GAP : 800),
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
    ctx.clearRect(0, 0, totalWidth, totalHeight);

    // Dark background like fabric
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, totalWidth, totalHeight);

    const heightScale = scaleLinear()
      .domain([0, 10])
      .range([0, MAX_HEIGHT])
      .clamp(true);

    sorted.forEach((night, i) => {
      const rand = seededRandom(i * 1000 + 7);
      const x = i * (COL_WIDTH + COL_GAP) + COL_GAP;
      const stitchHeight = heightScale(night.sleep_hours);
      const yTop = MARGIN.top + (MAX_HEIGHT - stitchHeight);
      const yBottom = MARGIN.top + MAX_HEIGHT;

      // Draw each strand as a V-stitch (stockinette) pattern
      for (let s = 0; s < STRAND_COUNT; s++) {
        const sx = x + (s * COL_WIDTH) / (STRAND_COUNT - 1);
        const isLeft = s < STRAND_COUNT / 2;
        const isCenter = s === Math.floor(STRAND_COUNT / 2);

        // Lighter color at center, darker at edges for 3D effect
        const brightness = isCenter ? 1.0 : 0.7 + (0.3 * (1 - Math.abs(s - 2) / 2));
        ctx.strokeStyle = adjustBrightness(night.color, brightness);
        ctx.lineWidth = STRAND_WIDTH;
        ctx.lineCap = 'round';
        ctx.globalAlpha = 0.9;

        ctx.beginPath();

        if (night.awakenings === 0) {
          // Smooth stitch — gentle wave for textile feel
          drawSmoothStrand(ctx, sx, yTop, yBottom, isLeft, rand);
        } else {
          // Stitches with knots
          ctx.moveTo(sx, yTop);
          const knotSpacing = stitchHeight / (night.awakenings + 1);

          for (let k = 1; k <= night.awakenings; k++) {
            const ky = yTop + knotSpacing * k;

            // Draw strand to just before knot
            drawWavyLine(ctx, sx, ky - KNOT_SIZE, isLeft, rand);

            // Draw the knot — a visible loop that breaks the vertical flow
            const bulge = KNOT_SIZE + rand() * 3;
            const dir = isLeft ? -1 : 1;
            ctx.bezierCurveTo(
              sx + dir * bulge, ky - KNOT_SIZE * 0.6,
              sx + dir * bulge * 1.2, ky + KNOT_SIZE * 0.6,
              sx, ky + KNOT_SIZE
            );
          }
          ctx.lineTo(sx, yBottom);
        }

        ctx.stroke();
      }

      // Draw a subtle V-stitch connector across strands every ~20px
      if (stitchHeight > 30) {
        const vCount = Math.floor(stitchHeight / 18);
        ctx.strokeStyle = adjustBrightness(night.color, 0.5);
        ctx.lineWidth = 0.6;
        ctx.globalAlpha = 0.4;
        for (let v = 0; v < vCount; v++) {
          const vy = yTop + 10 + v * 18;
          if (vy < yBottom - 5) {
            ctx.beginPath();
            ctx.moveTo(x, vy);
            ctx.lineTo(x + COL_WIDTH / 2, vy + 4);
            ctx.lineTo(x + COL_WIDTH, vy);
            ctx.stroke();
          }
        }
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

function drawSmoothStrand(ctx, sx, yTop, yBottom, isLeft, rand) {
  const segments = Math.max(3, Math.floor((yBottom - yTop) / 15));
  ctx.moveTo(sx, yTop);
  for (let seg = 1; seg <= segments; seg++) {
    const segY = yTop + (seg / segments) * (yBottom - yTop);
    const wobble = (rand() - 0.5) * 1.2;
    ctx.lineTo(sx + wobble, segY);
  }
}

function drawWavyLine(ctx, sx, toY, isLeft, rand) {
  const wobble = (rand() - 0.5) * 0.8;
  ctx.lineTo(sx + wobble, toY);
}

function adjustBrightness(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const clamp = (v) => Math.min(255, Math.max(0, Math.round(v * factor)));
  return `rgb(${clamp(r)}, ${clamp(g)}, ${clamp(b)})`;
}
