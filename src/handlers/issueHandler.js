import { runCodex } from "../services/codex.js";
import { createOctokitClient } from "../services/octokit.js";
import { createTempRepo, cleanupTempRepo } from "../services/repo.js";
import { configureGit, createBranch, stageAllChanges, hasChanges, commitChanges, pushChanges } from "../services/git.js";

/**
 * Handle GitHub issues labeled with "codex"
 * @param {Object} payload - The webhook event payload
 * @param {import('../types/index.js').AppConfig} config - Application configuration
 */
export async function handleLabeledIssue(payload, config) {
  if (payload.label.name !== "codex") {
    console.log(`Issue #${payload.issue?.number} labeled with "${payload.label.name}", ignoring (not codex)`);
    return;
  }
  
  const { number, body, title } = payload.issue;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation.id;
  
  console.log(`Processing issue #${number} labeled with "codex" in repo ${full_name}`);
  console.log(`Issue title: ${title}`);
  console.log(`Installation ID: ${instId}`);
  
  try {
    console.log(`Creating Octokit client for installation ${instId}`);
    const api = await createOctokitClient(config, instId);
    
    // Create temporary working directory
    console.log(`Creating temporary repo for ${owner}/${repo}`);
    const { workDir, repoDir } = await createTempRepo(api, owner, repo);
    console.log(`Temporary repo created at ${repoDir}`);
    
    try {
      // Run Codex on the issue body
      console.log(`Running Codex on issue body (${body?.length || 0} chars)`);
      const codexResponse = runCodex(repoDir, body || "solve this issue", config.openaiApiKey);
      console.log(`Codex response received (${codexResponse?.length || 0} chars)`);
      
      // Configure git and prepare branch
      console.log(`Configuring git`);
      configureGit(repoDir);
      
      const branch = `codex/issue-${number}`;
      console.log(`Creating branch: ${branch}`);
      createBranch(repoDir, branch);
      
      console.log(`Staging changes`);
      stageAllChanges(repoDir);
      
      // Commit and push changes if there are any
      if (hasChanges(repoDir)) {
        console.log(`Changes detected, committing`);
        // Commit changes
        commitChanges(repoDir, `Codex changes for #${number}`);
        
        // Get access token and push changes
        console.log(`Getting temporary access token for pushing changes`);
        const accessTokenResponse = await api("POST /app/installations/{installation_id}/access_tokens", { 
          installation_id: instId 
        });
        
        const repoUrl = `https://x-access-token:${accessTokenResponse.data.token}@github.com/${owner}/${repo}.git`;
        console.log(`Pushing changes to ${branch}`);
        pushChanges(repoDir, repoUrl, branch);
        
        // Create pull request
        console.log(`Creating pull request from ${branch} to main`);
        const pullResponse = await api("POST /repos/{owner}/{repo}/pulls", { 
          owner, 
          repo, 
          head: branch, 
          base: "main", 
          title: `Codex: ${title}`, 
          body: `Closes #${number}` 
        });
        console.log(`Pull request created: #${pullResponse.data.number}`);
      } else {
        console.log(`No changes detected, skipping commit and PR creation`);
      }
    } finally {
      // Clean up temporary directory
      console.log(`Cleaning up temporary directory: ${workDir}`);
      cleanupTempRepo(workDir);
    }
    console.log(`Successfully processed issue #${number}`);
  } catch (error) {
    console.error(`Error processing issue #${number}:`, error);
    throw error;
  }
}