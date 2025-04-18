/**
 * Mock repo service with type safety fixes
 */
import { spawnSync } from "child_process";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

export interface RepoContext {
  workDir: string;
  repoDir: string;
}

export async function mockCreateTempRepo(
  api: any, 
  owner: string, 
  repo: string
): Promise<RepoContext> {
  // Create temporary working directory
  const workDir = mkdtempSync(join(tmpdir(), "codex-"));
  const repoDir = join(workDir, "repo");
  
  // Download repository contents - with proper type annotations
  await api("GET /repos/{owner}/{repo}/tarball", { 
    owner, 
    repo, 
    headers: { accept: "application/vnd.github+json" } 
  }).then((response: { data: ArrayBuffer }) => {
    spawnSync("tar", ["xz", "-C", workDir], { 
      input: Buffer.from(response.data) 
    });
  });

  return { workDir, repoDir };
}

export function mockCleanupTempRepo(workDir: string): void {
  rmSync(workDir, { recursive: true, force: true });
}