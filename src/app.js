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
  console.log("Initializing webhook server");
  const webhooks = new Webhooks({ secret: config.webhookSecret });

  // Handle issues labeled with "codex"
  webhooks.on("issues.labeled", async ({ payload, id }) => {
    console.log(`[EVENT ${id}] Received issues.labeled event for issue #${payload.issue?.number}`);
    try {
      await handleLabeledIssue(payload, config);
      console.log(`[EVENT ${id}] Successfully processed issues.labeled event for issue #${payload.issue?.number}`);
    } catch (error) {
      console.error(`[EVENT ${id}] Error processing issues.labeled event:`, error);
    }
  });

  // Handle pull request opened or updated events
  webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload, id, name }) => {
    console.log(`[EVENT ${id}] Received ${name} event for PR #${payload.pull_request?.number}`);
    try {
      await handlePullRequest(payload, config);
      console.log(`[EVENT ${id}] Successfully processed ${name} event for PR #${payload.pull_request?.number}`);
    } catch (error) {
      console.error(`[EVENT ${id}] Error processing ${name} event:`, error);
    }
  });

  // Handle CI workflow failure events
  webhooks.on("workflow_run.completed", async ({ payload, id }) => {
    console.log(`[EVENT ${id}] Received workflow_run.completed event, conclusion: ${payload.workflow_run?.conclusion}`);
    try {
      await handleWorkflowRun(payload, config);
      console.log(`[EVENT ${id}] Successfully processed workflow_run.completed event`);
    } catch (error) {
      console.error(`[EVENT ${id}] Error processing workflow_run.completed event:`, error);
    }
  });

  // Log other events for debugging
  webhooks.onAny(({ id, name }) => {
    console.log(`[EVENT ${id}] Received event: ${name} (not processed)`);
  });

  // Create a middleware to handle requests
  const middleware = createNodeMiddleware(webhooks);
  
  // Create the HTTP server with additional healthcheck route
  const server = http.createServer((req, res) => {
    console.log(`Received request: ${req.method} ${req.url}`);
    
    // Add a simple health check endpoint
    if (req.url === '/') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('OK');
      console.log('Health check request served');
      return;
    }
    
    // Pass all other requests to the webhook middleware
    middleware(req, res);
  });
  
  return { server, webhooks };
}