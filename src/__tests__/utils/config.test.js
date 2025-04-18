import { jest, describe, it, expect, beforeEach, afterEach, afterAll } from '@jest/globals';

// Dynamic import of the module being tested
const configModulePromise = import("../../utils/config.js");

describe("Config Utility", () => {
  // Store imported function
  let loadConfig;
  // Store original environment and console methods
  const originalEnv = { ...process.env };
  const originalExit = process.exit;
  const originalConsoleError = console.error;
  
  // Mock implementations
  const mockExit = jest.fn();
  const mockConsoleError = jest.fn();

  beforeEach(async () => {
    // Get the module and extract functions
    const configModule = await configModulePromise;
    loadConfig = configModule.loadConfig;
    
    // Reset environment to original state before each test
    process.env = { ...originalEnv };
    
    // Setup mocks
    process.exit = mockExit;
    console.error = mockConsoleError;
    
    // Clear mock call history
    mockExit.mockClear();
    mockConsoleError.mockClear();
  });

  afterEach(() => {
    // Restore original methods after each test
    process.exit = originalExit;
    console.error = originalConsoleError;
  });

  afterAll(() => {
    // Ensure environment is restored after all tests
    process.env = originalEnv;
  });

  it("should load configuration from environment variables", async () => {
    // Setup test environment variables
    process.env.APP_ID = "test-app-id";
    process.env.PRIVATE_KEY = "test-private-key";
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    process.env.PORT = "8080";

    // Call the function
    const config = loadConfig();

    // Verify the result
    expect(config).toEqual({
      appId: "test-app-id",
      privateKey: "test-private-key",
      webhookSecret: "test-webhook-secret",
      openaiApiKey: "test-openai-api-key",
      port: 8080
    });

    // Verify no errors occurred
    expect(mockExit).not.toHaveBeenCalled();
    expect(mockConsoleError).not.toHaveBeenCalled();
  });

  it("should use default port if PORT is not provided", async () => {
    // Setup test environment variables without PORT
    process.env.APP_ID = "test-app-id";
    process.env.PRIVATE_KEY = "test-private-key";
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    process.env.OPENAI_API_KEY = "test-openai-api-key";
    delete process.env.PORT;

    // Call the function
    const config = loadConfig();

    // Verify the result has default port
    expect(config.port).toBe(3000);
  });

  it("should exit with error if APP_ID is missing", async () => {
    // Setup environment with missing APP_ID
    delete process.env.APP_ID;
    process.env.PRIVATE_KEY = "test-private-key";
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    process.env.OPENAI_API_KEY = "test-openai-api-key";

    // Call the function
    loadConfig();

    // Verify error handling
    expect(mockConsoleError).toHaveBeenCalledWith("Missing environment variables");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if PRIVATE_KEY is missing", async () => {
    // Setup environment with missing PRIVATE_KEY
    process.env.APP_ID = "test-app-id";
    delete process.env.PRIVATE_KEY;
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    process.env.OPENAI_API_KEY = "test-openai-api-key";

    // Call the function
    loadConfig();

    // Verify error handling
    expect(mockConsoleError).toHaveBeenCalledWith("Missing environment variables");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if WEBHOOK_SECRET is missing", async () => {
    // Setup environment with missing WEBHOOK_SECRET
    process.env.APP_ID = "test-app-id";
    process.env.PRIVATE_KEY = "test-private-key";
    delete process.env.WEBHOOK_SECRET;
    process.env.OPENAI_API_KEY = "test-openai-api-key";

    // Call the function
    loadConfig();

    // Verify error handling
    expect(mockConsoleError).toHaveBeenCalledWith("Missing environment variables");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("should exit with error if OPENAI_API_KEY is missing", async () => {
    // Setup environment with missing OPENAI_API_KEY
    process.env.APP_ID = "test-app-id";
    process.env.PRIVATE_KEY = "test-private-key";
    process.env.WEBHOOK_SECRET = "test-webhook-secret";
    delete process.env.OPENAI_API_KEY;

    // Call the function
    loadConfig();

    // Verify error handling
    expect(mockConsoleError).toHaveBeenCalledWith("Missing environment variables");
    expect(mockExit).toHaveBeenCalledWith(1);
  });
});