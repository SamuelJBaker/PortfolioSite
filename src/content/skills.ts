export type SkillGroup = { label: string; items: string[] };

export const skills: SkillGroup[] = [
  {
    label: "Languages",
    items: ["C and C++", "Python", "SQL", "Java", "JavaScript and TypeScript", "C#", "Rust"],
  },
  { label: "AI and ML", items: ["PyTorch", "TensorFlow", "OpenCV", "Hugging Face", "Ollama"] },
  { label: "Web and Backend", items: ["Node.js", "Express", "MongoDB"] },
  {
    label: "Systems and Graphics",
    items: ["Linux", "Git", "SDL3", "OpenGL 3.3 and 4.3", "Vulkan 1.3", "DirectX 11"],
  },
];
