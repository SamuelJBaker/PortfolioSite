export type Link = { label: string; href: string; external?: boolean };

export type Project = {
  slug: string;
  title: string;
  timeframe: string;
  location?: string;
  tags: string[];
  highlights: string[];
  links?: Link[];
  note?: string;
  /** Featured projects render as cards; the rest go under "Earlier work". */
  featured: boolean;
};

export const projects: Project[] = [
  {
    slug: "regime-volatility",
    title: "Regime-Aware Volatility Forecasting (S&P 500) from EDGAR + Earnings Calls",
    timeframe: "Feb 2026 to Present",
    location: "Charlottesville, VA",
    tags: ["Time Series", "NLP", "Temporal Fusion Transformer", "Regime Switching", "EDGAR", "Earnings Calls"],
    highlights: [
      "Forecasting next-day realized volatility (risk, not returns) from open-licensed daily S&P 500 OHLC history (1927-2020), using OHLC-derived targets and robust lagged baselines.",
      "Ingesting and timestamp-aligning all major EDGAR filings (including 8-K for higher-frequency events) and earnings call transcripts; emphasizing domain-specific, context-aware sentiment/aspect signals over generic polarity.",
      "Training a regime-aware Temporal Fusion Transformer-style forecaster (regime indicators / mixture-of-experts) and benchmarking against HAR-RV and price-only baselines, with attribution back to specific disclosures and event windows.",
    ],
    links: [
      {
        label: "Dataset (Kaggle)",
        href: "https://www.kaggle.com/datasets/henryhan117/sp-500-historical-data",
        external: true,
      },
    ],
    note: "Repo stays private until there is a proposal + baseline results (or an MVP).",
    featured: true,
  },
  {
    slug: "ecs-engine",
    title: "Entity Component System Game Engine",
    timeframe: "Jun 2025 to Present",
    location: "Charlottesville, VA",
    tags: ["C++", "ECS", "Performance", "Tools", "OpenGL", "ImGui"],
    highlights: [
      "Developed a C++20 ECS game engine using SDL3 and OpenGL with an ImGui editor, asset pipeline and profiling tools.",
      "Implemented a real-time GPU path tracer via OpenGL compute shaders (progressive accumulation and A-Trous denoising), achieving 200-40 FPS at 1-8 samples per pixel on an RTX 4070 laptop GPU.",
      "Redesigned component storage from hash maps to dense arrays, reducing 100k entity add/remove operations from 99.8ms to 11.8ms (~88% reduction, 8.5x faster); and system-update time from 39.8ms to 6.93ms (~83% reduction, 5.7x faster); scaled to multi-million polygon scenes with ~27.8 ns component lookup.",
    ],
    links: [{ label: "Github repo", href: "https://github.com/ArousingCarrot/ECSGameEngine", external: true }],
    note: "Public repo. WIP; happy to walk through architecture and performance optimizations in detail on request.",
    featured: true,
  },
  {
    slug: "ai-infrastructure-lab",
    title: "Self-Hosted AI Infrastructure Lab",
    timeframe: "Jun 2025 to Present",
    location: "Charlottesville, VA",
    tags: ["Python", "Hugging Face", "Ollama", "Linux", "Systems"],
    highlights: [
      "Built and operate a self-hosted homelab for local LLM inference and multiplayer game services, prioritizing privacy, transparency, and control over third-party cloud platforms.",
      "Implemented secure remote access over SSH and designed architecture for decentralized self-hosted services, with expansion paths for mesh VPN and DNS-layer filtering.",
      "Developed a custom UI for tokenization and model interaction to accelerate local inference, fine-tuning, and iterative model testing.",
    ],
    featured: true,
  },
  {
    slug: "eggs-by-the-dozen",
    title: "Eggs by the Dozen",
    timeframe: "Apr 2024",
    location: "University of Virginia",
    tags: ["Computer Vision", "OpenCV", "Express.js", "Docker"],
    highlights: [
      "Collaborated on a 5-member team to build a Dockerized full-stack parasite-screening app with HTML/CSS/JavaScript, Express.js, and Python/OpenCV, automating McMaster-slide analysis for sheep and goat samples.",
      "Designed a feature-based CV pipeline using grayscale blur, thresholding, contour detection, and ellipse/shape-color matching to estimate eggs per gram under iPhone 6 and low-connectivity constraints, avoiding CNNs due to limited labeled data.",
      "Improved threshold selection from a fixed value to modified Otsu with a translational shift, enabling correct health-condition classification on all test samples while reducing testing cost and turnaround versus the manual McMaster workflow.",
    ],
    links: [{ label: "Read report (PDF)", href: "/papers/EggsByTheDozen.pdf" }],
    featured: true,
  },
  {
    slug: "agentic-rpg-arbiter",
    title: "Agentic RPG Arbiter",
    timeframe: "Aug 2025",
    location: "Charlottesville, VA",
    tags: ["LLM", "Agentic Systems", "Game Design", "State"],
    highlights: [
      "Built a chat-driven RPG arbiter that converts player dialogue into persistent state flags and event triggers, enabling branching narrative and adaptive encounters.",
      "Added lightweight memory and session persistence to maintain narrative continuity across multi-turn interactions in a text-adventure game loop.",
      "Prototyped agentic interaction patterns for games, focusing on stateful control flow and dialogue-to-action mapping.",
    ],
    featured: true,
  },
  {
    slug: "mycorrhizal-fungi",
    title: "Mycorrhizal Fungi Inoculation in Soybeans",
    timeframe: "Feb 2023",
    location: "Chesapeake Bay Governor's School Symposium",
    tags: ["Research", "Experiment Design", "Statistics"],
    highlights: [
      "Ran controlled inoculation study on soybeans (n=60, 6 groups, 2 trials) under 70% / 100% / 130% water-holding capacity over 7-8 weeks.",
      "Found significant differences in shoot dry mass (p=0.007-0.023) and chlorophyll (p=0.014-0.032); presented at Chesapeake Bay Governor's School symposium (VCU).",
    ],
    links: [{ label: "Read paper (PDF)", href: "/papers/SeniorProject.pdf" }],
    featured: true,
  },
];
