/**
 * Lets code outside the trigger (five-tap, ?console, window.sjb.open) open the
 * console. A request made before the trigger mounts is kept and honoured on mount.
 */
let opener: (() => void) | null = null;
let pending = false;

export function setConsoleOpener(fn: (() => void) | null): void {
  opener = fn;
  if (fn && pending) {
    pending = false;
    fn();
  }
}

export function requestConsoleOpen(): void {
  if (opener) opener();
  else pending = true;
}
