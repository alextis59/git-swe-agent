import { loadConfig } from "./utils/config.js";
import { createWebhookServer } from "./app.js";

// Log environment variables for debugging
console.log("Environment PORT:", process.env.PORT);

// Load application configuration
const config = loadConfig();

// Log configuration for debugging (without exposing secrets completely)
console.log("Configuration:", {
  appId: config.appId,
  privateKeyPresent: !!config.privateKey,
  privateKeyLength: config.privateKey?.length,
  webhookSecretPresent: !!config.webhookSecret,
  webhookSecretLength: config.webhookSecret?.length,
  openaiApiKeyPresent: !!config.openaiApiKey,
  openaiApiKeyPrefix: config.openaiApiKey?.substring(0, 5) + '...',
  port: config.port
});

// Log the resolved port
console.log("Using port:", config.port);

// Create the webhook server
const { server } = createWebhookServer(config);

// Start the server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`Codex Agent listening on port ${config.port} on 0.0.0.0`);
});