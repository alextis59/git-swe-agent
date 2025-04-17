import { mockHandlePullRequest } from "../__mocks__/handlers";
import { createOctokitClient } from "../../services/octokit";
import { runCodex } from "../../services/codex";
import { AppConfig } from "../../types";

// Mock dependencies
jest.mock("../../services/octokit", () => ({
  createOctokitClient: jest.fn()
}));

jest.mock("../../services/codex", () => ({
  runCodex: jest.fn()
}));

describe("Pull Request Handler", () => {
  // Test data
  const mockConfig: AppConfig = {
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

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    (createOctokitClient as jest.Mock).mockResolvedValue(mockApi);
  });

  it("should approve PR if Codex outputs 'APPROVE'", async () => {
    // Setup mocks
    (runCodex as jest.Mock).mockReturnValue("APPROVE");
    
    // Create mock payload
    const mockPayload = {
      pull_request: { number: mockPrNumber, diff_url: mockDiffUrl },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandlePullRequest(mockPayload, mockConfig);

    // Verify Octokit client was created
    expect(createOctokitClient).toHaveBeenCalledWith(mockConfig, mockInstallationId);

    // Verify codex was run with the diff
    expect(runCodex).toHaveBeenCalledWith(
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
    (runCodex as jest.Mock).mockReturnValue(mockReview);
    
    // Create mock payload
    const mockPayload = {
      pull_request: { number: mockPrNumber, diff_url: mockDiffUrl },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandlePullRequest(mockPayload, mockConfig);

    // Verify codex was run
    expect(runCodex).toHaveBeenCalled();

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
    (runCodex as jest.Mock).mockReturnValue("  APPROVE  ");
    
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