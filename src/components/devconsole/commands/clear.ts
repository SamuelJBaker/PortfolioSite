import { register } from "../registry";

register({
  name: "clear",
  aliases: ["cls"],
  summary: "Clears scrollback (also Ctrl+L)",
  run: (_args, ctx) => ctx.clear(),
});
