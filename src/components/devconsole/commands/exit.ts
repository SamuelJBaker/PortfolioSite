import { register } from "../registry";

register({
  name: "exit",
  aliases: ["quit", "close"],
  summary: "Closes the console",
  run: (_args, ctx) => ctx.close(),
});
