/**
 * Tiny haptic tap for touch devices. No-op when the user prefers reduced
 * motion, on fine-pointer devices, or where the Vibration API is missing.
 */
export function tap(ms = 8) {
  if (typeof window === "undefined") return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  if (!matchMedia("(pointer: coarse)").matches) return;
  try {
    navigator.vibrate?.(ms);
  } catch {}
}
