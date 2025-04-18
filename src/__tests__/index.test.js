import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define mock functions
const mockLoadConfig = jest.fn();
const mockCreateWebhookServer = jest.fn();
const mockListen = jest.fn();
const mockConsoleLog = jest.fn();

// Use absolute paths for local modules
const configPath = path.resolve(__dirname, "../utils/config.js");
const appPath = path.resolve(__dirname, "../app.js");
const indexPath = path.resolve(__dirname, "../index.js");

// Mock the module dependencies
jest.unstable_mockModule(configPath, () => ({
  loadConfig: mockLoadConfig
}));

jest.unstable_mockModule(appPath, () => ({
  createWebhookServer: mockCreateWebhookServer
}));

describe("Application Entry Point", () => {
  // Test data
  const mockConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  
  const mockServer = {
    listen: mockListen.mockImplementation((port, callback) => {
      if (callback) callback();
      return mockServer;
    })
  };

  const mockWebhooks = {};

  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    mockLoadConfig.mockReturnValue(mockConfig);
    mockCreateWebhookServer.mockReturnValue({ server: mockServer, webhooks: mockWebhooks });

    // Mock console.log
    jest.spyOn(console, "log").mockImplementation(mockConsoleLog);
  });

  afterEach(() => {
    // Restore console.log
    jest.restoreAllMocks();
  });

  it("should load config and start the server", async () => {
    // Reset module registry for index.js
    jest.isolateModules(async () => {
      // Import the index module to test
      await import(indexPath);
      
      // Verify config was loaded
      expect(mockLoadConfig).toHaveBeenCalled();
      
      // Verify server was created with config
      expect(mockCreateWebhookServer).toHaveBeenCalledWith(mockConfig);
      
      // Verify the server was started with the correct port
      expect(mockListen).toHaveBeenCalledWith(
        mockConfig.port,
        expect.any(Function)
      );
      
      // Execute the callback to ensure it gets called
      mockListen.mock.calls[0][1]();
      
      // Verify the startup message was logged
      expect(mockConsoleLog).toHaveBeenCalledWith(`Codex Agent listening on port ${mockConfig.port}`);
    });
  });
});