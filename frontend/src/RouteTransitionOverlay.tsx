/**
 * View Transition API bridge.
 *
 * Exported helper used by App.tsx to wrap route location updates in a
 * document.startViewTransition call. Falls back to a direct callback when the
 * API is unavailable or when the user prefers reduced motion.
 *
 * The actual CSS animation lives in index.css under the
 * ::view-transition-* pseudo-elements.
 */

export function startRouteTransition(callback: () => void): void {
  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (
    !reducedMotion &&
    typeof document !== "undefined" &&
    "startViewTransition" in document
  ) {
    (document as Document & { startViewTransition: (cb: () => void) => unknown }).startViewTransition(callback);
  } else {
    callback();
  }
}
