/**
 * PixelAvatar — sprite-sheet animation using a single PNG + canvas.
 * Run cycle: frame 1 → 4 → 2 → 4 (stride → together → stride → together).
 * When animate=false, shows frame 4 (standing idle).
 */
import { useRef, useEffect, useState } from 'react';

const SPRITESHEET = '/avatars/spritesheet.png';

/* Crop rects [x, y, w, h] for each avatar's 4 frames on the sheet */
const FRAMES = {
  'Pre-pregnancy': [
    [10, 10, 93, 94],
    [113, 10, 93, 94],
    [216, 10, 93, 94],
    [319, 10, 93, 94],
  ],
  'Pregnancy 1': [
    [10, 114, 93, 88],
    [113, 114, 92, 88],
    [216, 114, 93, 88],
    [319, 114, 93, 88],
  ],
  'Postpartum 1': [
    [10, 214, 93, 85],
    [113, 212, 92, 87],
    [216, 212, 93, 87],
    [319, 214, 93, 85],
  ],
  'Pregnancy 2': [
    [10, 311, 93, 85],
    [113, 310, 93, 86],
    [216, 309, 93, 87],
    [319, 309, 93, 87],
  ],
  'Postpartum 2': [
    [10, 407, 93, 86],
    [113, 406, 93, 87],
    [216, 406, 93, 87],
    [319, 408, 93, 85],
  ],
};

/* Toddler phase uses separate PNG files (only frames 1 and 4 available) */
const TODDLER_FRAMES_SRCS = [
  '/avatars/04.1_with_toddler_frame1.png',
  '/avatars/04.4_with_toddler_frame4.png',
];
const TODDLER_RUN_CYCLE = [0, 1, 0, 1]; // stride, together, stride, together
const TODDLER_IDLE = 1;

/* Run cycle: 1→4→2→4 (0-indexed: 0→3→1→3) */
const RUN_CYCLE = [0, 3, 1, 3];
const IDLE_FRAME = 3; // legs together
const FPS = 6;

/* Singleton sprite sheet loader */
let _sheet = null;
let _sheetPromise = null;
function loadSheet() {
  if (_sheet) return Promise.resolve(_sheet);
  if (_sheetPromise) return _sheetPromise;
  _sheetPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => { _sheet = img; resolve(img); };
    img.src = SPRITESHEET;
  });
  return _sheetPromise;
}

/* Toddler frame loader */
let _toddlerFrames = null;
let _toddlerPromise = null;
function loadToddlerFrames() {
  if (_toddlerFrames) return Promise.resolve(_toddlerFrames);
  if (_toddlerPromise) return _toddlerPromise;
  _toddlerPromise = Promise.all(
    TODDLER_FRAMES_SRCS.map(
      (src) =>
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.src = src;
        }),
    ),
  ).then((imgs) => {
    _toddlerFrames = imgs;
    return imgs;
  });
  return _toddlerPromise;
}

function PixelAvatar({ phase, scale = 1, animate = false }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(0);
  const [sheetReady, setSheetReady] = useState(!!_sheet);
  const [toddlerReady, setToddlerReady] = useState(!!_toddlerFrames);
  const isToddler = phase === 'Toddler';

  useEffect(() => {
    loadSheet().then(() => setSheetReady(true));
    loadToddlerFrames().then(() => setToddlerReady(true));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    if (isToddler) {
      if (!toddlerReady) return;
      function draw() {
        const idx = animate
          ? TODDLER_RUN_CYCLE[frameRef.current % TODDLER_RUN_CYCLE.length]
          : TODDLER_IDLE;
        const img = _toddlerFrames[idx];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, img.width, img.height, 0, 0, canvas.width, canvas.height);
      }
      draw();
      if (!animate) return;
      const id = setInterval(() => { frameRef.current++; draw(); }, 1000 / FPS);
      return () => clearInterval(id);
    } else {
      if (!sheetReady) return;
      const frames = FRAMES[phase] || FRAMES['Pre-pregnancy'];
      function draw() {
        const idx = animate
          ? RUN_CYCLE[frameRef.current % RUN_CYCLE.length]
          : IDLE_FRAME;
        const [sx, sy, sw, sh] = frames[idx];
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(_sheet, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
      }
      draw();
      if (!animate) return;
      const id = setInterval(() => { frameRef.current++; draw(); }, 1000 / FPS);
      return () => clearInterval(id);
    }
  }, [sheetReady, toddlerReady, phase, animate, isToddler]);

  const w = Math.round(93 * scale);
  const h = Math.round(94 * scale);

  return (
    <canvas
      ref={canvasRef}
      width={93}
      height={94}
      style={{
        width: w,
        height: h,
        imageRendering: 'pixelated',
      }}
      className="pixel-grid"
    />
  );
}

export default PixelAvatar;
