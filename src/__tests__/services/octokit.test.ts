import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";
import { createOctokitClient } from "../../services/octokit";
import { AppConfig } from "../../types";

// Mock dependencies
jest.mock("@octokit/request", () => ({
  request: {
    defaults: jest.fn()
  }
}));

jest.mock("@octokit/auth-app", () => ({
  createAppAuth: jest.fn()
}));

describe("Octokit Service", () => {
  // Test data
  const mockConfig: AppConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  const mockInstallationId = 12345;
  const mockAuthHook = {};

  beforeEach(() => {
    // Reset mocks before each test
    jest.resetAllMocks();
    
    // Setup mock returns
    (createAppAuth as jest.Mock).mockReturnValue(mockAuthHook);
    (request.defaults as jest.Mock).mockReturnValue("mocked-octokit-client");
  });

  it("should create an Octokit client with the correct configuration", async () => {
    // Call the function
    const result = await createOctokitClient(mockConfig, mockInstallationId);

    // Verify createAppAuth was called with correct parameters
    expect(createAppAuth).toHaveBeenCalledWith({
      appId: mockConfig.appId,
      privateKey: mockConfig.privateKey,
      installationId: mockInstallationId
    });

    // Verify request.defaults was called with the auth hook
    expect(request.defaults).toHaveBeenCalledWith({
      request: { hook: mockAuthHook }
    });

    // Verify result is the mocked client
    expect(result).toBe("mocked-octokit-client");
  });
});