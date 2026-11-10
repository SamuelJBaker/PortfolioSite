"use client";

import * as React from "react";
import { consoleTheme } from "./theme";
import { TELEMETRY_READ_HZ, telemetry, telemetryLines } from "./telemetry";

/**
 * Three-line telemetry panel, bottom right. Polls the telemetry object at
 * 4 Hz; pointer-events none so it never blocks the page. Not aria-live.
 */
export function Hud() {
  const [lines, setLines] = React.useState(() => telemetryLines(telemetry));

  React.useEffect(() => {
    const tick = () => setLines(telemetryLines(telemetry));
    tick();
    const id = window.setInterval(tick, 1000 / TELEMETRY_READ_HZ);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed bottom-4 right-4 z-50 rounded-sm border px-3 py-2 backdrop-blur"
      style={{
        background: consoleTheme.panel,
        borderColor: consoleTheme.border,
        color: consoleTheme.text,
        fontFamily: consoleTheme.fontFamily,
        fontSize: consoleTheme.fontSize,
        lineHeight: 1.5,
      }}
    >
      {lines.map((line, i) => (
        <div key={i} style={{ color: i === 0 ? consoleTheme.accentHex : consoleTheme.text }}>
          {line}
        </div>
      ))}
    </div>
  );
}
