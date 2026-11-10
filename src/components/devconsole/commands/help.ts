import { list, register, resolve } from "../registry";

register({
  name: "help",
  summary: "Lists commands, or one command's usage",
  usage: "help [cmd]",
  run: ([name], ctx) => {
    if (name) {
      const cmd = resolve(name);
      if (!cmd || cmd.hidden) {
        ctx.print(`No help for ${name}.`, "err");
        return;
      }
      ctx.print(`${cmd.usage ?? cmd.name}  ${cmd.summary}`);
      if (cmd.aliases?.length) ctx.print(`aliases: ${cmd.aliases.join(", ")}`, "sys");
      return;
    }
    const visible = list().filter((c) => !c.hidden);
    const width = Math.max(...visible.map((c) => (c.usage ?? c.name).length));
    for (const cmd of visible) ctx.print(`${(cmd.usage ?? cmd.name).padEnd(width)}  ${cmd.summary}`);
    ctx.print("Tab completes. Up and Down walk history. Escape or exit closes.", "sys");
  },
  complete: () =>
    list()
      .filter((c) => !c.hidden)
      .map((c) => c.name),
});
