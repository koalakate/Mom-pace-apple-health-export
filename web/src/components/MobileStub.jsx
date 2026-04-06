import { useState, useEffect } from 'react';
import PixelAvatar from './PixelAvatar';
import '../styles/arcade-theme.css';

function useViewportHeight() {
  const [vh, setVh] = useState(
    () => typeof window !== 'undefined' ? window.innerHeight : 800
  );
  useEffect(() => {
    const update = () => setVh(window.innerHeight);
    window.addEventListener('resize', update);
    window.visualViewport?.addEventListener('resize', update);
    return () => {
      window.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('resize', update);
    };
  }, []);
  return vh;
}

export default function MobileStub() {
  const vh = useViewportHeight();
  const compact = vh < 660;
  const tiny = vh < 540;

  const avatarScale = tiny ? 1.2 : compact ? 1.6 : 2;
  const avatarMargin = tiny ? '1rem 0 0.75rem' : compact ? '1.5rem 0 1rem' : '2rem 0 1.5rem';
  const padTop = tiny ? '1rem' : compact ? '1.5rem' : '2.5rem';
  const labelSize = tiny ? '14px' : '18px';
  const subtitleSize = tiny ? '10px' : '11px';

  return (
    <div className="arcade-page" style={{
      ...styles.container,
      padding: `${padTop} 2rem 2rem`,
    }}>
      <div style={styles.content}>
        <p style={{ ...styles.label, fontSize: labelSize }}>MOM'S PACE</p>
        <h1 style={styles.title}>MOTHERHOOD &amp; SLEEP</h1>
        {!tiny && (
          <p style={{ ...styles.subtitle, fontSize: subtitleSize }}>
            A data story about how becoming a mother
            reshapes the rhythm of rest.
          </p>
        )}

        <div style={{ ...styles.avatar, margin: avatarMargin }}>
          <div className="arcade-avatar__bounce">
            <PixelAvatar phase="Pre-pregnancy" scale={avatarScale} animate />
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
    height: '100dvh',
    maxHeight: '100dvh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    boxSizing: 'border-box',
    textAlign: 'center',
  },
  content: {
    flex: '1 1 auto',
    minHeight: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 340,
  },
  label: {
    fontFamily: "'Press Start 2P', monospace",
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
    marginTop: '8px',
  },
  subtitle: {
    fontFamily: "var(--arcade-mono)",
    color: '#8b88a8',
    lineHeight: 2,
    marginTop: '10px',
    maxWidth: '30ch',
  },
  avatar: {
    filter: 'drop-shadow(0 0 10px rgba(42,245,214,0.5))',
  },
  message: {
    fontFamily: "'Press Start 2P', monospace",
    fontSize: '8px',
    color: '#e8e6f0',
    lineHeight: 2.2,
  },
  footer: {
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    paddingTop: '0.75rem',
    paddingBottom: '0.5rem',
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
