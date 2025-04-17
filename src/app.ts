import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import http from "node:http";
import { AppConfig } from "./types";
import { handleLabeledIssue } from "./handlers/issueHandler";
import { handlePullRequest } from "./handlers/pullRequestHandler";
import { handleWorkflowRun } from "./handlers/workflowHandler";

export function createWebhookServer(config: AppConfig) {
  const webhooks = new Webhooks({ secret: config.webhookSecret });

  // Handle issues labeled with "codex"
  webhooks.on("issues.labeled", async ({ payload }) => {
    await handleLabeledIssue(payload, config);
  });

  // Handle pull request opened or updated events
  webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload }) => {
    await handlePullRequest(payload, config);
  });

  // Handle CI workflow failure events
  webhooks.on("workflow_run.completed", async ({ payload }) => {
    await handleWorkflowRun(payload, config);
  });

  // Create and return the HTTP server
  const server = http.createServer(createNodeMiddleware(webhooks));
  
  return { server, webhooks };
}