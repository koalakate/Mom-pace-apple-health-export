import { useRef } from 'react';
import { motion } from 'framer-motion';
import useScrollProgress from '../hooks/useScrollProgress';
import theme from '../styles/theme';

export default function ScrollySection({ text, phaseColor, children }) {
  const sectionRef = useRef(null);
  const progress = useScrollProgress(sectionRef);
  const isVisible = progress > 0.15;

  return (
    <section ref={sectionRef} style={styles.section}>
      <motion.div
        style={styles.textPanel}
        initial={{ opacity: 0, x: -30 }}
        animate={isVisible ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      >
        {phaseColor && (
          <div style={{ ...styles.phaseBar, backgroundColor: phaseColor }} />
        )}
        <div style={styles.textContent}>{text}</div>
      </motion.div>

      <motion.div
        style={styles.chartPanel}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
      >
        {children || (
          <div style={styles.placeholder}>
            <span style={{ color: theme.colors.textMuted }}>Chart area</span>
          </div>
        )}
      </motion.div>
    </section>
  );
}

const styles = {
  section: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    gap: '3rem',
    padding: '4rem 2rem',
    boxSizing: 'border-box',
  },
  textPanel: {
    flex: '0 0 36%',
    position: 'relative',
  },
  phaseBar: {
    position: 'absolute',
    left: '-1rem',
    top: 0,
    bottom: 0,
    width: 4,
    borderRadius: 2,
  },
  textContent: {
    fontSize: '1.125rem',
    lineHeight: 1.7,
  },
  chartPanel: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 300,
  },
  placeholder: {
    width: '100%',
    height: 300,
    border: '2px dashed #ccc',
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.875rem',
  },
};
