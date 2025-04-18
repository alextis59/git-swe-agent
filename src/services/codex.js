import { spawnSync } from "node:child_process";

/**
 * Run Codex in the specified directory with the given prompt
 * @param {string} cwd - Working directory to run Codex in
 * @param {string} prompt - The prompt to send to Codex
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {string} The response from Codex
 */
export function runCodex(cwd, prompt, openaiApiKey) {
  const res = spawnSync("codex", ["-q", "-a", "full-auto", prompt], {
    cwd,
    env: { ...process.env, OPENAI_API_KEY: openaiApiKey },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return res.stdout.trim();
}