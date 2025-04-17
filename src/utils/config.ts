import { AppConfig } from '../types';

export function loadConfig(): AppConfig {
  const {
    APP_ID,
    PRIVATE_KEY,
    WEBHOOK_SECRET,
    OPENAI_API_KEY,
    PORT = "3000",
  } = process.env;

  if (!APP_ID || !PRIVATE_KEY || !WEBHOOK_SECRET || !OPENAI_API_KEY) {
    console.error("Missing environment variables");
    process.exit(1);
  }

  return {
    appId: APP_ID,
    privateKey: PRIVATE_KEY,
    webhookSecret: WEBHOOK_SECRET,
    openaiApiKey: OPENAI_API_KEY,
    port: +PORT,
  };
}