import ScrollySection from './components/ScrollySection';
import theme from './styles/theme';

const { phases } = theme.colors;

function App() {
  return (
    <main>
      <header style={styles.header}>
        <h1 style={styles.title}>Motherhood & Sleep</h1>
        <p style={styles.subtitle}>
          A data story about how becoming a mother reshapes the rhythm of rest
        </p>
      </header>

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
    </main>
  );
}

const styles = {
  header: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    padding: '2rem',
  },
  title: {
    fontSize: 'clamp(2.5rem, 6vw, 4.5rem)',
    fontWeight: 300,
    letterSpacing: '-0.02em',
    margin: 0,
    color: theme.colors.text,
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
