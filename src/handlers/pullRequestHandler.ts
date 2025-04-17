import { AppConfig } from "../types";
import { runCodex } from "../services/codex";
import { createOctokitClient } from "../services/octokit";

export async function handlePullRequest(payload: any, config: AppConfig) {
  const { number, diff_url } = payload.pull_request;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await createOctokitClient(config, instId);

  // Fetch pull request diff
  const diff = await fetch(diff_url).then(r => r.text());
  
  // Run Codex review on the diff
  const review = runCodex(
    process.cwd(), 
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