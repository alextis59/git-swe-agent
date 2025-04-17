import { spawnSync } from "node:child_process";

export function configureGit(repoDir: string): void {
  spawnSync("git", ["config", "--global", "user.email", "codex@app"], { cwd: repoDir });
  spawnSync("git", ["config", "--global", "user.name", "Codex Agent"], { cwd: repoDir });
}

export function createBranch(repoDir: string, branchName: string): void {
  spawnSync("git", ["checkout", "-b", branchName], { cwd: repoDir });
}

export function stageAllChanges(repoDir: string): void {
  spawnSync("git", ["add", "-A"], { cwd: repoDir });
}

export function hasChanges(repoDir: string): boolean {
  return spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repoDir }).status === 1;
}

export function commitChanges(repoDir: string, message: string): void {
  spawnSync("git", ["commit", "-m", message], { cwd: repoDir });
}

export function pushChanges(repoDir: string, repoUrl: string, branchName: string): void {
  spawnSync("git", ["push", "--force", repoUrl, `HEAD:${branchName}`], { cwd: repoDir });
}