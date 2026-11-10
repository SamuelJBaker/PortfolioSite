import { DICE_USAGE, NAT1_AFTER_TEXT, NAT1_TEXT, NAT20_TEXT, parseDice, rollDice, uint32FromFloat } from "../dice";
import type { RollResult } from "../dice";
import { BORDER_FLASH_MS, COOLDOWN_TEXT, GLITCH_MS, TIRED_TEXT, runDiceEffects } from "../diceEffects";
import { register } from "../registry";
import type { CommandContext } from "../registry";

const FLICKER_STEPS = 8;
const FLICKER_MS = 400;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Before settling, the total flickers through about 8 random values over 400 ms. */
async function printWithFlicker(result: RollResult, ctx: CommandContext) {
  if (ctx.reducedMotion) {
    ctx.print(result.text);
    return;
  }
  const prefix = result.text.slice(0, result.text.lastIndexOf("= ") + 2);
  const keptCount = result.kept.length;
  const low = keptCount + result.spec.modifier;
  const high = keptCount * result.spec.sides + result.spec.modifier;
  const id = ctx.print(`${prefix}?`);
  for (let i = 0; i < FLICKER_STEPS; i += 1) {
    await sleep(FLICKER_MS / FLICKER_STEPS);
    // Cosmetic only: Math.random, so the seeded sequence stays untouched.
    const fake = low + Math.floor(Math.random() * (high - low + 1));
    ctx.updateLine(id, `${prefix}${fake}`);
  }
  ctx.updateLine(id, result.text);
}

register({
  name: "roll",
  summary: "Rolls dice (default d20)",
  usage: "roll [NdM][+K] [adv|dis]",
  run: async (args, ctx) => {
    const spec = parseDice(args.join(" "));
    if (!spec) {
      ctx.print(DICE_USAGE, "err");
      return;
    }
    const result = rollDice(spec, uint32FromFloat(ctx.rng));
    const outcome = runDiceEffects(result, ctx.effects, ctx.reducedMotion);

    if (outcome.tired) {
      ctx.print(result.text);
      ctx.print(TIRED_TEXT, "sys");
      return;
    }

    await printWithFlicker(result, ctx);

    if (result.natural === "nat20") ctx.print(NAT20_TEXT, "gold");
    if (result.natural === "nat1") {
      ctx.print(NAT1_TEXT, "err");
      if (!outcome.cooldown) {
        await sleep(ctx.reducedMotion ? BORDER_FLASH_MS : GLITCH_MS);
        ctx.print(NAT1_AFTER_TEXT, "sys");
      }
    }
    if (outcome.cooldown) ctx.print(COOLDOWN_TEXT, "sys");
  },
  complete: () => ["adv", "dis", "d20", "2d6", "d100"],
});
