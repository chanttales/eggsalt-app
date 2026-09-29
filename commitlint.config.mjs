const config = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      ["web", "mobile", "ui", "domain", "engine", "db", "template", "ci", "repo", "docs"],
    ],
    "scope-empty": [2, "never"],
    "header-max-length": [2, "always", 72],
  },
};

export default config;
