import { seedFromArg } from "../dice";
import { register } from "../registry";

register({
  name: "seed",
  summary: "Sets or clears the dice seed; alone, prints it",
  usage: "seed [n|off]",
  run: ([arg], ctx) => {
    if (arg === undefined) {
      const seed = ctx.getSeed();
      ctx.print(`seed: ${seed === null ? "off" : seed}`);
      return;
    }
    if (arg.toLowerCase() === "off") {
      ctx.setSeed(null);
      ctx.print("seed: off (crypto)", "sys");
      return;
    }
    const seed = seedFromArg(arg);
    ctx.setSeed(seed);
    ctx.print(`seed: ${seed}${/^-?\d+$/.test(arg) ? "" : ` (hash of "${arg}")`}`, "sys");
  },
  complete: () => ["off"],
});
