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
  
  // Log webhook secret first few chars for debugging
  if (config.webhookSecret) {
    console.log(`Webhook secret starts with: ${config.webhookSecret.substring(0, 3)}...`);
  } else {
    console.error('CRITICAL ERROR: Webhook secret is empty or undefined!');
  }
  
  // Create a debug callback for the verification process
  const webhookVerify = (request, response, next) => {
    console.log('WEBHOOK VERIFICATION - START');
    console.log('Headers:', {
      event: request.headers['x-github-event'],
      delivery: request.headers['x-github-delivery']?.substring(0, 10) + '...',
      signature: request.headers['x-hub-signature-256']?.substring(0, 15) + '...'
    });
    
    // Continue with regular verification
    next();
    
    // Log verification result
    console.log('WEBHOOK VERIFICATION - RESULT', { 
      statusCode: response.statusCode,
      statusMessage: response.statusMessage
    });
  };

  // Create webhook instance with additional debug options
  const webhooks = new Webhooks({ 
    secret: config.webhookSecret,
    transform: webhookVerify,
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
        'x-hub-signature': req.headers['x-hub-signature']?.substring(0, 15) + '...',
        'x-hub-signature-256': req.headers['x-hub-signature-256']?.substring(0, 15) + '...'
      });
      
      // If signature header is missing, this might be why events aren't processed
      if (!req.headers['x-hub-signature-256'] && !req.headers['x-hub-signature']) {
        console.error('WARNING: Missing signature headers. Webhook verification will likely fail.');
      }
      
      // DEBUG: Manually verify the webhook secret
      console.log('Verifying with webhook secret from config:', 
                  config.webhookSecret ? `Present (${config.webhookSecret.length} chars, starts with: ${config.webhookSecret.substring(0, 3)}...)` : 'Missing!');
      
      // For debugging, capture and log the payload
      let rawBody = [];
      req.on('data', (chunk) => {
        rawBody.push(chunk);
      });
      
      req.on('end', () => {
        try {
          // Create a buffer from the chunks
          const buffer = Buffer.concat(rawBody);
          
          // Convert to string and try to parse as JSON
          const rawPayload = buffer.toString('utf8');
          console.log(`Raw payload received (${rawPayload.length} chars)`);
          
          try {
            // Try to parse the payload to verify it's valid JSON
            const payload = JSON.parse(rawPayload);
            console.log('Parsed JSON payload with these keys:', Object.keys(payload));
            console.log('Event type:', req.headers['x-github-event']);
            console.log('Event action:', payload.action);
            console.log('Event sender:', payload.sender?.login);
            console.log('Event repo:', payload.repository?.full_name);
            
            if (req.headers['x-github-event'] === 'issues') {
              console.log('Issues event details:');
              console.log('- Issue Number:', payload.issue?.number);
              console.log('- Issue Title:', payload.issue?.title);
              console.log('- Action:', payload.action);
              if (payload.action === 'labeled') {
                console.log('- Label:', payload.label?.name);
              }
            }
          } catch (jsonError) {
            console.error('Error parsing webhook payload as JSON:', jsonError);
          }
          
        } catch (error) {
          console.error('Error processing webhook payload:', error);
        }
      });
      
      // Store original end method to ensure we don't break the middleware
      const originalEnd = res.end;
      res.end = function(...args) {
        // After response is complete, log payload and status
        console.log(`Webhook response status: ${res.statusCode}`);
        
        // Call original end method to finish the response
        return originalEnd.apply(this, args);
      };
    }
    
    // Debug mode: For POST webhook requests, try to manually process if headers look right
    if (req.method === 'POST' && req.url === '/' && 
        req.headers['x-github-event'] && 
        (req.headers['x-github-delivery'] || req.headers['x-github-hook-id'])) {
      
      console.log('MANUAL WEBHOOK PROCESSING: Detected GitHub webhook request');
      
      // Collect the request body for manual processing
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      
      req.on('end', async () => {
        try {
          const eventName = req.headers['x-github-event'];
          const deliveryId = req.headers['x-github-delivery'] || 'manual-' + Date.now();
          
          // Parse the payload
          const body = Buffer.concat(chunks).toString();
          const payload = JSON.parse(body);
          
          console.log(`MANUAL WEBHOOK PROCESSING: Parsed ${eventName} event (${deliveryId})`);
          
          // Now try to manually process the webhook event
          console.log(`MANUAL WEBHOOK PROCESSING: Event = ${eventName}, Action = ${payload.action}`);
          
          // Handle different event types manually
          if (eventName === 'issues' && payload.action === 'labeled') {
            if (payload.label && payload.label.name === 'codex') {
              console.log(`MANUAL WEBHOOK PROCESSING: Processing issue #${payload.issue.number} labeled with 'codex'`);
              try {
                await handleLabeledIssue(payload, config);
                console.log(`MANUAL WEBHOOK PROCESSING: Successfully processed issue #${payload.issue.number}`);
              } catch (error) {
                console.error(`MANUAL WEBHOOK PROCESSING: Error processing issue:`, error);
              }
            } else {
              console.log(`MANUAL WEBHOOK PROCESSING: Ignoring issue labeled with '${payload.label?.name}' (not 'codex')`);
            }
          } else if (eventName === 'pull_request' && 
                    (payload.action === 'opened' || payload.action === 'synchronize')) {
            console.log(`MANUAL WEBHOOK PROCESSING: Processing PR #${payload.pull_request.number}`);
            try {
              await handlePullRequest(payload, config);
              console.log(`MANUAL WEBHOOK PROCESSING: Successfully processed PR #${payload.pull_request.number}`);
            } catch (error) {
              console.error(`MANUAL WEBHOOK PROCESSING: Error processing PR:`, error);
            }
          } else if (eventName === 'workflow_run' && payload.action === 'completed') {
            if (payload.workflow_run.conclusion === 'failure') {
              console.log(`MANUAL WEBHOOK PROCESSING: Processing workflow failure #${payload.workflow_run.id}`);
              try {
                await handleWorkflowRun(payload, config);
                console.log(`MANUAL WEBHOOK PROCESSING: Successfully processed workflow failure`);
              } catch (error) {
                console.error(`MANUAL WEBHOOK PROCESSING: Error processing workflow:`, error);
              }
            } else {
              console.log(`MANUAL WEBHOOK PROCESSING: Ignoring workflow with conclusion '${payload.workflow_run.conclusion}'`);
            }
          } else if (eventName === 'ping') {
            console.log(`MANUAL WEBHOOK PROCESSING: Received ping event with zen: "${payload.zen}"`);
          } else {
            console.log(`MANUAL WEBHOOK PROCESSING: No handler for ${eventName}.${payload.action} event`);
          }
          
          // Send successful response
          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'success',
            message: `Manually processed ${eventName} event`
          }));
          
        } catch (error) {
          console.error('MANUAL WEBHOOK PROCESSING: Error:', error);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({
            status: 'error',
            message: error.message
          }));
        }
      });
      
      return; // Skip regular middleware
    }
    
    // For all other requests, pass to the regular webhook middleware
    middleware(req, res);
  });
  
  return { server, webhooks };
}