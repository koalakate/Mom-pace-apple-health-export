import { useState, useEffect } from 'react';
import { enrichNights } from '../utils/sleepDataUtils';

export default function useSleepData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/data/nightly_sleep_processed.json')
      .then((r) => r.json())
      .then((raw) => {
        setData(enrichNights(raw));
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load sleep data:', err);
        setError(err);
        setLoading(false);
      });
  }, []);

  return { data, loading, error };
}
