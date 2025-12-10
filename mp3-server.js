#!/usr/bin/env node
import { existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distEntry = join(__dirname, "dist", "index.js");

const ensureBuilt = () => {
  if (existsSync(distEntry)) {
    return;
  }

  console.log("No build output found. Running `npm run build`...");
  const result = spawnSync("npm", ["run", "build"], { stdio: "inherit" });
  if (result.status !== 0) {
    console.error("Failed to build project. Please resolve errors above.");
    process.exit(result.status ?? 1);
  }
};

const start = async () => {
  ensureBuilt();
  await import(distEntry);
};

start();
