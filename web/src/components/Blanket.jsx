import { useRef, useEffect, useMemo } from 'react';
import { scaleLinear } from 'd3';

const STITCH_WIDTH = 3;
const STITCH_GAP = 1;
const STRAND_COUNT = 5;
const MAX_HEIGHT = 300;
const MARGIN = { top: 20, bottom: 40 };

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
