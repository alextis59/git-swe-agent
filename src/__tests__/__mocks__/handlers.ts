/**
 * Mock handlers for testing
 * These mocks isolate the handlers from their dependencies that are causing testing issues
 */

import { AppConfig } from "../../types";
import { runCodex } from "../../services/codex";
import { createOctokitClient } from "../../services/octokit";
import { createTempRepo, cleanupTempRepo } from "../../services/repo";
import { 
  configureGit, 
  createBranch, 
  stageAllChanges, 
  hasChanges, 
  commitChanges, 
  pushChanges 
} from "../../services/git";

// Mock version of the issue handler for testing
export async function mockHandleLabeledIssue(payload: any, config: AppConfig) {
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
      
      // Create a fake token response for testing
      const token = "fake-token-for-testing";
      
      const repoUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
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

// Mock version of the pull request handler for testing
export async function mockHandlePullRequest(payload: any, config: AppConfig) {
  const { number } = payload.pull_request;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await createOctokitClient(config, instId);

  // Mock diff content for testing
  const diff = "Mock diff content for testing";
  
  // Run Codex review on the diff
  const review = runCodex(
    "./", 
    `Review this diff and reply "APPROVE" if perfect:\n${diff}`,
    config.openaiApiKey
  );

  // Post the appropriate review based on Codex results
  if (review.trim() === "APPROVE") {
    await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { 
      owner, 
      repo, 
      pull_number: number, 
      event: "APPROVE", 
      body: "✅ LGTM – approved by Codex." 
    });
  } else {
    await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { 
      owner, 
      repo, 
      pull_number: number, 
      body: review, 
      event: "COMMENT" 
    });
  }
}

// Mock version of the workflow handler for testing
export async function mockHandleWorkflowRun(payload: any, config: AppConfig) {
  if (payload.workflow_run.conclusion !== "failure") return;
  
  const { id } = payload.workflow_run;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await createOctokitClient(config, instId);

  // Mock logs content for testing
  const logs = Buffer.from("Mock logs content for testing");
  
  // Use Codex to diagnose the failure
  const diagnosis = runCodex(
    "./", 
    "A CI run failed, diagnose briefly:\n" + logs.toString("utf8").slice(0, 50000),
    config.openaiApiKey
  );

  // Create issue with the diagnosis
  await api("POST /repos/{owner}/{repo}/issues", { 
    owner, 
    repo, 
    title: `CI failed – run #${id}`, 
    body: diagnosis, 
    labels: ["pipeline-failure"] 
  });
}