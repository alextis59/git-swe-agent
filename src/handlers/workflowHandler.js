import { runCodex } from "../services/codex.js";
import { createOctokitClient } from "../services/octokit.js";

/**
 * Handle GitHub workflow run completed events
 * @param {Object} payload - The webhook event payload
 * @param {import('../types/index.js').AppConfig} config - Application configuration
 */
export async function handleWorkflowRun(payload, config) {
  const { id, name, conclusion } = payload.workflow_run;
  
  console.log(`Processing workflow run #${id}, name: "${name}", conclusion: ${conclusion}`);
  
  if (conclusion !== "failure") {
    console.log(`Workflow run #${id} conclusion is "${conclusion}", not processing (not a failure)`);
    return;
  }
  
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation.id;
  
  console.log(`Workflow failure detected in repo ${full_name}`);
  console.log(`Installation ID: ${instId}`);
  
  try {
    console.log(`Creating Octokit client for installation ${instId}`);
    const api = await createOctokitClient(config, instId);

    // Fetch CI run logs
    console.log(`Fetching logs for workflow run #${id}`);
    let logs;
    try {
      const logsResponse = await api("GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs", { 
        owner, 
        repo, 
        run_id: id, 
        request: { raw: true } 
      });
      logs = logsResponse.data;
      console.log(`Logs fetched successfully (${logs.length} bytes)`);
    } catch (error) {
      console.error(`Error fetching workflow logs:`, error);
      throw error;
    }
    
    // Use Codex to diagnose the failure
    const logContent = logs.toString("utf8").slice(0, 50000);
    console.log(`Running Codex diagnosis on workflow logs (${logContent.length} chars)`);
    const diagnosis = runCodex(
      process.cwd(), 
      "A CI run failed, diagnose briefly:\n" + logContent,
      config.openaiApiKey
    );
    console.log(`Codex diagnosis complete (${diagnosis.length} chars)`);
    console.log(`Diagnosis preview: ${diagnosis.length > 100 ? diagnosis.substring(0, 100) + '...' : diagnosis}`);

    // Create issue with the diagnosis
    console.log(`Creating issue for workflow failure #${id}`);
    const issueResponse = await api("POST /repos/{owner}/{repo}/issues", { 
      owner, 
      repo, 
      title: `CI failed – run #${id}`, 
      body: diagnosis, 
      labels: ["pipeline-failure"] 
    });
    console.log(`Issue created successfully: #${issueResponse.data.number}`);
    
    console.log(`Successfully processed workflow run #${id}`);
  } catch (error) {
    console.error(`Error processing workflow run #${id}:`, error);
    throw error;
  }
}