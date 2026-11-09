import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".open-next/**",
      ".wrangler/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "cloudflare-env.d.ts",
    ],
  },
  // Lint baseline: pre-existing violations left in place during phase 0.
  // Downgraded to warnings in these files only; delete an entry once fixed.
  {
    files: [
      "src/app/api/now-playing/route.ts",
      "src/components/admin/AnalyticsDashboard.tsx",
      "src/components/background3d/InteractiveModel.tsx",
    ],
    rules: { "@typescript-eslint/no-explicit-any": "warn" },
  },
];

export default eslintConfig;
