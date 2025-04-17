import { AppConfig } from "../types";
import { runCodex } from "../services/codex";
import { createOctokitClient } from "../services/octokit";
import { createTempRepo, cleanupTempRepo } from "../services/repo";
import { configureGit, createBranch, stageAllChanges, hasChanges, commitChanges, pushChanges } from "../services/git";

export async function handleLabeledIssue(payload: any, config: AppConfig) {
  if (payload.label.name !== "codex") return;
  
  const { number, body, title } = payload.issue;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await createOctokitClient(config, instId);
  
  // Create temporary working directory
  const { workDir, repoDir } = await createTempRepo(api, owner, repo);
  
  try {
    // Run Codex on the issue body
    runCodex(repoDir, body || "solve this issue", config.openaiApiKey);
    
    // Configure git and prepare branch
    configureGit(repoDir);
    const branch = `codex/issue-${number}`;
    createBranch(repoDir, branch);
    stageAllChanges(repoDir);
    
    // Commit and push changes if there are any
    if (hasChanges(repoDir)) {
      // Commit changes
      commitChanges(repoDir, `Codex changes for #${number}`);
      
      // Get access token and push changes
      const accessTokenResponse = await api("POST /app/installations/{installation_id}/access_tokens", { 
        installation_id: instId 
      });
      
      const repoUrl = `https://x-access-token:${accessTokenResponse.data.token}@github.com/${owner}/${repo}.git`;
      pushChanges(repoDir, repoUrl, branch);
      
      // Create pull request
      await api("POST /repos/{owner}/{repo}/pulls", { 
        owner, 
        repo, 
        head: branch, 
        base: "main", 
        title: `Codex: ${title}`, 
        body: `Closes #${number}` 
      });
    }
  } finally {
    // Clean up temporary directory
    cleanupTempRepo(workDir);
  }
}