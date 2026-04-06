import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

function check() {
  if (typeof window === 'undefined') return false;
  // Use the smallest of innerWidth and screen.width to catch iOS quirks
  const w = Math.min(window.innerWidth, window.screen?.width ?? Infinity);
  if (w <= MOBILE_BREAKPOINT) return true;
  // Touch-only device with coarse pointer (phone/tablet)
  if (window.matchMedia('(pointer: coarse)').matches && w <= MOBILE_BREAKPOINT * 2) {
    return w <= MOBILE_BREAKPOINT;
  }
  return false;
}

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(check);

  useEffect(() => {
    // Re-check on mount (handles SSR hydration mismatch)
    setIsMobile(check());

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const onChange = () => setIsMobile(check());
    mql.addEventListener('change', onChange);
    window.addEventListener('resize', onChange);
    return () => {
      mql.removeEventListener('change', onChange);
      window.removeEventListener('resize', onChange);
    };
  }, []);

  return isMobile;
}
