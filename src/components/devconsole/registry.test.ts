import { beforeEach, describe, expect, it } from "vitest";
import {
  completeLine,
  parseLine,
  register,
  resetRegistry,
  resolve,
  runLine,
  type CommandContext,
  type ConsoleLine,
} from "./registry";

function makeCtx(lines: ConsoleLine[]): CommandContext {
  return {
    print: (text, kind = "out") => {
      lines.push({ kind, text });
      return lines.length - 1;
    },
    printLink: (text, href) => {
      lines.push({ kind: "out", text, href });
    },
    updateLine: (id, text, kind) => {
      lines[id] = { ...lines[id], text, kind: kind ?? lines[id].kind };
    },
    clear: () => {
      lines.length = 0;
    },
    close: () => {},
    effects: { emitEffect: () => {}, subscribeEffect: () => () => {} },
    telemetry: {
      enabled: false,
      fps: 0,
      frameMs: 0,
      drawCalls: 0,
      triangles: 0,
      points: 0,
      lines: 0,
      geometries: 0,
      textures: 0,
      dpr: 1,
      width: 0,
      height: 0,
      frameloop: "always",
    },
    scrollTo: () => {},
    navigate: () => {},
    rng: () => 0.5,
    setSeed: () => {},
    getSeed: () => null,
    reducedMotion: false,
    history: [],
    sections: () => ["top", "projects"],
    toggleHud: () => false,
  };
}

describe("parseLine", () => {
  it("lowercases the command and splits arguments on whitespace", () => {
    expect(parseLine("  Echo  a   b ")).toEqual({ name: "echo", args: ["a", "b"] });
  });

  it("keeps quoted strings whole without the quotes", () => {
    expect(parseLine('echo "hello world" foo "a  b"')).toEqual({
      name: "echo",
      args: ["hello world", "foo", "a  b"],
    });
  });

  it("keeps argument case", () => {
    expect(parseLine("open GitHub")).toEqual({ name: "open", args: ["GitHub"] });
  });

  it("returns null for a blank line", () => {
    expect(parseLine("")).toBeNull();
    expect(parseLine("   ")).toBeNull();
  });
});

describe("runLine", () => {
  beforeEach(() => resetRegistry());

  it("prints the unknown command message in red", async () => {
    const lines: ConsoleLine[] = [];
    await runLine("foo bar", makeCtx(lines));
    expect(lines).toEqual([{ kind: "err", text: "Unknown command: foo. Type help." }]);
  });

  it("runs a registered command with its parsed arguments", async () => {
    const seen: string[][] = [];
    register({ name: "echo", summary: "", run: (args) => void seen.push(args) });
    const lines: ConsoleLine[] = [];
    await runLine('ECHO "x y" z', makeCtx(lines));
    expect(seen).toEqual([["x y", "z"]]);
    expect(lines).toEqual([]);
  });

  it("resolves aliases", () => {
    register({ name: "clear", aliases: ["cls"], summary: "", run: () => {} });
    expect(resolve("CLS")?.name).toBe("clear");
  });

  it("prints a thrown error in red and does not throw", async () => {
    register({
      name: "boom",
      summary: "",
      run: () => {
        throw new Error("kaput");
      },
    });
    const lines: ConsoleLine[] = [];
    await expect(runLine("boom", makeCtx(lines))).resolves.toBeUndefined();
    expect(lines).toEqual([{ kind: "err", text: "Error: kaput" }]);
  });

  it("does nothing on an empty line", async () => {
    const lines: ConsoleLine[] = [];
    await runLine("   ", makeCtx(lines));
    expect(lines).toEqual([]);
  });
});

describe("completeLine", () => {
  beforeEach(() => resetRegistry());

  it("completes visible command names, then arguments through complete()", () => {
    register({ name: "goto", summary: "", run: () => {}, complete: (_p, ctx) => ctx.sections() });
    register({ name: "git", summary: "", run: () => {} });
    register({ name: "sudo", summary: "", hidden: true, run: () => {} });
    const ctx = makeCtx([]);
    expect(completeLine("g", ctx)).toEqual(["goto", "git"]);
    expect(completeLine("s", ctx)).toEqual([]);
    expect(completeLine("goto p", ctx)).toEqual(["projects"]);
  });
});
