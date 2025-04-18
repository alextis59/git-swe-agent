import { loadConfig } from "./utils/config.js";
import { createWebhookServer } from "./app.js";

// Log environment variables for debugging
console.log("Environment PORT:", process.env.PORT);

// Load application configuration
const config = loadConfig();

// Log the resolved port
console.log("Using port:", config.port);

// Create the webhook server
const { server } = createWebhookServer(config);

// Start the server
server.listen(config.port, '0.0.0.0', () => {
  console.log(`Codex Agent listening on port ${config.port} on 0.0.0.0`);
});