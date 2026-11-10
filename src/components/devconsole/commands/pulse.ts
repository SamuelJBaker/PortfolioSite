import type { InferencePulseMode } from "../../background3d/BackgroundEffectsProvider";
import { register } from "../registry";

const modes: InferencePulseMode[] = ["ai", "system", "neutral"];

register({
  name: "pulse",
  summary: "Fires an inference pulse on the bust",
  usage: "pulse [ai|system|neutral]",
  run: ([arg], ctx) => {
    const mode = (arg ?? "ai").toLowerCase() as InferencePulseMode;
    if (!modes.includes(mode)) {
      ctx.print(`pulse: unknown mode. Try: ${modes.join(", ")}`, "err");
      return;
    }
    ctx.effects.emitEffect({ type: "pulse", options: { mode, intensity: 0.9, durationMs: 900 } });
    ctx.print(`pulse: ${mode}`, "sys");
  },
  complete: () => modes,
});
