import { loadConfig } from "./utils/config.js";
import { createWebhookServer } from "./app.js";

// Load application configuration
const config = loadConfig();

// Create the webhook server
const { server } = createWebhookServer(config);

// Start the server
server.listen(config.port, () => {
  console.log(`Codex Agent listening on port ${config.port}`);
});