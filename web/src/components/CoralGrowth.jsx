import { useRef, useEffect, useMemo } from 'react';
import { groupByWeek, seededRandom } from '../utils/sleepDataUtils';
import { mean, scaleLinear } from 'd3';

const WIDTH = 600;
const HEIGHT = 900;
const BASE_Y = HEIGHT - 40;
const TRUNK_X = WIDTH / 2;

export default function CoralGrowth({ data }) {
  const canvasRef = useRef(null);

  const weeks = useMemo(() => {
    if (!data) return [];
    return groupByWeek(data).map((w) => ({
      ...w,
      avgSleep: mean(w.nights, (n) => n.sleep_hours),
      avgAwakenings: mean(w.nights, (n) => n.awakenings),
      phase: w.nights[Math.floor(w.nights.length / 2)].phase,
      color: w.nights[Math.floor(w.nights.length / 2)].color,
    }));
  }, [data]);

  useEffect(() => {
    if (!weeks.length) return;

    const canvas = canvasRef.current;
    canvas.width = WIDTH * 2;
    canvas.height = HEIGHT * 2;
    canvas.style.width = `${WIDTH}px`;
    canvas.style.height = `${HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.lineCap = 'round';

    const growthScale = scaleLinear()
      .domain([2, 9])
      .range([1.5, 5])
      .clamp(true);

    const branchScale = scaleLinear()
      .domain([0, 5])
      .range([1, 4])
      .clamp(true);

    function drawBranch(x, y, angle, length, thickness, depth, color) {
      if (depth <= 0 || thickness < 0.3) return;

      const endX = x + Math.cos(angle) * length;
      const endY = y + Math.sin(angle) * length;

      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.globalAlpha = 0.7 + depth * 0.05;
      ctx.stroke();

      return { x: endX, y: endY };
    }

    let currentX = TRUNK_X;
    let currentY = BASE_Y;
    let currentAngle = -Math.PI / 2;

    weeks.forEach((week, i) => {
      const rand = seededRandom(i * 997 + 13);
      const growth = growthScale(week.avgSleep);
      const branches = Math.round(branchScale(week.avgAwakenings));
      const thickness = Math.max(1, 4 - i * 0.015);

      const jitter = (rand() - 0.5) * 0.08;
      const end = drawBranch(
        currentX,
        currentY,
        currentAngle + jitter,
        growth,
        thickness,
        10,
        week.color
      );

      if (!end) return;

      if (branches >= 2) {
        for (let b = 0; b < branches - 1; b++) {
          const branchAngle =
            currentAngle +
            ((b % 2 === 0 ? 1 : -1) * (0.4 + rand() * 0.5));
          const branchLen = growth * (0.3 + rand() * 0.4);

          const branchEnd = drawBranch(
            end.x,
            end.y,
            branchAngle,
            branchLen,
            thickness * 0.5,
            3,
            week.color
          );

          if (branchEnd && branches >= 4) {
            const subAngle = branchAngle + ((rand() - 0.5) * 0.8);
            drawBranch(
              branchEnd.x,
              branchEnd.y,
              subAngle,
              branchLen * 0.5,
              thickness * 0.25,
              1,
              week.color
            );
          }
        }
      }

      currentX = end.x;
      currentY = end.y;
      currentAngle =
        -Math.PI / 2 + (TRUNK_X - currentX) * 0.008 + jitter;
    });

    ctx.globalAlpha = 1;
  }, [weeks]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
      }}
    />
  );
}
