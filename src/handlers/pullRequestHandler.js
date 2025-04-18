import { runCodex } from "../services/codex.js";
import { createOctokitClient } from "../services/octokit.js";

/**
 * Handle GitHub pull request events
 * @param {Object} payload - The webhook event payload
 * @param {import('../types/index.js').AppConfig} config - Application configuration
 */
export async function handlePullRequest(payload, config) {
  const { number, diff_url } = payload.pull_request;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation.id;
  
  console.log(`Processing PR #${number} in repo ${full_name}`);
  console.log(`PR diff URL: ${diff_url}`);
  console.log(`Installation ID: ${instId}`);
  
  try {
    console.log(`Creating Octokit client for installation ${instId}`);
    const api = await createOctokitClient(config, instId);

    // Fetch pull request diff
    console.log(`Fetching PR diff from ${diff_url}`);
    let diff;
    try {
      const response = await fetch(diff_url);
      if (!response.ok) {
        throw new Error(`Failed to fetch diff: ${response.status} ${response.statusText}`);
      }
      diff = await response.text();
      console.log(`Diff fetched successfully (${diff.length} chars)`);
    } catch (error) {
      console.error(`Error fetching PR diff:`, error);
      throw error;
    }
    
    // Run Codex review on the diff
    console.log(`Running Codex review on PR diff`);
    const review = runCodex(
      process.cwd(), 
      `Review this diff and reply "APPROVE" if perfect:\n${diff}`,
      config.openaiApiKey
    );
    console.log(`Codex review complete (${review.length} chars)`);
    console.log(`Review result: ${review.length > 100 ? review.substring(0, 100) + '...' : review}`);

    // Post the appropriate review based on Codex results
    const isApprove = review.trim() === "APPROVE";
    console.log(`Posting ${isApprove ? 'APPROVE' : 'COMMENT'} review on PR #${number}`);
    
    if (isApprove) {
      const reviewResponse = await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { 
        owner, 
        repo, 
        pull_number: number, 
        event: "APPROVE", 
        body: "✅ LGTM – approved by Codex." 
      });
      console.log(`Review posted successfully, ID: ${reviewResponse.data.id}`);
    } else {
      const reviewResponse = await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { 
        owner, 
        repo, 
        pull_number: number, 
        body: review, 
        event: "COMMENT" 
      });
      console.log(`Review posted successfully, ID: ${reviewResponse.data.id}`);
    }
    
    console.log(`Successfully processed PR #${number}`);
  } catch (error) {
    console.error(`Error processing PR #${number}:`, error);
    throw error;
  }
}