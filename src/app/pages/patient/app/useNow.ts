import { useEffect, useState } from 'react';
import { ONE_MINUTE_MS } from './patientFormat';

/** The current time, refreshed every minute, so relative labels ("hace 5 min") stay true. */
export function useNow(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date());
    }, ONE_MINUTE_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return now;
}
