import { useEffect, useState } from 'react';

export const reduceMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** False on the first frame, true after: lets widths and offsets transition from zero. */
export function useGrown(): boolean {
  const [grown, setGrown] = useState(reduceMotion);
  useEffect(() => {
    if (grown) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, [grown]);
  return grown;
}
