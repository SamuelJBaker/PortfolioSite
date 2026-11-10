"use client";

import * as React from "react";
import type { EffectBus } from "../background3d/BackgroundEffectsProvider";
import { hireMailtoHref } from "../../content/profile";
import { DICE_USAGE, parseDice, rollDice, uint32FromFloat } from "./dice";
import { runDiceEffects } from "./diceEffects";
import { requestConsoleOpen } from "./opener";

export const BUILD_SHA = process.env.NEXT_PUBLIC_BUILD_SHA ?? "dev";

function cryptoFloat(): number {
  const buf = new Uint32Array(1);
  window.crypto.getRandomValues(buf);
  return buf[0] / 4294967296;
}

export type SjbApi = NonNullable<Window["sjb"]>;

/**
 * Installs window.sjb for DevTools visitors. open() works before the console
 * chunk loads (it goes through opener.ts); roll() uses the console's parser,
 * effects and guards with a crypto source, and returns the total.
 */
export function useSjbApi(effects: EffectBus, reducedMotion: boolean) {
  const reducedMotionRef = React.useRef(reducedMotion);
  reducedMotionRef.current = reducedMotion;

  React.useEffect(() => {
    const api: SjbApi = {
      open: () => requestConsoleOpen(),
      help: () => {
        void import("./commands").then(async () => {
          const { list } = await import("./registry");
          const lines = list()
            .filter((c) => !c.hidden)
            .map((c) => `${(c.usage ?? c.name).padEnd(28)} ${c.summary}`);
          console.log(["sjb engine console commands:", ...lines, "Press ` on the page, or sjb.open()."].join("\n"));
        });
      },
      roll: (expr = "") => {
        const spec = parseDice(expr);
        if (!spec) {
          console.warn(DICE_USAGE);
          return NaN;
        }
        const result = rollDice(spec, uint32FromFloat(cryptoFloat));
        const outcome = runDiceEffects(result, effects, reducedMotionRef.current);
        console.log(outcome.tired ? `${result.text}  (the dice are tired)` : result.text);
        return result.total;
      },
      hire: () => window.location.assign(hireMailtoHref),
      version: BUILD_SHA,
    };
    window.sjb = api;
    return () => {
      if (window.sjb === api) delete window.sjb;
    };
  }, [effects]);
}
