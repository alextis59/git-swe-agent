import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import http from "node:http";
import { handleLabeledIssue } from "./handlers/issueHandler.js";
import { handlePullRequest } from "./handlers/pullRequestHandler.js";
import { handleWorkflowRun } from "./handlers/workflowHandler.js";

/**
 * Creates and returns a webhook server
 * @param {import('./types/index.js').AppConfig} config - Application configuration
 * @returns {Object} The server and webhooks instances
 */
export function createWebhookServer(config) {
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