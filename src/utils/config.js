/**
 * Loads the application configuration from environment variables
 * @returns {import('../types/index.js').AppConfig} The application configuration
 */
export function loadConfig() {
  const {
    APP_ID,
    PRIVATE_KEY,
    WEBHOOK_SECRET,
    OPENAI_API_KEY,
    PORT,
  } = process.env;
  
  const port = PORT || "3000";

  if (!APP_ID || !PRIVATE_KEY || !WEBHOOK_SECRET || !OPENAI_API_KEY) {
    console.error("Missing environment variables");
    process.exit(1);
  }

  return {
    appId: APP_ID,
    privateKey: PRIVATE_KEY,
    webhookSecret: WEBHOOK_SECRET,
    openaiApiKey: OPENAI_API_KEY,
    port: +port,
  };
}