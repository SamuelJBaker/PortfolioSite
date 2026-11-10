import { register } from "../registry";
import { telemetryLines } from "../telemetry";

register({
  name: "stats",
  summary: "Toggles the telemetry HUD and prints a snapshot",
  run: (_args, ctx) => {
    const on = ctx.toggleHud();
    for (const line of telemetryLines(ctx.telemetry)) ctx.print(line);
    ctx.print(`HUD ${on ? "on" : "off"}`, "sys");
  },
});
