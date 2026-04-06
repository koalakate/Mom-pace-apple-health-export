import { useRef, useEffect, useState } from "react";
import Lenis from "lenis";
import RacetrackCanvas from "../components/RacetrackCanvas";
import PixelAvatar from "../components/PixelAvatar";
import useIsMobile from "../hooks/useIsMobile";
import MobileStub from "../components/MobileStub";
import "../styles/arcade-theme.css";

/* ── Callouts ──────────────────────────────────────────────── */
const STATIC_CALLOUTS = [
  {
    nightIndex: 0,
    label: "START",
    text: "June 2021. Sleep is long, unbroken, easy. A steady rhythm — 7-8 hours, barely any awakenings. You don't think about it yet.",
  },
  {
    nightIndex: 200,
    label: "SHIFT",
    text: "Sleep is still solid, but patterns start drifting. Something is changing.",
  },
  {
    nightIndex: 417,
    label: "4 MONTH SLEEP REGRESSION",
    text: "Sep 2022. Baby hits the 4-month sleep regression. Cycles shorten, wake-ups multiply. What used to be one long stretch now shatters into restless fragments.",
  },
  {
    nightIndex: 670,
    label: "1 YEAR SLEEP REGRESSION",
    text: "Apr 2023. The 12-month sleep regression hits. Naps collapse, night wake-ups return. Just when you thought you had it figured out.",
  },
  {
    nightIndex: 1100,
    label: "RECOVERY MODE",
    text: "Sleep is finally getting better — 6 and 7 hour nights are becoming the norm. Mom starts feeling human again. And with that comes the dangerous thought: maybe it's time for baby #2 :)",
  },
  {
    nightIndex: 1503,
    label: "PREGNANT INSOMNIA",
    text: "Oct 2025. Pregnancy insomnia. The belly is too big, every position is wrong. Tossing, turning, wide awake at 3 AM. Sleep becomes a negotiation with your own body.",
  },
];

function computeDynamicCallouts(data) {
  if (!data?.length) return [];
  const out = [];
  const pl = {
    "Pregnancy 1": {
      label: "NEW GAME+",
      text: "Pregnancy begins. Sleep gets lighter, more fragmented. The body is preparing.",
    },
    "Postpartum 1": {
      label: "BOSS FIGHT",
      text: "Baby #1 arrives. Sleep shatters into fragments. Every 2-3 hours, awake.",
    },
    "Pregnancy 2": {
      label: "ROUND 2",
      text: "Pregnant again — this time with a toddler. The challenge doubles.",
    },
    "Postpartum 2": {
      label: "FINAL LEVEL",
      text: "Two kids. A toddler and a newborn. Sleep becomes a rare power-up.",
    },
  };
  for (const [phase, meta] of Object.entries(pl)) {
    const i = data.findIndex((n) => n.phase === phase);
    if (i >= 0) out.push({ nightIndex: i, ...meta });
  }
  let mxS = 0,
    mxSi = 0,
    mnH = 24,
    mnHi = 0,
    mxH = 0,
    mxHi = 0;
  data.forEach((n, i) => {
    if (n.segments.length > mxS) {
      mxS = n.segments.length;
      mxSi = i;
    }
    if (n.sleep_hours < mnH && n.sleep_hours > 0) {
      mnH = n.sleep_hours;
      mnHi = i;
    }
    if (n.sleep_hours > mxH) {
      mxH = n.sleep_hours;
      mxHi = i;
    }
  });
  if (mxS > 2)
    out.push({
      nightIndex: mxSi,
      label: "CRITICAL HIT",
      text: `December2023. Flu season. ${mxS} awakenings in one night. Sleep broken into tiny fragments.`,
    });
  out.push({
    nightIndex: mnHi,
    label: "LOW HP",
    text: `Only ${mnH.toFixed(1)}h of sleep. Running on fumes.`,
  });
  out.push({
    nightIndex: mxHi,
    label: "POWER-UP",
    text: `${mxH.toFixed(1)}h — the longest night. A rare full recharge.`,
  });
  out.push({
    nightIndex: data.length - 1,
    label: "FINISH LINE",
    text: `${data.length.toLocaleString()} nights. Still running. Still going.`,
  });
  return out;
}

function formatDate(s) {
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
function formatHour(h) {
  const h24 = (20 + h) % 24;
  return `${String(Math.floor(h24)).padStart(2, "0")}:${String(Math.round((h24 % 1) * 60)).padStart(2, "0")}`;
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}

const TODDLER_START_NIGHT = 730; // ~June 2023

function getDisplayPhase(dataPhase, nightIdx) {
  if (dataPhase === "Postpartum 1" && nightIdx >= TODDLER_START_NIGHT)
    return "Toddler";
  return dataPhase;
}

const phaseOrder = [
  "Pre-pregnancy",
  "Pregnancy 1",
  "Postpartum 1",
  "Toddler",
  "Pregnancy 2",
  "Postpartum 2",
];
const phaseColors = {
  "Pre-pregnancy": "#2af5d6",
  "Pregnancy 1": "#ffb347",
  "Postpartum 1": "#b36bff",
  Toddler: "#b36bff",
  "Pregnancy 2": "#ffd642",
  "Postpartum 2": "#ff4da6",
};
const CALLOUT_WINDOW_DEFAULT = 160;

/* ── Tunable defaults ──────────────────────────────────────── */
const DEFAULTS = {
  // Scroll
  scrollVh: 3, // viewports of scrolling (higher = slower)
  // Avatar
  avatarLerpX: 0.18, // avatar X follow speed
  avatarLerpY: 0.18, // avatar Y follow speed
  avatarOffX: -56, // avatar X offset from night pos
  avatarOffY: -56, // avatar Y offset from night pos
  avatarScale: 1.5, // PixelAvatar scale
  // Track camera (deadzone)
  trackLerp: 0.06, // camera follow speed
  deadTop: 0.12, // top edge — camera scrolls up if avatar above this
  deadBot: 0.54, // bottom edge — camera scrolls down if avatar below this
  camLerpSlow: 0.005, // lerp when avatar just entered edge zone
  camLerpFast: 0.3, // lerp when avatar is far past edge
  // Camera delay — % of scroll progress before track starts moving
  camDelay: 200, // avatar moves alone for first N% of scroll
  // Viewport
  cameraViewH: 200, // viewH offset subtracted from innerHeight (px)
  trackScrollEnabled: true, // toggle track scrolling on/off
  // Callouts
  calloutWindow: 60, // nights a callout stays visible
};

export default function RacetrackPage() {
  const mobile = useIsMobile();
  const [data, setData] = useState(null);
  const [started, setStarted] = useState(false);
  const [allCallouts, setAllCallouts] = useState(STATIC_CALLOUTS);
  const [hoverInfo, setHoverInfo] = useState(null);
  const [hudNight, setHudNight] = useState(0);
  const [hudPhase, setHudPhase] = useState("Pre-pregnancy");
  const [activeCallout, setActiveCallout] = useState(null);
  const [calloutState, setCalloutState] = useState("hidden");
  const [calloutParallax, setCalloutParallax] = useState(0);
  const [calloutScreenPos, setCalloutScreenPos] = useState(null);
  const [isEnd, setIsEnd] = useState(false);
  const [debugScroll, setDebugScroll] = useState(0);
  const [fullViewport, setFullViewport] = useState(false);
  const tp = DEFAULTS;
  const canvasRef = useRef(null);
  const scrollRef = useRef(null);
  const avatarRef = useRef(null);
  const trackInnerRef = useRef(null);
  const animState = useRef({
    targetX: 0,
    targetY: 0,
    curX: 0,
    curY: 0,
    nightIdx: 0,
    init: false,
    scrollY: 0,
    trackScrollY: 0,
  });
  const tpRef = useRef(tp);

  /* ── Lenis smooth scroll ──────────────────────────────────── */
  const lenisRef = useRef(null);
  useEffect(() => {
    if (!started) return;
    const lenis = new Lenis({
      lerp: 0.07,
      smoothWheel: true,
      wheelMultiplier: 0.6,
      touchMultiplier: 1.2,
    });
    lenisRef.current = lenis;
    let rafId;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [started]);

  useEffect(() => {
    fetch("/data/sleep_segments_racetrack.json")
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setAllCallouts(
          [...STATIC_CALLOUTS, ...computeDynamicCallouts(d)].sort(
            (a, b) => a.nightIndex - b.nightIndex,
          ),
        );
      })
      .catch(console.error);
  }, []);

  /* ── rAF loop ────────────────────────────────────────────────
     The track is `position: sticky` inside a tall scroll container.
     Scroll progress through the container → night index.
     The track stays in the viewport; the avatar moves within it.
     We also scroll the canvas vertically to keep the avatar visible
     within the fixed-height track viewport.                       */
  useEffect(() => {
    if (!data) return;
    let rafId;
    let lastHud = 0;

    const tick = (now) => {
      const st = animState.current;
      const scrollEl = scrollRef.current;
      if (!scrollEl) {
        rafId = requestAnimationFrame(tick);
        return;
      }

      /* 1. Scroll progress through the tall container */
      const rect = scrollEl.getBoundingClientRect();
      const scrolled = -rect.top; // how far past the container top
      const range = scrollEl.offsetHeight - window.innerHeight;
      const progress =
        range > 0 ? Math.min(1, Math.max(0, scrolled / range)) : 0;

      const p = tpRef.current;

      st.nightIdx = Math.min(
        data.length - 1,
        Math.floor(progress * data.length),
      );

      /* 2. Get avatar target position (canvas coords) */
      const pos = canvasRef.current?.getNightPosition(st.nightIdx);
      const geo = canvasRef.current?.getGeometry();
      if (pos && geo) {
        st.targetX = pos.x + p.avatarOffX;
        st.targetY = pos.y + p.avatarOffY;
        if (!st.init) {
          st.curX = st.targetX;
          st.curY = st.targetY;
          st.init = true;
        }
      }

      /* 3. Avatar position — snap directly to night position. */
      st.curX = st.targetX;
      st.curY = st.targetY;

      /* 4. Camera scrollY — deadzone model */
      if (geo) {
        const viewH = window.innerHeight - p.cameraViewH;
        const maxScrollY = Math.max(0, geo.totalH - viewH);

        const screenY = st.curY - st.scrollY;
        const topLine = viewH * p.deadTop;
        const botLine = viewH * p.deadBot;

        let needScrollY = st.scrollY;
        let urgency = 0;

        if (screenY > botLine) {
          needScrollY = st.curY - botLine;
          urgency = Math.min(1, (screenY - botLine) / (viewH * 0.3));
        } else if (screenY < topLine) {
          needScrollY = st.curY - topLine;
          urgency = Math.min(1, (topLine - screenY) / (viewH * 0.3));
        }

        needScrollY = Math.max(0, Math.min(needScrollY, maxScrollY));
        const camLerp = lerp(p.camLerpSlow, p.camLerpFast, urgency);
        st.scrollY = lerp(st.scrollY, needScrollY, urgency > 0 ? camLerp : 0);

        /* 4b. Track scroll — only update when enabled */
        if (p.trackScrollEnabled) {
          const camDelayFrac = p.camDelay / 100;
          if (progress <= camDelayFrac) {
            st.trackScrollY = 0;
          } else if (progress < 0.53) {
            const ramp = Math.min(1, (progress - camDelayFrac) / 0.05);
            const trackLerp = lerp(p.camLerpSlow, p.camLerpFast, ramp);
            st.trackScrollY = lerp(st.trackScrollY, st.scrollY, trackLerp);
          }
          st.trackScrollY = Math.max(0, Math.min(st.trackScrollY, maxScrollY));

          if (trackInnerRef.current) {
            trackInnerRef.current.style.transform = `translate3d(0, ${-st.trackScrollY}px, 0)`;
          }
        }
      }

      /* 5. Avatar — canvas coords + padding offset (parent transform handles camera) */
      if (avatarRef.current) {
        const padTop = canvasRef.current?.getContainerElement()?.offsetTop || 0;
        avatarRef.current.style.left = `${st.curX}px`;
        avatarRef.current.style.top = `${padTop + st.curY}px`;
      }

      /* 6. Throttled HUD */
      if (now - lastHud > 100) {
        lastHud = now;
        setHudNight(st.nightIdx);
        setHudPhase(
          getDisplayPhase(
            data[st.nightIdx]?.phase || "Pre-pregnancy",
            st.nightIdx,
          ),
        );
        setIsEnd(st.nightIdx >= data.length - 5);
        setDebugScroll(Math.round(progress * 100));
        setFullViewport(progress >= 0.18);

        let found = null,
          fState = "hidden",
          pxProgress = 0;
        for (const c of allCallouts) {
          const d = st.nightIdx - c.nightIndex;
          if (d >= 0 && d < p.calloutWindow) {
            found = c;
            pxProgress = d / p.calloutWindow;
            fState = pxProgress > 0.85 ? "exiting" : "visible";
            break;
          }
        }
        setActiveCallout(found);
        setCalloutState(found ? fState : "hidden");
        setCalloutParallax(pxProgress);

        // Compute callout position in canvas coords + padding offset
        if (found) {
          const cPos = canvasRef.current?.getNightPosition(found.nightIndex);
          const padTop =
            canvasRef.current?.getContainerElement()?.offsetTop || 0;
          if (cPos) setCalloutScreenPos({ x: cPos.x, y: padTop + cPos.y });
        } else {
          setCalloutScreenPos(null);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [data, allCallouts]);
  const geo = canvasRef.current?.getGeometry();
  const trackCenterX = geo ? (geo.xLeft + geo.xRight) / 2 : 0;
  const calloutOnLeft = calloutScreenPos
    ? calloutScreenPos.x < trackCenterX
    : false;
  const currentPhaseIdx = phaseOrder.indexOf(hudPhase);

  if (mobile) return <MobileStub />;

  return (
    <div className="arcade-page">
      {!started && (
        <div
          className="arcade-loading"
          ref={(el) => el?.focus()}
          onClick={() => data && setStarted(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && data) setStarted(true);
          }}
          tabIndex={0}
          style={{ cursor: data ? "pointer" : "default", outline: "none" }}
        >
          <p
            style={{
              fontSize: "18px",
              color: "#2af5d6",
              marginBottom: 8,
              textShadow: "0 0 16px rgba(42,245,214,0.4)",
              letterSpacing: "0.2em",
            }}
          >
            MOM'S PACE
          </p>
          <div style={{ marginBottom: 32 }}>
            <PixelAvatar phase="Pre-pregnancy" scale={2} animate />
          </div>
          <p
            style={{
              fontSize: "9px",
              color: "#8b88a8",
              maxWidth: 480,
              textAlign: "center",
              lineHeight: 2.2,
              marginBottom: 32,
              textShadow: "none",
            }}
          >
            HI, I'M KATYA. THIS PROJECT EXPLORES MY SLEEP DATA
            <br />
            ACROSS YEARS OF MOTHERHOOD — TWO PREGNANCIES,
            <br />
            TWO BABIES, AND HOW IT ALL CHANGED MY NIGHTS.
          </p>
          <p>INSERT COIN</p>
          <p
            style={{
              fontSize: "8px",
              marginTop: "24px",
              color: data ? "#2af5d6" : "#8b88a8",
              animation: data ? "blink 1s step-end infinite" : "none",
            }}
          >
            {data ? "PRESS ENTER" : "loading sleep data..."}
          </p>
        </div>
      )}

      {data && started && (
        <>
          {/* ── HUD ─────────────────────────────────────────── */}
          <div className="arcade-hud">
            <span className="arcade-hud__title">
              SLEEP RACE<span style={{ color: "#8b88a8" }}>:</span>MOM'S PACE
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div className="arcade-phases">
                {phaseOrder.map((p, i) => (
                  <div
                    key={p}
                    className={`arcade-phases__seg ${i <= currentPhaseIdx ? "arcade-phases__seg--active" : ""}`}
                    style={{ backgroundColor: phaseColors[p] }}
                  />
                ))}
              </div>
              <span
                className="arcade-hud__phase"
                style={{ color: phaseColors[hudPhase] }}
              >
                {hudPhase.toUpperCase()}
              </span>
            </div>
            <span className="arcade-hud__counter">
              NIGHT {String(hudNight + 1).padStart(4, "0")}/
              {String(data.length).padStart(4, "0")}
            </span>
          </div>

          {/* ── Scroll container: tall div that drives progress ── */}
          <div
            ref={scrollRef}
            style={{ height: `${tp.scrollVh * 100}vh`, position: "relative" }}
          >
            {/* Camera view: fixed 100vh viewport, never moves */}
            <div
              className="arcade-camera"
              style={{
                position: "sticky",
                top: 0,
                // height: '100vh',
                overflow: "hidden",
              }}
            >
              {/* Inner: track + avatar + callouts move together */}
              <div
                ref={trackInnerRef}
                style={{
                  width: "80%",
                  maxWidth: 1400,
                  margin: "0 auto",
                  paddingTop: "40vh",
                  position: "relative",
                  willChange: "transform",
                }}
              >
                <RacetrackCanvas
                  ref={canvasRef}
                  data={data}
                  onHoverNight={setHoverInfo}
                />

                {/* ── Legend ─────────────────────────────────── */}
                <div className="arcade-legend">
                  <div className="arcade-legend__row">
                    <svg width="28" height="12" aria-hidden>
                      <line x1="0" y1="6" x2="28" y2="6" stroke="var(--arcade-text)" strokeWidth="2" />
                    </svg>
                    <span>1 LINE = 1 NIGHT</span>
                  </div>
                  <div className="arcade-legend__row">
                    <svg width="28" height="12" aria-hidden>
                      <line x1="0" y1="2" x2="0" y2="10" stroke="var(--arcade-text)" strokeWidth="2" />
                      <line x1="28" y1="2" x2="28" y2="10" stroke="var(--arcade-text)" strokeWidth="2" />
                      <line x1="0" y1="6" x2="28" y2="6" stroke="var(--arcade-text)" strokeWidth="2" strokeDasharray="1 3" />
                    </svg>
                    <span>HEIGHT = TOTAL SLEEP</span>
                  </div>
                  <div className="arcade-legend__row">
                    <svg width="28" height="12" aria-hidden>
                      <line x1="0" y1="6" x2="10" y2="6" stroke="var(--arcade-text)" strokeWidth="2" />
                      <line x1="18" y1="6" x2="28" y2="6" stroke="var(--arcade-text)" strokeWidth="2" />
                    </svg>
                    <span>GAP = AWAKENING</span>
                  </div>
                </div>

                {/* Avatar — inside track container, uses canvas coords */}
                <div
                  ref={avatarRef}
                  className="arcade-avatar"
                  style={{ left: 0, top: 0 }}
                >
                  <div className="arcade-avatar__bounce">
                    <PixelAvatar
                      phase={hudPhase}
                      scale={tp.avatarScale}
                      animate
                    />
                  </div>
                </div>

                {/* Callout — inside track container, uses canvas coords */}
                {activeCallout &&
                  calloutScreenPos &&
                  (() => {
                    const parallaxY = calloutParallax * -30;
                    const side = calloutOnLeft ? "left" : "right";
                    const wrapperW = trackInnerRef.current?.clientWidth || 800;
                    const leftEdge = geo ? geo.xLeft : 200;
                    const rightEdge = geo ? geo.xRight : wrapperW - 200;
                    const xPos = calloutOnLeft
                      ? Math.max(-280, leftEdge - 300)
                      : Math.min(rightEdge + 30, wrapperW + 20);

                    return (
                      <div
                        className={`arcade-callout arcade-callout--${side} ${calloutState === "visible" ? "arcade-callout--visible" : calloutState === "exiting" ? "arcade-callout--exiting" : ""}`}
                        style={{
                          left: xPos,
                          top: calloutScreenPos.y + 100,
                          "--parallax-y": `${parallaxY}px`,
                        }}
                      >
                        <div className="arcade-callout__label">
                          {activeCallout.label}
                        </div>
                        <div>{activeCallout.text}</div>
                      </div>
                    );
                  })()}
              </div>
            </div>
          </div>

          {/* Tooltip */}
          {hoverInfo && (
            <div
              className="arcade-tooltip"
              style={{
                position: "fixed",
                left: hoverInfo.screenX,
                top: hoverInfo.screenY - 12,
                transform: "translate(-50%, -100%)",
                zIndex: 200,
              }}
            >
              <div className="arcade-tooltip__date">
                {formatDate(hoverInfo.night.night_date)}
              </div>
              <div
                className="arcade-tooltip__phase"
                style={{ color: phaseColors[hoverInfo.night.phase] }}
              >
                {hoverInfo.night.phase}
              </div>
              <div className="arcade-tooltip__stat">
                SLEEP: {hoverInfo.night.sleep_hours.toFixed(1)}H
              </div>
              <div
                style={{ color: "#8b88a8", fontSize: "6px", marginTop: "2px" }}
              >
                {hoverInfo.night.segments.length} SEGMENT
                {hoverInfo.night.segments.length !== 1 ? "S" : ""}
                {hoverInfo.night.segments.map((seg, i) => (
                  <span key={i} style={{ display: "block", color: "#e8e6f0" }}>
                    {formatHour(seg.s)} - {formatHour(seg.e)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* End screen */}
          {isEnd &&
            (() => {
              const totalH = data.reduce((s, n) => s + n.sleep_hours, 0);
              const avgH = totalH / data.length;
              const totalAwakenings = data.reduce(
                (s, n) => s + Math.max(0, n.segments.length - 1),
                0,
              );
              const longestNight = Math.max(...data.map((n) => n.sleep_hours));
              const shortestNight = Math.min(
                ...data
                  .filter((n) => n.sleep_hours > 0)
                  .map((n) => n.sleep_hours),
              );

              return (
                <div
                  style={{
                    position: "fixed",
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    fontFamily: "'Press Start 2P', monospace",
                    background: "rgba(15, 14, 23, 0.92)",
                    zIndex: 50,
                    gap: 0,
                  }}
                >
                  <p
                    style={{
                      color: "#2af5d6",
                      fontSize: "14px",
                      textShadow: "0 0 12px rgba(42,245,214,0.4)",
                    }}
                  >
                    STILL RUNNING
                  </p>
                  <p
                    style={{
                      color: "#8b88a8",
                      fontSize: "7px",
                      marginTop: "12px",
                      lineHeight: "2.2",
                    }}
                  >
                    {data.length.toLocaleString()} nights and counting
                  </p>

                  {/* Quick Stats */}
                  <div
                    style={{
                      display: "flex",
                      gap: 32,
                      marginTop: 36,
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}
                  >
                    {[
                      { label: "AVG SLEEP", value: `${avgH.toFixed(1)}H` },
                      {
                        label: "TOTAL HOURS",
                        value: Math.round(totalH).toLocaleString(),
                      },
                      {
                        label: "AWAKENINGS",
                        value: totalAwakenings.toLocaleString(),
                      },
                      {
                        label: "LONGEST NIGHT",
                        value: `${longestNight.toFixed(1)}H`,
                      },
                      {
                        label: "SHORTEST NIGHT",
                        value: `${shortestNight.toFixed(1)}H`,
                      },
                    ].map((stat) => (
                      <div key={stat.label} style={{ textAlign: "center" }}>
                        <div style={{ color: "#ffd642", fontSize: "12px" }}>
                          {stat.value}
                        </div>
                        <div
                          style={{
                            color: "#8b88a8",
                            fontSize: "6px",
                            marginTop: 6,
                            letterSpacing: "0.1em",
                          }}
                        >
                          {stat.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Dedication */}
                  <p
                    style={{
                      color: "#ffb347",
                      fontSize: "12px",
                      marginTop: 80,
                      lineHeight: 2.2,
                      textAlign: "center",
                      textShadow: "0 0 10px rgba(255,179,71,0.3)",
                    }}
                  >
                    DEDICATED TO ALL MOMS. YOU ARE AMAZING!
                  </p>

                  {/* Social links */}
                  <div
                    style={{
                      display: "flex",
                      gap: 24,
                      marginTop: 164,
                      paddingBottom: 32,
                    }}
                  >
                    <a
                      href="https://www.linkedin.com/in/ekaterinablagireva/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#8b88a8",
                        fontSize: "7px",
                        textDecoration: "none",
                        borderBottom: "1px solid #8b88a8",
                        paddingBottom: 2,
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.color = "#2af5d6")}
                      onMouseLeave={(e) => (e.target.style.color = "#8b88a8")}
                    >
                      LINKEDIN
                    </a>
                    <a
                      href="https://www.behance.net/katerinabl5311"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        color: "#8b88a8",
                        fontSize: "7px",
                        textDecoration: "none",
                        borderBottom: "1px solid #8b88a8",
                        paddingBottom: 2,
                        transition: "color 0.2s",
                      }}
                      onMouseEnter={(e) => (e.target.style.color = "#2af5d6")}
                      onMouseLeave={(e) => (e.target.style.color = "#8b88a8")}
                    >
                      BEHANCE
                    </a>
                  </div>
                </div>
              );
            })()}
        </>
      )}
    </div>
  );
}
