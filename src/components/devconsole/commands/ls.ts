import { projects } from "../../../content/projects";
import { register } from "../registry";

register({
  name: "ls",
  summary: "Lists sections and project titles",
  run: (_args, ctx) => {
    ctx.print(`sections: ${ctx.sections().join(", ")}`);
    ctx.print("projects:");
    for (const p of projects) ctx.print(`  ${p.title}${p.featured ? "" : "  (earlier)"}`);
  },
});
