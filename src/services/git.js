import { spawnSync } from "node:child_process";

/**
 * Configure git user information
 * @param {string} repoDir - Repository directory path
 */
export function configureGit(repoDir) {
  spawnSync("git", ["config", "--global", "user.email", "codex@app"], { cwd: repoDir });
  spawnSync("git", ["config", "--global", "user.name", "Codex Agent"], { cwd: repoDir });
}

/**
 * Create a new git branch
 * @param {string} repoDir - Repository directory path
 * @param {string} branchName - Name of the branch to create
 */
export function createBranch(repoDir, branchName) {
  spawnSync("git", ["checkout", "-b", branchName], { cwd: repoDir });
}

/**
 * Stage all changes in the repository
 * @param {string} repoDir - Repository directory path
 */
export function stageAllChanges(repoDir) {
  spawnSync("git", ["add", "-A"], { cwd: repoDir });
}

/**
 * Check if there are staged changes
 * @param {string} repoDir - Repository directory path
 * @returns {boolean} True if there are staged changes
 */
export function hasChanges(repoDir) {
  return spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repoDir }).status === 1;
}

/**
 * Commit staged changes
 * @param {string} repoDir - Repository directory path
 * @param {string} message - Commit message
 */
export function commitChanges(repoDir, message) {
  spawnSync("git", ["commit", "-m", message], { cwd: repoDir });
}

/**
 * Push changes to remote repository
 * @param {string} repoDir - Repository directory path
 * @param {string} repoUrl - Repository URL
 * @param {string} branchName - Branch name to push
 */
export function pushChanges(repoDir, repoUrl, branchName) {
  spawnSync("git", ["push", "--force", repoUrl, `HEAD:${branchName}`], { cwd: repoDir });
}