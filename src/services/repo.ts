import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RepoContext {
  workDir: string;
  repoDir: string;
}

export async function createTempRepo(
  api: any, 
  owner: string, 
  repo: string
): Promise<RepoContext> {
  // Create temporary working directory
  const workDir = mkdtempSync(join(tmpdir(), "codex-"));
  const repoDir = join(workDir, "repo");
  
  // Download repository contents
  await api("GET /repos/{owner}/{repo}/tarball", { 
    owner, 
    repo, 
    headers: { accept: "application/vnd.github+json" } 
  }).then(response => {
    spawnSync("tar", ["xz", "-C", workDir], { 
      input: Buffer.from(response.data as ArrayBuffer) 
    });
  });

  return { workDir, repoDir };
}

export function cleanupTempRepo(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}