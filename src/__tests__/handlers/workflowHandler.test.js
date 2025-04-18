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

describe("Workflow Handler", () => {
  // Store imported modules and functions
  let mockHandleWorkflowRun;
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
  
  const mockWorkflowRunId = 123;
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
    
    mockHandleWorkflowRun = mockHandlers.mockHandleWorkflowRun;
    createOctokitClient = octokit.createOctokitClient;
    runCodex = codex.runCodex;
    
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    mockCreateOctokitClient.mockResolvedValue(mockApi);
    mockRunCodex.mockReturnValue("Diagnosed issue: Test failed due to missing dependency");
  });

  it("should skip processing if workflow run did not fail", async () => {
    // Create mock payload with non-failure conclusion
    const mockPayload = {
      workflow_run: { 
        id: mockWorkflowRunId, 
        conclusion: "success" 
      },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleWorkflowRun(mockPayload, mockConfig);

    // Verify no further processing was done
    expect(mockCreateOctokitClient).not.toHaveBeenCalled();
    expect(mockRunCodex).not.toHaveBeenCalled();
    expect(mockApi).not.toHaveBeenCalled();
  });

  it("should process failed workflow runs and create an issue", async () => {
    // Create mock payload with failure conclusion
    const mockPayload = {
      workflow_run: { 
        id: mockWorkflowRunId, 
        conclusion: "failure" 
      },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleWorkflowRun(mockPayload, mockConfig);

    // Verify Octokit client was created
    expect(mockCreateOctokitClient).toHaveBeenCalledWith(mockConfig, mockInstallationId);

    // Verify codex was run with the logs
    expect(mockRunCodex).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("A CI run failed, diagnose briefly:"),
      mockConfig.openaiApiKey
    );

    // Verify the issue was created
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/issues",
      {
        owner: mockOwner,
        repo: mockRepo,
        title: `CI failed – run #${mockWorkflowRunId}`,
        body: "Diagnosed issue: Test failed due to missing dependency",
        labels: ["pipeline-failure"]
      }
    );
  });

  it("should use the diagnosis from Codex in the issue", async () => {
    // Custom diagnosis
    const mockDiagnosis = "The build is failing because of a syntax error in file X";
    mockRunCodex.mockReturnValue(mockDiagnosis);
    
    // Create mock payload with failure conclusion
    const mockPayload = {
      workflow_run: { 
        id: mockWorkflowRunId, 
        conclusion: "failure" 
      },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleWorkflowRun(mockPayload, mockConfig);

    // Verify the issue was created with the diagnosis in the body
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/issues",
      expect.objectContaining({
        body: mockDiagnosis
      })
    );
  });
});