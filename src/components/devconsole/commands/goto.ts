import { register } from "../registry";

register({
  name: "goto",
  summary: "Scrolls to a section",
  usage: "goto <section>",
  run: ([id], ctx) => {
    const sections = ctx.sections();
    const key = (id ?? "").toLowerCase();
    if (!sections.includes(key)) {
      ctx.print(`goto: unknown section. Try: ${sections.join(", ")}`, "err");
      return;
    }
    ctx.scrollTo(key);
    ctx.print(`-> #${key}`, "sys");
  },
  complete: (_partial, ctx) => ctx.sections(),
});
