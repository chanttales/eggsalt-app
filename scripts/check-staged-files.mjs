// Blocks commits that stage env files, keystores or files over 500 KB (public repo).
import { execSync } from "node:child_process";
import { statSync } from "node:fs";

const MAX_BYTES = 500 * 1024;
const files = execSync("git diff --cached --name-only --diff-filter=ACM", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean);

const problems = [];
for (const file of files) {
  const name = file.split("/").pop() ?? file;
  if (/^\.env(\..*)?$/.test(name) && name !== ".env.example") {
    problems.push(`${file}: env files must not be committed`);
  }
  if (/\.(keystore|jks|pem|p12)$/.test(name)) {
    problems.push(`${file}: key files must not be committed`);
  }
  if (file !== "pnpm-lock.yaml" && statSync(file).size > MAX_BYTES) {
    problems.push(`${file}: larger than 500 KB`);
  }
}

if (problems.length > 0) {
  console.error("Commit blocked:\n" + problems.map((p) => `  - ${p}`).join("\n"));
  process.exit(1);
}
