import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Creates a temporary working directory and clones the repository
 * @param {Object} api - Octokit API client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Object containing workDir and repoDir paths
 */
export async function createTempRepo(api, owner, repo) {
  // Create temporary working directory
  const workDir = mkdtempSync(join(tmpdir(), "codex-"));
  const repoDir = join(workDir, "repo");
  
  // Download repository contents
  await api("GET /repos/{owner}/{repo}/tarball", { 
    owner, 
    repo, 
    headers: { accept: "application/vnd.github+json" } 
  }).then((response) => {
    spawnSync("tar", ["xz", "-C", workDir], { 
      input: Buffer.from(response.data) 
    });
  });

  return { workDir, repoDir };
}

/**
 * Cleans up the temporary working directory
 * @param {string} workDir - Path to the temporary working directory
 */
export function cleanupTempRepo(workDir) {
  rmSync(workDir, { recursive: true, force: true });
}