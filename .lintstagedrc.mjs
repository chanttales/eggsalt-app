// Fast checks on staged files only. Full typecheck, tests and builds run in CI.
const config = {
  "*.{ts,tsx,js,mjs,cjs}": ["eslint --max-warnings=0 --fix", "prettier --write"],
  "*.{json,md,css,yml,yaml}": ["prettier --write"],
  "*": [() => "node scripts/check-staged-files.mjs"],
};

export default config;
