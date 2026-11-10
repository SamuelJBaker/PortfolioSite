"use client";

import * as React from "react";
import { profile } from "../../content/profile";
import { BUILD_SHA } from "./sjbApi";
import { consoleTheme } from "./theme";

// Once per page load. StrictMode runs effects twice in dev, so this is a
// module-level flag rather than a ref.
let greeted = false;

const HOST = new URL(profile.siteUrl).host;

/** ASCII only; the box is 50 columns wide. */
export function greetingText(): string {
  const inner = `  SJB ENGINE            //      ${HOST}  `;
  const rule = `+${"-".repeat(inner.length)}+`;
  return [
    rule,
    `|${inner}|`,
    rule,
    "You opened DevTools. You are my kind of visitor.",
    "Press ` (backtick) on the page, or run sjb.open().",
    `Source: ${profile.github}`,
    "Hiring? Run sjb.hire().",
  ].join("\n");
}

export function buildLine(): string {
  return `build ${BUILD_SHA} | Next.js ${process.env.NEXT_PUBLIC_NEXT_MAJOR ?? "15"} | three r${process.env.NEXT_PUBLIC_THREE_REVISION ?? "?"}`;
}

/**
 * One styled console.log and one console.info on first client load, for
 * whoever opens DevTools. Renders nothing. Only widely supported %c
 * properties, so unstyled consoles still get readable plain text.
 */
export function DevtoolsGreeting() {
  React.useEffect(() => {
    if (greeted) return;
    greeted = true;
    const style = [
      `color: ${consoleTheme.text}`,
      `background: ${consoleTheme.panelHex}`,
      "font-family: ui-monospace, SFMono-Regular, Menlo, monospace",
      "font-size: 12px",
      "font-weight: 500",
      "padding: 8px 12px",
      "border-radius: 4px",
    ].join("; ");
    console.log(`%c${greetingText()}`, style);
    console.info(buildLine());
  }, []);

  return null;
}
