import { hireMailtoHref } from "../../../content/profile";
import { register } from "../registry";

register({
  name: "hire",
  summary: "Opens an email draft",
  hidden: true,
  run: (_args, ctx) => {
    ctx.print("Thank you. Opening an email draft; I read every one.");
    ctx.navigate(hireMailtoHref);
  },
});
