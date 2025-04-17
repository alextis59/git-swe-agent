import { AppConfig } from "../types";
import { runCodex } from "../services/codex";
import { createOctokitClient } from "../services/octokit";

export async function handleWorkflowRun(payload: any, config: AppConfig) {
  if (payload.workflow_run.conclusion !== "failure") return;
  
  const { id } = payload.workflow_run;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await createOctokitClient(config, instId);

  // Fetch CI run logs
  const logs = await api("GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs", { 
    owner, 
    repo, 
    run_id: id, 
    request: { raw: true } 
  }).then(r => r.data as Buffer);
  
  // Use Codex to diagnose the failure
  const diagnosis = runCodex(
    process.cwd(), 
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