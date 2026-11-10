import { register } from "../registry";

register({
  name: "echo",
  summary: "Prints the text",
  usage: "echo <text>",
  run: (args, ctx) => {
    ctx.print(args.join(" "));
  },
});
