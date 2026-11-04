export type SkillGroup = { label: string; items: string[] };

export const skills: SkillGroup[] = [
  {
    label: "Languages",
    items: ["Python", "C++", "SQL", "TypeScript/JavaScript", "Java", "HTML/CSS", "C#", "Rust"],
  },
  {
    label: "ML/AI",
    items: ["PyTorch", "TensorFlow", "MLflow", "FastAPI", "OpenCV", "Hugging Face", "Transformers", "FAISS"],
  },
  {
    label: "Data/Backend",
    items: [
      "Node.js",
      "Express",
      "REST APIs",
      "MongoDB",
      "PostgreSQL",
      "SQLite",
      "AWS S3",
      "React",
      "Next.js",
      "Tailwind CSS",
    ],
  },
  {
    label: "Systems",
    items: ["Linux", "Git", "CUDA", "OpenGL 4.6", "Docker", "GPU compute", "SDL3", "ImGui"],
  },
];
