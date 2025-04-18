import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Create mock functions
const mockCreateOctokitClient = jest.fn();
const mockRunCodex = jest.fn();

// Mock dependencies using unstable_mockModule
jest.unstable_mockModule("../../services/octokit.js", () => ({
  createOctokitClient: mockCreateOctokitClient
}));

jest.unstable_mockModule("../../services/codex.js", () => ({
  runCodex: mockRunCodex
}));

// Dynamic imports
const mockHandlersPromise = import("../__mocks__/handlers.js");
const octokitPromise = import("../../services/octokit.js");
const codexPromise = import("../../services/codex.js");

describe("Pull Request Handler", () => {
  // Store imported modules and functions
  let mockHandlePullRequest;
  let createOctokitClient;
  let runCodex;
  
  // Test data
  const mockConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  
  const mockPrNumber = 123;
  const mockDiffUrl = "https://github.com/testuser/testrepo/pull/123.diff";
  const mockRepoFullName = "testuser/testrepo";
  const mockOwner = "testuser";
  const mockRepo = "testrepo";
  const mockInstallationId = 456;

  // Mock API function
  const mockApi = jest.fn();

  beforeEach(async () => {
    // Extract functions from imported modules
    const mockHandlers = await mockHandlersPromise;
    const octokit = await octokitPromise;
    const codex = await codexPromise;
    
    mockHandlePullRequest = mockHandlers.mockHandlePullRequest;
    createOctokitClient = octokit.createOctokitClient;
    runCodex = codex.runCodex;
    
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    mockCreateOctokitClient.mockResolvedValue(mockApi);
  });

  it("should approve PR if Codex outputs 'APPROVE'", async () => {
    // Setup mocks
    mockRunCodex.mockReturnValue("APPROVE");
    
    // Create mock payload
    const mockPayload = {
      pull_request: { number: mockPrNumber, diff_url: mockDiffUrl },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandlePullRequest(mockPayload, mockConfig);

    // Verify Octokit client was created
    expect(mockCreateOctokitClient).toHaveBeenCalledWith(mockConfig, mockInstallationId);

    // Verify codex was run with the diff
    expect(mockRunCodex).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("Review this diff and reply \"APPROVE\" if perfect:"),
      mockConfig.openaiApiKey
    );

    // Verify the approval review was posted
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      {
        owner: mockOwner,
        repo: mockRepo,
        pull_number: mockPrNumber,
        event: "APPROVE",
        body: "✅ LGTM – approved by Codex."
      }
    );
  });

  it("should comment on PR if Codex does not output 'APPROVE'", async () => {
    // Setup mocks - Codex returns a review with suggestions
    const mockReview = "Here are some suggestions to improve your code...";
    mockRunCodex.mockReturnValue(mockReview);
    
    // Create mock payload
    const mockPayload = {
      pull_request: { number: mockPrNumber, diff_url: mockDiffUrl },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandlePullRequest(mockPayload, mockConfig);

    // Verify codex was run
    expect(mockRunCodex).toHaveBeenCalled();

    // Verify a comment review was posted with the Codex output
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      {
        owner: mockOwner,
        repo: mockRepo,
        pull_number: mockPrNumber,
        body: mockReview,
        event: "COMMENT"
      }
    );
  });

  it("should trim the Codex output when checking for 'APPROVE'", async () => {
    // Setup mocks - Codex returns APPROVE with whitespace
    mockRunCodex.mockReturnValue("  APPROVE  ");
    
    // Create mock payload
    const mockPayload = {
      pull_request: { number: mockPrNumber, diff_url: mockDiffUrl },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandlePullRequest(mockPayload, mockConfig);

    // Verify an approval was posted (not a comment)
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews",
      expect.objectContaining({
        event: "APPROVE"
      })
    );
  });
});