import { useRef, useEffect, useMemo } from 'react';
import { groupByWeek, seededRandom } from '../utils/sleepDataUtils';
import { mean, scaleLinear } from 'd3';

const WIDTH = 700;
const HEIGHT = 1200;
const BASE_Y = HEIGHT - 60;
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

    // Deep dark background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    ctx.lineCap = 'round';

    // Growth per week: good sleep = tall, bad = stunted
    const growthScale = scaleLinear()
      .domain([3, 9])
      .range([2, 6])
      .clamp(true);

    // Branches: more awakenings = more splits
    const branchScale = scaleLinear()
      .domain([0, 5])
      .range([1, 5])
      .clamp(true);

    // Trunk thickness tapers over time
    const trunkThicknessScale = scaleLinear()
      .domain([0, weeks.length])
      .range([10, 1.5])
      .clamp(true);

    function drawOrganicBranch(x1, y1, x2, y2, thickness, color, alpha) {
      ctx.beginPath();
      // Slight curve for organic feel
      const midX = (x1 + x2) / 2 + (x2 - x1) * 0.15;
      const midY = (y1 + y2) / 2;
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(midX, midY, x2, y2);
      ctx.strokeStyle = color;
      ctx.lineWidth = thickness;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    }

    let currentX = TRUNK_X;
    let currentY = BASE_Y;
    let mainAngle = -Math.PI / 2; // Growing upward

    weeks.forEach((week, i) => {
      const rand = seededRandom(i * 997 + 13);
      const growth = growthScale(week.avgSleep);
      const branches = Math.round(branchScale(week.avgAwakenings));
      const thickness = trunkThicknessScale(i);

      // Main trunk segment — slight organic sway
      const jitter = (rand() - 0.5) * 0.1;
      const angle = mainAngle + jitter;
      const endX = currentX + Math.cos(angle) * growth;
      const endY = currentY + Math.sin(angle) * growth;

      // Draw main trunk
      drawOrganicBranch(currentX, currentY, endX, endY, thickness, week.color, 0.85);

      // Draw side branches when awakenings are high
      if (branches >= 2) {
        for (let b = 0; b < branches - 1; b++) {
          const side = b % 2 === 0 ? 1 : -1;
          const branchAngle = angle + side * (0.3 + rand() * 0.6);
          const branchLen = growth * (0.5 + rand() * 0.8);
          const branchThickness = thickness * 0.45;

          const bx = endX + Math.cos(branchAngle) * branchLen;
          const by = endY + Math.sin(branchAngle) * branchLen;

          drawOrganicBranch(endX, endY, bx, by, branchThickness, week.color, 0.6);

          // Sub-branches for dense fragmentation (awakenings >= 4)
          if (branches >= 4) {
            const subCount = 1 + Math.floor(rand() * 2);
            for (let sb = 0; sb < subCount; sb++) {
              const subSide = sb % 2 === 0 ? 1 : -1;
              const subAngle = branchAngle + subSide * (0.4 + rand() * 0.5);
              const subLen = branchLen * (0.3 + rand() * 0.4);
              const subThickness = branchThickness * 0.4;

              const sx = bx + Math.cos(subAngle) * subLen;
              const sy = by + Math.sin(subAngle) * subLen;

              drawOrganicBranch(bx, by, sx, sy, subThickness, week.color, 0.4);

              // Tiny tips for really chaotic weeks
              if (branches >= 5 && rand() > 0.4) {
                const tipAngle = subAngle + (rand() - 0.5) * 1.0;
                const tipLen = subLen * 0.4;
                const tx = sx + Math.cos(tipAngle) * tipLen;
                const ty = sy + Math.sin(tipAngle) * tipLen;
                drawOrganicBranch(sx, sy, tx, ty, subThickness * 0.4, week.color, 0.25);
              }
            }
          }
        }
      }

      currentX = endX;
      currentY = endY;

      // Drift correction — keep trunk roughly centered
      mainAngle = -Math.PI / 2 + (TRUNK_X - currentX) * 0.012 + jitter * 0.3;
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
