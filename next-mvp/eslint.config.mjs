import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/sw.js",
  ]),
  {
    rules: {
      // Legitimate patterns: SSR portal-mount guard, once-on-open reset,
      // matchMedia permission probes run inside effects and need setState.
      // Treat as warning; the rule catches real cases elsewhere.
      "react-hooks/set-state-in-effect": "warn",
      // Browser APIs (BeforeInstallPromptEvent, Navigator.standalone) have
      // no official TS types; allow unknown/any at those boundaries.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
]);

export default eslintConfig;
