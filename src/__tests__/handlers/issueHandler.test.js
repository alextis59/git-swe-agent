import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Create mock functions
const mockCreateOctokitClient = jest.fn();
const mockRunCodex = jest.fn();
const mockCreateTempRepo = jest.fn();
const mockCleanupTempRepo = jest.fn();
const mockConfigureGit = jest.fn();
const mockCreateBranch = jest.fn();
const mockStageAllChanges = jest.fn();
const mockHasChanges = jest.fn();
const mockCommitChanges = jest.fn();
const mockPushChanges = jest.fn();

// Use unstable_mockModule for ESM compatibility
jest.unstable_mockModule("../../services/octokit.js", () => {
  return {
    createOctokitClient: mockCreateOctokitClient
  };
});

jest.unstable_mockModule("../../services/codex.js", () => {
  return {
    runCodex: mockRunCodex
  };
});

jest.unstable_mockModule("../../services/repo.js", () => {
  return {
    createTempRepo: mockCreateTempRepo,
    cleanupTempRepo: mockCleanupTempRepo
  };
});

jest.unstable_mockModule("../../services/git.js", () => {
  return {
    configureGit: mockConfigureGit,
    createBranch: mockCreateBranch,
    stageAllChanges: mockStageAllChanges,
    hasChanges: mockHasChanges,
    commitChanges: mockCommitChanges,
    pushChanges: mockPushChanges
  };
});

// Dynamic imports
const mockHandlersPromise = import("..//__mocks__/handlers.js");
const octokitPromise = import("../../services/octokit.js");
const codexPromise = import("../../services/codex.js");
const repoPromise = import("../../services/repo.js");
const gitPromise = import("../../services/git.js");

describe("Issue Handler", () => {
  // Store imported modules and functions
  let mockHandleLabeledIssue;
  let createOctokitClient;
  let runCodex;
  let createTempRepo;
  let cleanupTempRepo;
  let configureGit;
  let createBranch;
  let stageAllChanges;
  let hasChanges;
  let commitChanges;
  let pushChanges;

  // Test data
  const mockConfig = {
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

  beforeEach(async () => {
    // Extract functions from imported modules
    const mockHandlers = await mockHandlersPromise;
    const octokit = await octokitPromise;
    const codex = await codexPromise;
    const repo = await repoPromise;
    const git = await gitPromise;
    
    mockHandleLabeledIssue = mockHandlers.mockHandleLabeledIssue;
    createOctokitClient = octokit.createOctokitClient;
    runCodex = codex.runCodex;
    createTempRepo = repo.createTempRepo;
    cleanupTempRepo = repo.cleanupTempRepo;
    configureGit = git.configureGit;
    createBranch = git.createBranch;
    stageAllChanges = git.stageAllChanges;
    hasChanges = git.hasChanges;
    commitChanges = git.commitChanges;
    pushChanges = git.pushChanges;
    
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    mockCreateOctokitClient.mockResolvedValue(mockApi);
    mockCreateTempRepo.mockResolvedValue({ workDir: mockWorkDir, repoDir: mockRepoDir });
    mockHasChanges.mockReturnValue(true);
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
    expect(mockCreateOctokitClient).not.toHaveBeenCalled();
    expect(mockCreateTempRepo).not.toHaveBeenCalled();
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
    expect(mockCreateOctokitClient).toHaveBeenCalledWith(mockConfig, mockInstallationId);

    // Verify temp repo was created
    expect(mockCreateTempRepo).toHaveBeenCalledWith(mockApi, mockOwner, mockRepo);

    // Verify codex was run
    expect(mockRunCodex).toHaveBeenCalledWith(mockRepoDir, mockIssueBody, mockConfig.openaiApiKey);

    // Verify git operations
    expect(mockConfigureGit).toHaveBeenCalledWith(mockRepoDir);
    expect(mockCreateBranch).toHaveBeenCalledWith(mockRepoDir, mockBranchName);
    expect(mockStageAllChanges).toHaveBeenCalledWith(mockRepoDir);
    expect(mockHasChanges).toHaveBeenCalledWith(mockRepoDir);
    expect(mockCommitChanges).toHaveBeenCalledWith(mockRepoDir, `Codex changes for #${mockIssueNumber}`);

    // Verify changes were pushed
    expect(mockPushChanges).toHaveBeenCalledWith(
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
    expect(mockCleanupTempRepo).toHaveBeenCalledWith(mockWorkDir);
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
    mockHasChanges.mockReturnValue(false);

    // Call the function
    await mockHandleLabeledIssue(mockPayload, mockConfig);

    // Verify basic steps were taken
    expect(mockRunCodex).toHaveBeenCalled();
    expect(mockStageAllChanges).toHaveBeenCalled();
    expect(mockHasChanges).toHaveBeenCalled();

    // Verify no further actions were taken
    expect(mockCommitChanges).not.toHaveBeenCalled();
    expect(mockPushChanges).not.toHaveBeenCalled();
    expect(mockApi).not.toHaveBeenCalledWith("POST /repos/{owner}/{repo}/pulls", expect.anything());

    // Verify cleanup was still done
    expect(mockCleanupTempRepo).toHaveBeenCalledWith(mockWorkDir);
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
    expect(mockRunCodex).toHaveBeenCalledWith(mockRepoDir, "solve this issue", mockConfig.openaiApiKey);
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
    mockRunCodex.mockImplementation(() => {
      throw new Error("Test error");
    });

    // Call the function and catch the error
    await expect(mockHandleLabeledIssue(mockPayload, mockConfig)).rejects.toThrow("Test error");

    // Verify cleanup was still done
    expect(mockCleanupTempRepo).toHaveBeenCalledWith(mockWorkDir);
  });
});