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
  console.log(`Webhook secret configured: ${config.webhookSecret ? 'YES' : 'NO'} (length: ${config.webhookSecret?.length || 0})`);
  
  // Create webhook instance with additional debug options
  const webhooks = new Webhooks({ 
    secret: config.webhookSecret,
    log: {
      debug: (...args) => console.log('[Webhook Debug]', ...args),
      info: (...args) => console.log('[Webhook Info]', ...args),
      warn: (...args) => console.warn('[Webhook Warning]', ...args),
      error: (...args) => console.error('[Webhook Error]', ...args)
    }
  });
  
  // Verify webhook is properly initialized
  console.log("Webhook server initialized with these event handlers:");
  console.log("- issues.labeled");
  console.log("- pull_request.opened");
  console.log("- pull_request.synchronize");
  console.log("- workflow_run.completed");
  
  // Add verification check for ping events (special event sent by GitHub when setting up a webhook)
  webhooks.on("ping", ({ payload, id }) => {
    console.log(`[EVENT ${id}] Received ping event with zen: "${payload.zen}"`);
    console.log(`[EVENT ${id}] Webhook is properly set up and receiving events from GitHub!`);
    return { status: "success", message: "Webhook received ping successfully" };
  });

  // Handle issues labeled with "codex"
  webhooks.on("issues.labeled", async ({ payload, id }) => {
    console.log(`[EVENT ${id}] Received issues.labeled event for issue #${payload.issue?.number}`);
    console.log(`[EVENT ${id}] Label: "${payload.label?.name}", repository: ${payload.repository?.full_name}`);
    
    try {
      // Additional check to filter for "codex" label
      if (payload.label?.name !== "codex") {
        console.log(`[EVENT ${id}] Ignoring issues.labeled event as label name is not "codex"`);
        return;
      }
      
      await handleLabeledIssue(payload, config);
      console.log(`[EVENT ${id}] Successfully processed issues.labeled event for issue #${payload.issue?.number}`);
    } catch (error) {
      console.error(`[EVENT ${id}] Error processing issues.labeled event:`, error);
    }
  });

  // Handle pull request opened or updated events
  webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload, id, name }) => {
    console.log(`[EVENT ${id}] Received ${name} event for PR #${payload.pull_request?.number}`);
    console.log(`[EVENT ${id}] PR title: "${payload.pull_request?.title}", repository: ${payload.repository?.full_name}`);
    
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
    console.log(`[EVENT ${id}] Workflow: "${payload.workflow_run?.name}", repository: ${payload.repository?.full_name}`);
    
    try {
      await handleWorkflowRun(payload, config);
      console.log(`[EVENT ${id}] Successfully processed workflow_run.completed event`);
    } catch (error) {
      console.error(`[EVENT ${id}] Error processing workflow_run.completed event:`, error);
    }
  });

  // Log all events for debugging
  webhooks.onAny(({ id, name }) => {
    console.log(`[EVENT ${id}] Received event: ${name}`);
  });

  // Create a middleware to handle requests
  const middleware = createNodeMiddleware(webhooks);
  
  // Add logging to webhook to inspect verification process
  webhooks.onError((error) => {
    console.error('Webhook Error:', error);
  });

  // Create the HTTP server with additional healthcheck route
  const server = http.createServer((req, res) => {
    // Don't log health check (GET /) or HEAD requests
    const isHealthCheck = req.method === 'GET' && req.url === '/';
    const isHeadRequest = req.method === 'HEAD';
    
    // Only log non-health check and non-HEAD requests
    if (!isHealthCheck && !isHeadRequest) {
      console.log(`Received request: ${req.method} ${req.url}`);
    }
    
    // Handle health check endpoint for GET requests only
    if (isHealthCheck) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'text/plain');
      res.end('OK');
      return;
    }
    
    // For webhook debugging, extract and log request details
    if (req.method === 'POST' && req.url === '/') {
      console.log('Webhook request received with headers:', {
        'x-github-event': req.headers['x-github-event'],
        'x-github-delivery': req.headers['x-github-delivery'],
        'content-type': req.headers['content-type'],
        'user-agent': req.headers['user-agent'],
        'x-hub-signature': req.headers['x-hub-signature'],
        'x-hub-signature-256': req.headers['x-hub-signature-256']
      });
      
      // If signature header is missing, this might be why events aren't processed
      if (!req.headers['x-hub-signature-256'] && !req.headers['x-hub-signature']) {
        console.error('WARNING: Missing signature headers. Webhook verification will likely fail.');
      }
      
      // For debugging, capture and log the payload
      let body = [];
      req.on('data', (chunk) => {
        body.push(chunk);
      });
      
      // Store original end method to ensure we don't break the middleware
      const originalEnd = res.end;
      res.end = function(...args) {
        // After response is complete, log payload and status
        const payload = Buffer.concat(body).toString();
        console.log(`Webhook response status: ${res.statusCode}`);
        
        try {
          // Try to parse and log a summary of the payload
          const jsonPayload = JSON.parse(payload);
          console.log('Webhook payload summary:', {
            event: req.headers['x-github-event'],
            action: jsonPayload.action,
            repository: jsonPayload.repository?.full_name,
            sender: jsonPayload.sender?.login
          });
        } catch (e) {
          console.log('Could not parse webhook payload (likely not JSON)');
        }
        
        // Call original end method to finish the response
        return originalEnd.apply(this, args);
      };
    }
    
    // Pass all requests to the webhook middleware
    middleware(req, res);
  });
  
  return { server, webhooks };
}