/**
 * Mock repo service with type safety fixes
 */
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

/**
 * Creates a temporary repository
 * @param {Object} api - Authenticated Octokit client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{workDir: string, repoDir: string}>} Repository context
 */
export async function mockCreateTempRepo(api, owner, repo) {
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
 * Cleans up a temporary repository
 * @param {string} workDir - Working directory to clean up
 */
export function mockCleanupTempRepo(workDir) {
  rmSync(workDir, { recursive: true, force: true });
}