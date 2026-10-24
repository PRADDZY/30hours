import { spawnSync } from "node:child_process";
import { existsSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

const envFile = join(process.cwd(), ".env.local");
if (!existsSync(envFile)) throw new Error("Missing .env.local; configure the server keys before uploading Cloudflare secrets.");
process.loadEnvFile(envFile);

const names = ["OPENAI_API_KEY", "OPENAI_AUDIO_API_KEY", "GOOGLE_MAPS_API_KEY"];
const secrets = Object.fromEntries(names.map(name => [name, process.env[name]?.trim()]).filter(([, value]) => value));
const missing = names.filter(name => !secrets[name]);
if (missing.length) throw new Error(`Missing required server keys in .env.local: ${missing.join(", ")}`);

const payloadPath = join(tmpdir(), `30hours-secrets-${randomUUID()}.json`);
writeFileSync(payloadPath, JSON.stringify(secrets), { encoding: "utf8", mode: 0o600, flag: "wx" });
try {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", "secret", "bulk", payloadPath, "--name", "30hours"], { stdio: "inherit", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status ?? 1;
} finally {
  unlinkSync(payloadPath);
}
