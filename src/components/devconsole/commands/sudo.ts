import { register } from "../registry";

register({
  name: "sudo",
  summary: "Asks nicely",
  hidden: true,
  run: (args, ctx) => {
    ctx.print(`sudo: permission denied${args.length ? ` for "${args.join(" ")}"` : ""}. This incident will not be reported.`);
  },
});
