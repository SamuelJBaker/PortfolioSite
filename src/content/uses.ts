import { projects } from "./projects";
import { skills } from "./skills";

export type UsesItem = { name: string; note?: string; href?: string };
export type UsesSection = { id: string; title: string; items: UsesItem[] };

/** "Name | note" to an item; a bare name has no note. */
const item = (line: string, href?: string): UsesItem => {
  const [name, ...rest] = line.split(" | ");
  return { name: name.trim(), note: rest.length ? rest.join(" | ").trim() : undefined, href };
};

/** Languages and Systems from the Skills section, names only. */
const toolchain: UsesItem[] = skills
  .filter((g) => g.label === "Languages" || g.label === "Systems")
  .flatMap((g) => g.items.map((name) => ({ name })));

/** One line per highlight of the homelab project, no links. */
const homelab: UsesItem[] =
  projects.find((p) => p.slug === "ai-infrastructure-lab")?.highlights.map((name) => ({ name })) ?? [];

const sections: UsesSection[] = [
  {
    id: "hardware",
    title: "Hardware",
    items: [
      item("Dell XPS 15 9530 | 13th Gen Intel Core i9-13900H (14 cores, 20 threads), 32 GB RAM, 1 TB NVMe"),
      item("NVIDIA GeForce RTX 4070 Max-Q, 8 GB | the GPU behind the ECSEngine and LALTO numbers on the home page"),
      item("Built-in 3456x2160 16 inch OLED at 2x"),
    ],
  },
  {
    id: "desktop",
    title: "OS and desktop",
    items: [
      item("Arch Linux | rolling, pacman, btrfs root"),
      item("Hyprland (Wayland) | tiling compositor; custom theme in progress"),
      item("zsh | with a small set of plugins"),
    ],
  },
  {
    id: "editor",
    title: "Editor and terminal",
    items: [
      item("Neovim | primary editor for everything, C++ and Python included"),
      item("kitty | GPU-accelerated terminal"),
      item("Noto Sans Mono 11 pt"),
    ],
  },
  { id: "toolchain", title: "Languages and toolchains", items: toolchain },
  {
    id: "graphics-ml",
    title: "Graphics and ML tools",
    items: [
      item("OpenGL 4.6 and GLSL compute | path tracer and LALTO forward model"),
      item("RenderDoc and Nsight Graphics | frame capture and GPU profiling", "https://renderdoc.org/"),
      item("PyTorch, torch.autograd and L-BFGS | LALTO differentiable grading chain and inversion"),
      item("MLflow | experiment tracking"),
      item("Dear ImGui | engine debug UI"),
    ],
  },
  { id: "homelab", title: "Homelab", items: homelab },
  {
    id: "site",
    title: "This site",
    items: [
      item("Next.js 15", "https://nextjs.org/"),
      item("React Three Fiber", "https://r3f.docs.pmnd.rs/"),
      item("Cloudflare Workers via OpenNext", "https://opennext.js.org/cloudflare"),
      item("D1", "https://developers.cloudflare.com/d1/"),
      item("KV", "https://developers.cloudflare.com/kv/"),
      item("Last.fm", "https://www.last.fm/"),
    ],
  },
].filter((s) => s.items.length >= 2); // a seeded section thinner than two items is left out, not padded

export const uses: { updated: string; intro: string; sections: UsesSection[] } = {
  updated: "2026-11-10",
  intro: "What I work on and with. Updated when it changes.",
  sections,
};
