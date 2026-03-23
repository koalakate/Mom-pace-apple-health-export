import { useState, useEffect } from 'react';

export default function useScrollProgress(ref, { threshold = 0.1 } = {}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handleScroll = () => {
      const rect = el.getBoundingClientRect();
      const windowHeight = window.innerHeight;

      // 0 when section top enters viewport bottom, 1 when section top reaches viewport top
      const raw = 1 - rect.top / windowHeight;
      setProgress(Math.min(1, Math.max(0, raw)));
    };

    // Use IntersectionObserver to only track scroll when element is near viewport
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          window.addEventListener('scroll', handleScroll, { passive: true });
          handleScroll();
        } else {
          window.removeEventListener('scroll', handleScroll);
        }
      },
      { threshold, rootMargin: '100px 0px' }
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, [ref, threshold]);

  return progress;
}
