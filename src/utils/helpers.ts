/**
 * generateId – deterministic-ish UUID-v4-style id generator.
 * Avoids any external dependency.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * formatTime – convert seconds → "m:ss"
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * generateGradientArt – builds a colorful SVG data-URI from a seed string.
 * Used as a placeholder when a song has no albumArt URL.
 */
export function generateGradientArt(seed: string): string {
  const hash = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) | 0, 0);
  const abs = Math.abs(hash);

  const h1 = abs % 360;
  const h2 = (h1 + 137) % 360;   // golden-angle complement
  const h3 = (h1 + 73)  % 360;

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300">
  <defs>
    <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%"   stop-color="hsl(${h1},70%,30%)"/>
      <stop offset="50%"  stop-color="hsl(${h2},65%,25%)"/>
      <stop offset="100%" stop-color="hsl(${h3},80%,20%)"/>
    </linearGradient>
    <radialGradient id="r" cx="30%" cy="30%" r="70%">
      <stop offset="0%"   stop-color="hsl(${h1},90%,60%)" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="transparent"/>
    </radialGradient>
  </defs>
  <rect width="300" height="300" fill="url(#g)"/>
  <rect width="300" height="300" fill="url(#r)"/>
  <circle cx="150" cy="150" r="60" fill="none"
    stroke="hsl(${h2},90%,70%)" stroke-width="1.5" opacity="0.3"/>
  <circle cx="150" cy="150" r="20" fill="hsl(${h1},80%,60%)" opacity="0.6"/>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * clamp – constrain `value` between [min, max].
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * debounce – delay invoking `fn` until after `wait` ms of inactivity.
 */
export function debounce<T extends (...args: unknown[]) => void>(fn: T, wait: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: unknown[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  }) as T;
}
