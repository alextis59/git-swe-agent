import { spawnSync } from "node:child_process";

export function runCodex(cwd: string, prompt: string, openaiApiKey: string): string {
  const res = spawnSync("codex", ["-q", "-a", "full-auto", prompt], {
    cwd,
    env: { ...process.env, OPENAI_API_KEY: openaiApiKey },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return res.stdout.trim();
}