import { register } from "../registry";

register({
  name: "history",
  summary: "Prints command history",
  run: (_args, ctx) => {
    if (ctx.history.length === 0) {
      ctx.print("No history yet.", "sys");
      return;
    }
    const width = String(ctx.history.length).length;
    ctx.history.forEach((line, i) => ctx.print(`${String(i + 1).padStart(width)}  ${line}`));
  },
});
