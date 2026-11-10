import { profile } from "../../../content/profile";
import { register } from "../registry";

/** The lead paragraph up to and including its first full stop. */
export function firstSentence(text: string): string {
  const end = text.indexOf(". ");
  return end < 0 ? text : text.slice(0, end + 1);
}

register({
  name: "whoami",
  summary: "Prints a one-line bio",
  run: (_args, ctx) => {
    ctx.print(`${profile.tagline}. ${firstSentence(profile.bio[0])}`);
  },
});
