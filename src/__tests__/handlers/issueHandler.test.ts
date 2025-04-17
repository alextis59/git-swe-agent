import { mockHandleLabeledIssue } from "../__mocks__/handlers";
import { createOctokitClient } from "../../services/octokit";
import { runCodex } from "../../services/codex";
import { createTempRepo, cleanupTempRepo } from "../../services/repo";
import { 
  configureGit, 
  createBranch, 
  stageAllChanges, 
  hasChanges, 
  commitChanges, 
  pushChanges 
} from "../../services/git";
import { AppConfig } from "../../types";

// Mock dependencies
jest.mock("../../services/octokit", () => ({
  createOctokitClient: jest.fn()
}));

jest.mock("../../services/codex", () => ({
  runCodex: jest.fn()
}));

jest.mock("../../services/repo", () => ({
  createTempRepo: jest.fn(),
  cleanupTempRepo: jest.fn()
}));

jest.mock("../../services/git", () => ({
  configureGit: jest.fn(),
  createBranch: jest.fn(),
  stageAllChanges: jest.fn(),
  hasChanges: jest.fn(),
  commitChanges: jest.fn(),
  pushChanges: jest.fn()
}));

describe("Issue Handler", () => {
  // Test data
  const mockConfig: AppConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  
  const mockIssueNumber = 123;
  const mockIssueTitle = "Test Issue";
  const mockIssueBody = "This is a test issue";
  const mockRepoFullName = "testuser/testrepo";
  const mockOwner = "testuser";
  const mockRepo = "testrepo";
  const mockInstallationId = 456;
  const mockToken = "mock-token";
  const mockWorkDir = "/tmp/codex-12345";
  const mockRepoDir = "/tmp/codex-12345/repo";
  const mockBranchName = `codex/issue-${mockIssueNumber}`;

  // Mock API function with proper structure
  const mockApi = jest.fn().mockImplementation(() => {
    return Promise.resolve({ data: {} });
  });

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    (createOctokitClient as jest.Mock).mockResolvedValue(mockApi);
    (createTempRepo as jest.Mock).mockResolvedValue({ workDir: mockWorkDir, repoDir: mockRepoDir });
    (hasChanges as jest.Mock).mockReturnValue(true);
  });

  it("should skip processing if label is not 'codex'", async () => {
    // Create mock payload with non-codex label
    const mockPayload = {
      label: { name: "not-codex" },
      issue: { number: mockIssueNumber, title: mockIssueTitle, body: mockIssueBody },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleLabeledIssue(mockPayload, mockConfig);

    // Verify no further processing was done
    expect(createOctokitClient).not.toHaveBeenCalled();
    expect(createTempRepo).not.toHaveBeenCalled();
  });

  it("should process an issue labeled with 'codex' and create a PR", async () => {
    // Create mock payload with codex label
    const mockPayload = {
      label: { name: "codex" },
      issue: { number: mockIssueNumber, title: mockIssueTitle, body: mockIssueBody },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleLabeledIssue(mockPayload, mockConfig);

    // Verify Octokit client was created
    expect(createOctokitClient).toHaveBeenCalledWith(mockConfig, mockInstallationId);

    // Verify temp repo was created
    expect(createTempRepo).toHaveBeenCalledWith(mockApi, mockOwner, mockRepo);

    // Verify codex was run
    expect(runCodex).toHaveBeenCalledWith(mockRepoDir, mockIssueBody, mockConfig.openaiApiKey);

    // Verify git operations
    expect(configureGit).toHaveBeenCalledWith(mockRepoDir);
    expect(createBranch).toHaveBeenCalledWith(mockRepoDir, mockBranchName);
    expect(stageAllChanges).toHaveBeenCalledWith(mockRepoDir);
    expect(hasChanges).toHaveBeenCalledWith(mockRepoDir);
    expect(commitChanges).toHaveBeenCalledWith(mockRepoDir, `Codex changes for #${mockIssueNumber}`);

    // Verify changes were pushed
    expect(pushChanges).toHaveBeenCalledWith(
      mockRepoDir, 
      expect.stringContaining("fake-token-for-testing"), 
      mockBranchName
    );

    // Verify PR was created
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/pulls",
      {
        owner: mockOwner,
        repo: mockRepo,
        head: mockBranchName,
        base: "main",
        title: `Codex: ${mockIssueTitle}`,
        body: `Closes #${mockIssueNumber}`
      }
    );

    // Verify cleanup was done
    expect(cleanupTempRepo).toHaveBeenCalledWith(mockWorkDir);
  });

  it("should not create a PR if there are no changes", async () => {
    // Create mock payload with codex label
    const mockPayload = {
      label: { name: "codex" },
      issue: { number: mockIssueNumber, title: mockIssueTitle, body: mockIssueBody },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Set hasChanges to return false
    (hasChanges as jest.Mock).mockReturnValue(false);

    // Call the function
    await mockHandleLabeledIssue(mockPayload, mockConfig);

    // Verify basic steps were taken
    expect(runCodex).toHaveBeenCalled();
    expect(stageAllChanges).toHaveBeenCalled();
    expect(hasChanges).toHaveBeenCalled();

    // Verify no further actions were taken
    expect(commitChanges).not.toHaveBeenCalled();
    expect(pushChanges).not.toHaveBeenCalled();
    expect(mockApi).not.toHaveBeenCalledWith("POST /repos/{owner}/{repo}/pulls", expect.anything());

    // Verify cleanup was still done
    expect(cleanupTempRepo).toHaveBeenCalledWith(mockWorkDir);
  });

  it("should use an empty string if issue body is null", async () => {
    // Create mock payload with null issue body
    const mockPayload = {
      label: { name: "codex" },
      issue: { number: mockIssueNumber, title: mockIssueTitle, body: null },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleLabeledIssue(mockPayload, mockConfig);

    // Verify codex was called with the default prompt
    expect(runCodex).toHaveBeenCalledWith(mockRepoDir, "solve this issue", mockConfig.openaiApiKey);
  });

  it("should ensure cleanup is done even if an error occurs", async () => {
    // Create mock payload
    const mockPayload = {
      label: { name: "codex" },
      issue: { number: mockIssueNumber, title: mockIssueTitle, body: mockIssueBody },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Make runCodex throw an error
    (runCodex as jest.Mock).mockImplementation(() => {
      throw new Error("Test error");
    });

    // Call the function and catch the error
    await expect(mockHandleLabeledIssue(mockPayload, mockConfig)).rejects.toThrow("Test error");

    // Verify cleanup was still done
    expect(cleanupTempRepo).toHaveBeenCalledWith(mockWorkDir);
  });
});