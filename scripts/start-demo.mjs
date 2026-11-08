import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "node:util";
import { envFile, profile, root, state } from "./demo-profile.mjs";

let config;
try {
  config = parseEnv(readFileSync(envFile, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  console.error("Run npm run demo:setup first.");
  process.exit(1);
}

const port = new URL(config.APP_URL).port;
writeFileSync(
  path.join(state, "tsconfig.json"),
  JSON.stringify({ extends: "../../tsconfig.json" }) + "\n",
);
const child = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--hostname",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    stdio: "inherit",
    cwd: root,
    env: {
      ...process.env,
      ...config,
      SA_DEMO_RUN: profile,
      SA_DEMO_MODE: process.env.SA_DEMO_MODE ?? "1",
    },
  },
);
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
