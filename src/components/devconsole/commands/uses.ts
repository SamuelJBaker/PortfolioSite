import { register } from "../registry";

register({
  name: "uses",
  summary: "Opens the /uses page",
  run: (_args, ctx) => {
    ctx.print("-> /uses", "sys");
    ctx.navigate("/uses");
  },
});
