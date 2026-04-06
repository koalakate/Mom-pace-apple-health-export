import { useState, useEffect } from 'react';
import ScrollySection from './components/ScrollySection';
import theme from './styles/theme';
import useSleepData from './hooks/useSleepData';
import useIsMobile from './hooks/useIsMobile';
import MobileStub from './components/MobileStub';
import Racetrack from './components/Racetrack';
import StackedDots from './components/archive/Treemap_v3_stackeddots';
import TangentKnit from './components/Treemap';

const { phases } = theme.colors;

function App() {
  const { data, loading } = useSleepData();
  const [scrolled, setScrolled] = useState(false);
  const mobile = useIsMobile();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 80);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (mobile) return <MobileStub />;

  return (
    <main>
      <header style={{ ...styles.header, ...(scrolled ? styles.headerScrolled : {}) }}>
        <h1 style={{ ...styles.title, ...(scrolled ? styles.titleScrolled : {}) }}>
          Motherhood & Sleep
        </h1>
        {!scrolled && (
          <p style={styles.subtitle}>
            A data story about how becoming a mother reshapes the rhythm of rest
          </p>
        )}
      </header>

      {/* Spacer to offset the sticky header */}
      <div style={{ height: scrolled ? 60 : 0 }} />

      <ScrollySection
        phaseColor={phases.prePregnancy}
        text={
          <>
            <h2 style={styles.heading}>Before</h2>
            <p>
              Before pregnancy, sleep followed a steady, predictable pattern.
              The watch captured nights of deep rest and quiet regularity.
            </p>
          </>
        }
      />

      <ScrollySection
        phaseColor={phases.pregnancy}
        text={
          <>
            <h2 style={styles.heading}>During</h2>
            <p>
              Pregnancy brought gradual shifts — lighter sleep, more
              interruptions, a body slowly adapting to what was coming.
            </p>
          </>
        }
      />

      <ScrollySection
        phaseColor={phases.postpartum}
        text={
          <>
            <h2 style={styles.heading}>After</h2>
            <p>
              Postpartum sleep shattered into fragments. The data tells the
              story of nights shaped by a newborn's needs.
            </p>
          </>
        }
      />

      {/* ── Exploration: Stacked Dots ─────────────────────── */}
      <ScrollySection
        phaseColor={null}
        text={
          <>
            <h2 style={styles.heading}>3 · Stacked Dots</h2>
            <p>
              Every night is a column of dots. Sleep hours stack
              upward — green for restful, red for poor. Below the
              line, dark dots count awake minutes and awakenings.
            </p>
          </>
        }
      >
        {!loading && data && <StackedDots data={data} />}
      </ScrollySection>

      {/* ── Exploration: Venn Diagram ─────────────────────── */}
      <ScrollySection
        phaseColor={null}
        text={
          <>
            <h2 style={styles.heading}>6 · Patterned Venn</h2>
            <p>
              Each cell is one week. Two circles in the same
              unit — minutes. Dots = sleep time, lines = awake
              time. The overlap is the ratio of awake to sleep.
              Bad weeks: circles merge. Good weeks: barely touch.
            </p>
          </>
        }
      >
        {!loading && data && <TangentKnit data={data} />}
      </ScrollySection>

      {/* ── Racetrack (existing) ─────────────────────────── */}
      <ScrollySection
        phaseColor={null}
        text={
          <>
            <h2 style={styles.heading}>The Racetrack</h2>
            <p>
              Every night of sleep, laid out as a strip of segments — just like
              on the watch. 1,652 nights flow in lanes that curve back at the
              edges. Solid blocks are unbroken sleep. Gaps are awakenings.
            </p>
          </>
        }
      >
        <Racetrack />
      </ScrollySection>
    </main>
  );
}

const styles = {
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: '2rem',
    background: theme.colors.background,
    transition: 'padding 0.3s ease, box-shadow 0.3s ease',
  },
  headerScrolled: {
    padding: '0.75rem 2rem',
    boxShadow: '0 1px 8px rgba(0,0,0,0.08)',
  },
  title: {
    fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
    fontWeight: 300,
    letterSpacing: '-0.02em',
    margin: 0,
    color: theme.colors.text,
    transition: 'font-size 0.3s ease',
  },
  titleScrolled: {
    fontSize: '1.25rem',
    fontWeight: 400,
  },
  subtitle: {
    fontSize: 'clamp(1rem, 2vw, 1.25rem)',
    color: theme.colors.textMuted,
    marginTop: '1rem',
    maxWidth: '36ch',
    lineHeight: 1.6,
  },
  heading: {
    fontSize: '1.5rem',
    fontWeight: 500,
    marginTop: 0,
    marginBottom: '0.75rem',
  },
};

export default App;
