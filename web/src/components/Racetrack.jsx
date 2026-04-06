import { useRef, useState, useEffect, useCallback } from 'react';
import RacetrackCanvas from './RacetrackCanvas';
import PixelAvatar from './PixelAvatar';

/* ── Default constants ─────────────────────────────────────── */
const DEFAULTS = {
  avatarScale: 0.6,
  marginTop: 40,           // vh
  marginBottom: 50,        // vh
  anchorPct: 50,           // screen anchor point %
  transitionMs: 80,        // avatar transition ms
  avatarOffsetY: -4,       // px above night position
  glowRadius: 6,           // drop-shadow blur
  glowOpacity: 0.4,        // drop-shadow alpha
  avatarFps: 6,            // sprite animation FPS
};

export default function Racetrack() {
  const canvasRef = useRef(null);
  const wrapperRef = useRef(null);
  const [segData, setSegData] = useState(null);
  const [avatarState, setAvatarState] = useState({ x: 0, y: 0, phase: 'Pre-pregnancy', visible: false });
  const [showTuner, setShowTuner] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ── Tunable params ─────────────────────────────────────── */
  const [params, setParams] = useState({ ...DEFAULTS });
  const p = params; // shorthand

  const AVATAR_W = Math.round(238 * p.avatarScale * 0.25);
  const AVATAR_H = Math.round(279 * p.avatarScale * 0.25);

  const set = (key) => (e) =>
    setParams((prev) => ({ ...prev, [key]: parseFloat(e.target.value) }));

  /* ── Load data ───────────────────────────────────────────── */
  useEffect(() => {
    fetch('/data/sleep_segments_racetrack.json')
      .then((r) => r.json())
      .then(setSegData)
      .catch(console.error);
  }, []);

  /* ── Scroll-driven avatar position ───────────────────────── */
  const updateAvatar = useCallback(() => {
    const rc = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!rc || !wrapper) return;

    const totalNights = rc.getTotalNights();
    if (!totalNights) return;

    const container = rc.getContainerElement();
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const viewH = window.innerHeight;

    const canvasH = rect.height;
    const anchor = viewH * (p.anchorPct / 100);
    const scrolled = anchor - rect.top;
    const progress = Math.min(1, Math.max(0, scrolled / canvasH));

    const nightIdx = Math.min(totalNights - 1, Math.floor(progress * totalNights));
    const pos = rc.getNightPosition(nightIdx);
    if (!pos) return;

    setAvatarState({
      x: pos.x,
      y: pos.y,
      phase: pos.night.phase,
      visible: progress > 0 && progress < 1,
    });
  }, [p.anchorPct]);

  useEffect(() => {
    window.addEventListener('scroll', updateAvatar, { passive: true });
    updateAvatar();
    return () => window.removeEventListener('scroll', updateAvatar);
  }, [updateAvatar, segData]);

  /* ── Copy code snippet ──────────────────────────────────── */
  const copyCode = () => {
    const code = `// Racetrack animation params
const AVATAR_SCALE   = ${p.avatarScale};
const MARGIN_TOP     = '${p.marginTop}vh';
const MARGIN_BOTTOM  = '${p.marginBottom}vh';
const ANCHOR_PCT     = ${p.anchorPct};   // screen anchor %
const TRANSITION_MS  = ${p.transitionMs};
const AVATAR_OFFSET_Y = ${p.avatarOffsetY};
const GLOW_RADIUS    = ${p.glowRadius};
const GLOW_OPACITY   = ${p.glowOpacity};
const AVATAR_FPS     = ${p.avatarFps};`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div
      ref={wrapperRef}
      style={{
        width: '100%',
        position: 'relative',
        marginTop: `${p.marginTop}vh`,
        marginBottom: `${p.marginBottom}vh`,
      }}
    >
      <RacetrackCanvas ref={canvasRef} data={segData} />

      {/* Animated avatar overlay */}
      {avatarState.visible && (
        <div
          style={{
            position: 'absolute',
            left: avatarState.x - AVATAR_W / 2,
            top: avatarState.y - AVATAR_H + p.avatarOffsetY,
            pointerEvents: 'none',
            transition: `left ${p.transitionMs}ms linear, top ${p.transitionMs}ms linear`,
            filter: `drop-shadow(0 0 ${p.glowRadius}px rgba(255,255,255,${p.glowOpacity}))`,
            zIndex: 10,
          }}
        >
          <PixelAvatar
            phase={avatarState.phase}
            scale={p.avatarScale}
            animate
          />
        </div>
      )}

      {/* ── Tuner toggle button ───────────────────────────── */}
      <button
        onClick={() => setShowTuner((v) => !v)}
        style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 9999,
          width: 40, height: 40, borderRadius: '50%',
          background: '#2af5d6', color: '#0a0a2e', border: 'none',
          fontSize: 18, cursor: 'pointer', fontFamily: 'monospace',
          boxShadow: '0 2px 12px rgba(42,245,214,0.4)',
        }}
        title="Tune animation"
      >
        {showTuner ? '×' : '⚙'}
      </button>

      {/* ── Tuner modal ───────────────────────────────────── */}
      {showTuner && (
        <div style={tunerStyles.overlay}>
          <div style={tunerStyles.modal}>
            <div style={tunerStyles.header}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>Animation Tuner</span>
              <button onClick={() => setShowTuner(false)} style={tunerStyles.closeBtn}>×</button>
            </div>

            <div style={tunerStyles.body}>
              <Slider label="Avatar scale" value={p.avatarScale} min={0.2} max={1.5} step={0.05} onChange={set('avatarScale')} />
              <Slider label="Margin top (vh)" value={p.marginTop} min={0} max={100} step={5} onChange={set('marginTop')} />
              <Slider label="Margin bottom (vh)" value={p.marginBottom} min={0} max={100} step={5} onChange={set('marginBottom')} />
              <Slider label="Screen anchor %" value={p.anchorPct} min={0} max={100} step={5} onChange={set('anchorPct')} />
              <Slider label="Transition (ms)" value={p.transitionMs} min={0} max={500} step={10} onChange={set('transitionMs')} />
              <Slider label="Avatar Y offset" value={p.avatarOffsetY} min={-40} max={40} step={1} onChange={set('avatarOffsetY')} />
              <Slider label="Glow radius" value={p.glowRadius} min={0} max={20} step={1} onChange={set('glowRadius')} />
              <Slider label="Glow opacity" value={p.glowOpacity} min={0} max={1} step={0.05} onChange={set('glowOpacity')} />
            </div>

            <div style={tunerStyles.footer}>
              <button onClick={() => setParams({ ...DEFAULTS })} style={tunerStyles.resetBtn}>
                Reset
              </button>
              <button onClick={copyCode} style={tunerStyles.copyBtn}>
                {copied ? 'Copied!' : 'Copy Code'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Slider row ────────────────────────────────────────────── */
function Slider({ label, value, min, max, step, onChange }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#ccc', marginBottom: 2 }}>
        <span>{label}</span>
        <span style={{ color: '#2af5d6', fontWeight: 600 }}>{value}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={onChange}
        style={{ width: '100%', accentColor: '#2af5d6', cursor: 'pointer' }}
      />
    </div>
  );
}

/* ── Tuner styles ──────────────────────────────────────────── */
const tunerStyles = {
  overlay: {
    position: 'fixed', bottom: 64, right: 16, zIndex: 9999,
  },
  modal: {
    width: 280,
    background: 'rgba(15, 15, 46, 0.95)',
    backdropFilter: 'blur(12px)',
    borderRadius: 12,
    border: '1px solid rgba(42,245,214,0.25)',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#e0e0e0',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
  },
  closeBtn: {
    background: 'none', border: 'none', color: '#888',
    fontSize: 18, cursor: 'pointer', padding: 0, lineHeight: 1,
  },
  body: {
    padding: '12px 14px', maxHeight: 360, overflowY: 'auto',
  },
  footer: {
    display: 'flex', gap: 8, padding: '10px 14px',
    borderTop: '1px solid rgba(255,255,255,0.08)',
  },
  resetBtn: {
    flex: 1, padding: '6px 0', borderRadius: 6, border: '1px solid #555',
    background: 'transparent', color: '#aaa', fontSize: 11,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  copyBtn: {
    flex: 1, padding: '6px 0', borderRadius: 6, border: 'none',
    background: '#2af5d6', color: '#0a0a2e', fontSize: 11,
    fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
};
