import { useEffect, useRef, useState } from "react";

/** Smoothly animates a number towards `target` (ease-out cubic). */
export function useTween(target: number, duration = 700): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const current = useRef(target);

  useEffect(() => {
    from.current = current.current;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      current.current = from.current + (target - from.current) * eased;
      setValue(current.current);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}
