import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Create mock functions
const mockDefaults = jest.fn();
const mockCreateAppAuth = jest.fn();

// Use unstable_mockModule for ESM compatibility
jest.unstable_mockModule("@octokit/request", () => {
  return {
    request: {
      defaults: mockDefaults
    }
  };
});

jest.unstable_mockModule("@octokit/auth-app", () => {
  return {
    createAppAuth: mockCreateAppAuth
  };
});

// Dynamic imports
const requestPromise = import("@octokit/request");
const authAppPromise = import("@octokit/auth-app");
const octokitServicePromise = import("../../services/octokit.js");

describe("Octokit Service", () => {
  // Store imported modules and functions
  let request;
  let createAppAuth;
  let createOctokitClient;

  // Test data
  const mockConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  const mockInstallationId = 12345;
  const mockAuthHook = {};

  beforeEach(async () => {
    // Extract functions from imported modules
    const requestModule = await requestPromise;
    const authAppModule = await authAppPromise;
    const octokitService = await octokitServicePromise;
    
    request = requestModule.request;
    createAppAuth = authAppModule.createAppAuth;
    createOctokitClient = octokitService.createOctokitClient;
    
    // Reset mocks before each test
    jest.resetAllMocks();
    
    // Setup mock returns
    mockCreateAppAuth.mockReturnValue(mockAuthHook);
    mockDefaults.mockReturnValue("mocked-octokit-client");
  });

  it("should create an Octokit client with the correct configuration", async () => {
    // Call the function
    const result = await createOctokitClient(mockConfig, mockInstallationId);

    // Verify createAppAuth was called with correct parameters
    expect(mockCreateAppAuth).toHaveBeenCalledWith({
      appId: mockConfig.appId,
      privateKey: mockConfig.privateKey,
      installationId: mockInstallationId
    });

    // Verify request.defaults was called with the auth hook
    expect(mockDefaults).toHaveBeenCalledWith({
      request: { hook: mockAuthHook }
    });

    // Verify result is the mocked client
    expect(result).toBe("mocked-octokit-client");
  });
});