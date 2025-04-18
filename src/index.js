import { loadConfig } from "./utils/config.js";
import { createWebhookServer } from "./app.js";

// Load application configuration
const config = loadConfig();

// Create the webhook server
const { server } = createWebhookServer(config);

// Start the server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`Codex Agent listening on port ${config.port} on 0.0.0.0`);
});