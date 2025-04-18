import { spawnSync } from "node:child_process";

/**
 * Run Codex in the specified directory with the given prompt
 * @param {string} cwd - Working directory to run Codex in
 * @param {string} prompt - The prompt to send to Codex
 * @param {string} openaiApiKey - OpenAI API key
 * @returns {string} The response from Codex
 */
export function runCodex(cwd, prompt, openaiApiKey) {
  console.log(`Running Codex in directory: ${cwd}`);
  console.log(`Prompt length: ${prompt.length} characters`);
  
  const startTime = Date.now();
  console.log(`Starting Codex process at ${new Date(startTime).toISOString()}`);
  
  const res = spawnSync("codex", ["-q", "-a", "full-auto", prompt], {
    cwd,
    env: { ...process.env, OPENAI_API_KEY: openaiApiKey },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000;
  console.log(`Codex process completed in ${duration.toFixed(2)}s at ${new Date(endTime).toISOString()}`);
  
  if (res.error) {
    console.error(`Codex process error:`, res.error);
  }
  
  if (res.status !== 0) {
    console.error(`Codex process exited with status code ${res.status}`);
    console.error(`stderr: ${res.stderr}`);
  }
  
  const output = res.stdout.trim();
  console.log(`Codex output length: ${output.length} characters`); 
  
  return output;
}