import { profile } from "../../../content/profile";
import { register } from "../registry";

const targets: Record<string, () => string> = {
  resume: () => profile.resumePath,
  github: () => profile.github,
  linkedin: () => profile.linkedin,
  uses: () => "/uses",
  email: () => `mailto:${profile.email}`,
};

register({
  name: "open",
  summary: "Opens resume, github, linkedin, uses, or email",
  usage: "open <target>",
  run: ([target], ctx) => {
    const key = (target ?? "").toLowerCase();
    const href = targets[key]?.();
    if (!href) {
      ctx.print(`open: unknown target. Try: ${Object.keys(targets).join(", ")}`, "err");
      return;
    }
    ctx.print(`opening ${key}: ${href}`, "sys");
    ctx.navigate(href);
  },
  complete: () => Object.keys(targets),
});
