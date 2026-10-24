import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const [command, ...args] = process.argv.slice(2);
if (!command || !["dev", "build", "start"].includes(command)) {
  throw new Error("Usage: node scripts/with-local-env.mjs <dev|build|start> [...next args]");
}

const localEnvFile = resolve(process.cwd(), ".env.local");
const hasLocalEnv = existsSync(localEnvFile);
if (hasLocalEnv) {
  for (const line of readFileSync(localEnvFile, "utf8").split(/\r?\n/u)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/.exec(line);
    if (match) delete process.env[match[1]];
  }
  process.loadEnvFile(localEnvFile);
}

const nextBin = resolve(process.cwd(), "node_modules/next/dist/bin/next");
const child = spawn(process.execPath, [nextBin, command, ...args], { cwd: process.cwd(), env: { ...process.env }, stdio: "inherit" });

for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
child.on("error", error => { console.error(error.message); process.exitCode = 1; });
child.on("exit", (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1;
});
