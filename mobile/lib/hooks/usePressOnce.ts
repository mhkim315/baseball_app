import { useRef, useCallback } from "react";

export function usePressOnce<T extends (...args: any[]) => any>(
  fn: T,
  cooldown = 500,
): T {
  const lastCall = useRef(0);
  return useCallback(
    (...args: any[]) => {
      const now = Date.now();
      if (now - lastCall.current < cooldown) return;
      lastCall.current = now;
      return fn(...args);
    },
    [fn, cooldown],
  ) as T;
}
