import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      "**/.next/**",
      "**/out/**",
      "**/node_modules/**",
      "**/next-env.d.ts",
      "apps/web/android/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  { settings: { next: { rootDir: "apps/web" }, react: { version: "19.3" } } },
];

export default eslintConfig;
