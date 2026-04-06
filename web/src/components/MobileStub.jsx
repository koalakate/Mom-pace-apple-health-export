import PixelAvatar from './PixelAvatar';
import '../styles/arcade-theme.css';

export default function MobileStub() {
  return (
    <div className="arcade-page" style={styles.container}>
      <div style={styles.content}>
        <p style={styles.label}>MOM'S PACE</p>
        <h1 style={styles.title}>MOTHERHOOD &amp; SLEEP</h1>
        <p style={styles.subtitle}>
          A data story about how becoming a mother
          reshapes the rhythm of rest.
        </p>

        <div style={styles.avatar}>
          <div className="arcade-avatar__bounce">
            <PixelAvatar phase="Pre-pregnancy" scale={2.5} animate />
          </div>
        </div>

        <p style={styles.message}>
          This story runs only on desktop.
          <br />
          Please visit on a larger screen.
        </p>
      </div>

      <footer style={styles.footer}>
        <p style={styles.author}>Katia Blagireva</p>
        <div style={styles.links}>
          <a
            href="https://www.linkedin.com/in/ekaterinablagireva/"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            LINKEDIN
          </a>
          <a
            href="https://www.behance.net/katerinabl5311"
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            BEHANCE
          </a>
        </div>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '3rem 2rem 2rem',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  content: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 340,
  },
  label: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '18px',
    color: '#2af5d6',
    textShadow: '0 0 16px rgba(42,245,214,0.4)',
    letterSpacing: '0.2em',
    margin: 0,
  },
  title: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '11px',
    color: '#ffd642',
    textShadow: '0 0 8px rgba(255,214,66,0.4)',
    letterSpacing: '0.1em',
    lineHeight: 2.2,
    marginTop: '12px',
  },
  subtitle: {
    fontFamily: "var(--arcade-mono)",
    fontSize: '11px',
    color: '#8b88a8',
    lineHeight: 2,
    marginTop: '16px',
    maxWidth: '30ch',
  },
  avatar: {
    margin: '3rem 0 2.5rem',
    filter: 'drop-shadow(0 0 10px rgba(42,245,214,0.5))',
  },
  message: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    color: '#e8e6f0',
    lineHeight: 2.4,
  },
  footer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    paddingTop: '2rem',
  },
  author: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    color: '#8b88a8',
    margin: 0,
    letterSpacing: '0.1em',
  },
  links: {
    display: 'flex',
    gap: '12px',
  },
  link: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '7px',
    color: '#8b88a8',
    textDecoration: 'none',
    border: '1.5px solid #3d3b6e',
    borderRadius: 20,
    padding: '8px 16px',
    transition: 'color 0.2s, border-color 0.2s',
  },
};
