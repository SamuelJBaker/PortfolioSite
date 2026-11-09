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
    slug: "lalto",
    title: "LALTO: Inverse Rendering for Artistic Parameter Recovery",
    timeframe: "Jun 2026 to Present",
    location: "UVA capstone",
    tags: ["Inverse Rendering", "Path Tracing", "PyTorch", "Differentiable Rendering", "Identifiability"],
    highlights: [
      "Built an end-to-end inverse-rendering system recovering a 9-parameter artistic vector from a single rendered image: OpenGL compute path tracer as forward model, a 33,031-render labeled corpus with hash-stamped provenance, and a multi-head ResNet-18 regressor.",
      "Ported the renderer's post-process chain to a differentiable PyTorch model matching the C++/GLSL original within one 8-bit code value, then added per-image gradient refinement against the exact forward model.",
      "Replaced the predictor (2 of 8 pre-registered thresholds) with per-image inversion under L-BFGS continuation with restarts: 8 of 8 thresholds, mean error cut 62 percent, re-render LPIPS 1.4e-5; recovered vectors re-render on unseen geometry under threshold in every tested pair.",
    ],
    note: "Capstone report available on request; repo public after the final read.",
    featured: true,
  },
  {
    slug: "tommy",
    title: "Tommy: Multi-Modal Quant Research",
    timeframe: "Feb 2026 to Jun 2026",
    location: "Charlottesville, VA",
    tags: ["Time Series", "NLP", "RAG", "PyTorch", "Validation"],
    highlights: [
      "Built a point-in-time financial research pipeline in Python/PyTorch over CRSP, Compustat, IBES, OptionMetrics, EDGAR, and FRED, integrating structured and unstructured data across 66 tickers and 489 filings.",
      "Implemented signal and forecasting models spanning HAR-LSTM-GARCH volatility prediction, FinBERT + FAISS RAG filing analysis, TFT-GNN multi-horizon return forecasting, and hierarchical VAE regime detection.",
      "Ran a pre-registered validation protocol (purged expanding-window CV, deflated Sharpe, PBO); ablations isolated entropy-conditioned position sizing at +0.12 Sharpe (95% CI [-0.01, +0.25]) and found its confidence signal uncalibrated.",
    ],
    featured: true,
  },
  {
    slug: "ecs-engine",
    title: "ECSEngine: C++20 Game Engine and GPU Path Tracer",
    timeframe: "Jun 2025 to Present",
    location: "Charlottesville, VA",
    tags: ["C++20", "ECS", "OpenGL 4.6", "GLSL", "Performance", "ImGui"],
    highlights: [
      "Built a C++20 entity-component-system engine (SDL3, OpenGL 4.6, ImGui) with in-engine profiling and debug tooling.",
      "Implemented a GPU path tracer in OpenGL compute shaders (GLSL) with A-Trous wavelet denoising, sustaining 40-200 FPS at 1-8 spp on an RTX 4070 laptop GPU.",
      "Redesigned component storage from hash maps to dense arrays, cutting 100k-entity add/remove from 99.8 ms to 11.8 ms (8.5x) and system update from 39.8 ms to 6.93 ms (5.7x).",
    ],
    links: [{ label: "Github repo", href: "https://github.com/samueljbaker/ECSGameEngine", external: true }],
    featured: true,
  },
  {
    slug: "eggs-by-the-dozen",
    title: "Eggs by the Dozen",
    timeframe: "Mar 2024",
    location: "University of Virginia",
    tags: ["Computer Vision", "OpenCV", "Express.js", "Docker"],
    highlights: [
      "Collaborated on a 5-member team to build a Dockerized full-stack parasite-screening app with HTML/CSS/JavaScript, Express.js, and Python/OpenCV, automating McMaster-slide analysis for sheep and goat samples.",
      "Designed a classical CV pipeline (blur, shifted modified-Otsu thresholding, contour and ellipse/shape-color matching) for mobile, low-connectivity use with too little labeled data for CNNs; classified every test sample correctly.",
      "Improved threshold selection from a fixed value to modified Otsu with a translational shift, enabling correct health-condition classification on all test samples while reducing testing cost and turnaround versus the manual McMaster workflow.",
    ],
    links: [{ label: "Read report (PDF)", href: "/papers/EggsByTheDozen.pdf" }],
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
    featured: false,
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
    featured: false,
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
    featured: false,
  },
];
