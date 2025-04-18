import { spawnSync } from "node:child_process";

/**
 * Run a git command and log the result
 * @param {string} repoDir - Repository directory path
 * @param {Array<string>} args - Git command arguments
 * @param {string} operation - Operation name for logging
 * @returns {Object} The command result
 */
function runGitCommand(repoDir, args, operation) {
  console.log(`Git ${operation}: Running 'git ${args.join(' ')}' in ${repoDir}`);
  const result = spawnSync("git", args, { cwd: repoDir });
  
  if (result.error) {
    console.error(`Git ${operation} error:`, result.error);
  }
  
  if (result.status !== 0) {
    console.error(`Git ${operation} exited with status code ${result.status}`);
    console.error(`stderr: ${result.stderr}`);
  } else {
    console.log(`Git ${operation} completed successfully`);
  }
  
  return result;
}

/**
 * Configure git user information
 * @param {string} repoDir - Repository directory path
 */
export function configureGit(repoDir) {
  console.log(`Configuring git user in ${repoDir}`);
  runGitCommand(repoDir, ["config", "--global", "user.email", "codex@app"], "config email");
  runGitCommand(repoDir, ["config", "--global", "user.name", "Codex Agent"], "config name");
}

/**
 * Create a new git branch
 * @param {string} repoDir - Repository directory path
 * @param {string} branchName - Name of the branch to create
 */
export function createBranch(repoDir, branchName) {
  console.log(`Creating branch '${branchName}' in ${repoDir}`);
  runGitCommand(repoDir, ["checkout", "-b", branchName], "branch creation");
}

/**
 * Stage all changes in the repository
 * @param {string} repoDir - Repository directory path
 */
export function stageAllChanges(repoDir) {
  console.log(`Staging all changes in ${repoDir}`);
  runGitCommand(repoDir, ["add", "-A"], "add");
  
  // Log the staged files for debugging
  const stagedFiles = runGitCommand(repoDir, ["diff", "--cached", "--name-only"], "list staged files");
  if (stagedFiles.stdout) {
    const files = stagedFiles.stdout.toString().trim().split('\n').filter(Boolean);
    console.log(`Staged ${files.length} files:`, files);
  }
}

/**
 * Check if there are staged changes
 * @param {string} repoDir - Repository directory path
 * @returns {boolean} True if there are staged changes
 */
export function hasChanges(repoDir) {
  console.log(`Checking for staged changes in ${repoDir}`);
  const result = runGitCommand(repoDir, ["diff", "--cached", "--quiet"], "check changes");
  const hasChanges = result.status === 1;
  console.log(`Repository has staged changes: ${hasChanges}`);
  return hasChanges;
}

/**
 * Commit staged changes
 * @param {string} repoDir - Repository directory path
 * @param {string} message - Commit message
 */
export function commitChanges(repoDir, message) {
  console.log(`Committing changes in ${repoDir} with message: "${message}"`);
  const result = runGitCommand(repoDir, ["commit", "-m", message], "commit");
  
  if (result.stdout) {
    console.log(`Commit output: ${result.stdout.toString().trim()}`);
  }
}

/**
 * Push changes to remote repository
 * @param {string} repoDir - Repository directory path
 * @param {string} repoUrl - Repository URL
 * @param {string} branchName - Branch name to push
 */
export function pushChanges(repoDir, repoUrl, branchName) {
  // Log with redacted URL to avoid exposing tokens
  const redactedUrl = repoUrl.replace(/https:\/\/.*?@/, "https://[REDACTED]@");
  console.log(`Pushing to ${redactedUrl} branch ${branchName} from ${repoDir}`);
  
  const result = runGitCommand(repoDir, ["push", "--force", repoUrl, `HEAD:${branchName}`], "push");
  
  if (result.stdout) {
    console.log(`Push output: ${result.stdout.toString().trim()}`);
  }
}