const KEY = 'beataddicts.studio_seconds';
const TICK_MS = 15_000;

// Real, measured time the app has been open and visible in this browser —
// replaces a previously hardcoded "42h Studio Time" Dashboard stat with an
// honest (if modest-sounding) number. Accumulates in localStorage every
// TICK_MS while the tab is visible; not tracked while backgrounded/hidden.
export const getStudioSeconds = (): number => {
  try {
    const raw = localStorage.getItem(KEY);
    const value = raw ? parseInt(raw, 10) : 0;
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
};

const addStudioSeconds = (delta: number) => {
  try {
    localStorage.setItem(KEY, String(getStudioSeconds() + delta));
  } catch {
    // localStorage unavailable -- tracking silently no-ops.
  }
};

export const formatStudioTime = (totalSeconds: number): string => {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m`;
  return '<1m';
};

// Call once, near the app root. Returns a cleanup function.
export const startStudioTimeTracking = (): (() => void) => {
  const interval = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      addStudioSeconds(TICK_MS / 1000);
    }
  }, TICK_MS);
  return () => window.clearInterval(interval);
};
