import { mockHandleWorkflowRun } from "../__mocks__/handlers";
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

describe("Workflow Handler", () => {
  // Test data
  const mockConfig: AppConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  
  const mockRunId = 12345;
  const mockRepoFullName = "testuser/testrepo";
  const mockOwner = "testuser";
  const mockRepo = "testrepo";
  const mockInstallationId = 456;
  const mockDiagnosis = "The build failed because of syntax error in file.js";

  // Mock API function
  const mockApi = jest.fn();

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    (createOctokitClient as jest.Mock).mockResolvedValue(mockApi);
    (runCodex as jest.Mock).mockReturnValue(mockDiagnosis);
  });

  it("should skip processing if workflow run conclusion is not 'failure'", async () => {
    // Create mock payload with non-failure conclusion
    const mockPayload = {
      workflow_run: { 
        id: mockRunId,
        conclusion: "success" 
      },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleWorkflowRun(mockPayload, mockConfig);

    // Verify no further processing was done
    expect(createOctokitClient).not.toHaveBeenCalled();
    expect(runCodex).not.toHaveBeenCalled();
  });

  it("should create an issue for a failed workflow run", async () => {
    // Create mock payload with failure conclusion
    const mockPayload = {
      workflow_run: { 
        id: mockRunId,
        conclusion: "failure" 
      },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleWorkflowRun(mockPayload, mockConfig);

    // Verify Octokit client was created
    expect(createOctokitClient).toHaveBeenCalledWith(mockConfig, mockInstallationId);

    // Verify codex was run with logs content
    expect(runCodex).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining("A CI run failed, diagnose briefly:"),
      mockConfig.openaiApiKey
    );

    // Verify an issue was created with the diagnosis
    expect(mockApi).toHaveBeenCalledWith(
      "POST /repos/{owner}/{repo}/issues",
      {
        owner: mockOwner,
        repo: mockRepo,
        title: `CI failed – run #${mockRunId}`,
        body: mockDiagnosis,
        labels: ["pipeline-failure"]
      }
    );
  });

  it("should handle large log files by truncating them", async () => {
    // Create mock payload
    const mockPayload = {
      workflow_run: { 
        id: mockRunId,
        conclusion: "failure" 
      },
      repository: { full_name: mockRepoFullName },
      installation: { id: mockInstallationId }
    };

    // Call the function
    await mockHandleWorkflowRun(mockPayload, mockConfig);

    // Verify codex was called with logs truncated to 50000 characters
    const codexCalls = (runCodex as jest.Mock).mock.calls;
    expect(codexCalls.length).toBe(1);
    
    const promptArg = codexCalls[0][1];
    expect(promptArg).toMatch(/^A CI run failed, diagnose briefly:/);
  });
});