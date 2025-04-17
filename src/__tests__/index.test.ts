import { loadConfig } from "../utils/config";
import { createWebhookServer } from "../app";

// Mock the module dependencies
jest.mock("../utils/config", () => ({
  loadConfig: jest.fn()
}));

jest.mock("../app", () => ({
  createWebhookServer: jest.fn()
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
    listen: jest.fn().mockImplementation((port, callback) => {
      if (callback) callback();
      return mockServer;
    })
  };

  const mockWebhooks = {};

  beforeEach(() => {
    // Reset mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    (loadConfig as jest.Mock).mockReturnValue(mockConfig);
    (createWebhookServer as jest.Mock).mockReturnValue({ server: mockServer, webhooks: mockWebhooks });

    // Mock console.log
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    jest.restoreAllMocks();
  });

  it("should load config and start the server", () => {
    // Reset module registry for index.ts
    jest.isolateModules(() => {
      // Mock console.log before importing
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      // Import the index module to test
      require("../index");
      
      // Verify config was loaded
      expect(loadConfig).toHaveBeenCalled();
      
      // Verify server was created with config
      expect(createWebhookServer).toHaveBeenCalledWith(mockConfig);
      
      // Verify the server was started with the correct port
      expect(mockServer.listen).toHaveBeenCalledWith(
        mockConfig.port,
        expect.any(Function)
      );
      
      // Execute the callback to ensure it gets called
      mockServer.listen.mock.calls[0][1]();
      
      // Verify the startup message was logged
      expect(consoleSpy).toHaveBeenCalledWith(`Codex Agent listening on port ${mockConfig.port}`);
      
      // Restore console.log
      consoleSpy.mockRestore();
    });
  });
});