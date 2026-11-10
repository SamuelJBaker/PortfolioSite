export {};

declare global {
  interface Window {
    /** DevTools API installed by the engine console trigger (devconsole/sjbApi.ts). */
    sjb?: {
      /** Opens the engine console; works before its chunk has loaded. */
      open(): void;
      /** Prints the command list to the DevTools console. */
      help(): void;
      /** Same parser, effects and guards as the console's roll; returns the total. */
      roll(expr?: string): number;
      /** Opens a mailto draft. */
      hire(): void;
      /** Build sha, or "dev". */
      version: string;
    };
  }
}
