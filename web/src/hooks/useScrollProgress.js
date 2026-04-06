import { useState, useEffect, useCallback } from 'react';

export default function useScrollProgress(ref, { threshold = 0.1 } = {}) {
  const [progress, setProgress] = useState(0);

  const handleScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const windowHeight = window.innerHeight;

    // 0 when section top enters viewport bottom, 1 when section top reaches viewport top
    const raw = 1 - rect.top / windowHeight;
    setProgress(Math.min(1, Math.max(0, raw)));
  }, [ref]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let listening = false;

    const startListening = () => {
      if (!listening) {
        window.addEventListener('scroll', handleScroll, { passive: true });
        listening = true;
        handleScroll();
      }
    };

    const stopListening = () => {
      if (listening) {
        window.removeEventListener('scroll', handleScroll);
        listening = false;
      }
    };

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          startListening();
        } else {
          stopListening();
        }
      },
      { threshold, rootMargin: '100px 0px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      stopListening();
    };
  }, [ref, threshold, handleScroll]);

  return progress;
}
