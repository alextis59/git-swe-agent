import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import path from "path";
import { fileURLToPath } from "url";

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define mock functions
const mockWebhooks = {
  on: jest.fn()
};

const mockCreateNodeMiddleware = jest.fn();
const mockWebhooksConstructor = jest.fn(() => mockWebhooks);
const mockCreateServer = jest.fn();
const mockHandleLabeledIssue = jest.fn();
const mockHandlePullRequest = jest.fn();
const mockHandleWorkflowRun = jest.fn();

// Mock dependencies
jest.unstable_mockModule("@octokit/webhooks", () => ({
  Webhooks: mockWebhooksConstructor,
  createNodeMiddleware: mockCreateNodeMiddleware
}));

// Create a separate module mock resolver for node:http since it's imported as default
const httpMock = {
  createServer: mockCreateServer
};

// Use custom resolver for http
jest.unstable_mockModule("node:http", () => {
  return { default: httpMock };
});

// Use absolute paths for local modules
const appPath = path.resolve(__dirname, "../app.js");
const issueHandlerPath = path.resolve(__dirname, "../handlers/issueHandler.js");
const prHandlerPath = path.resolve(__dirname, "../handlers/pullRequestHandler.js");
const workflowHandlerPath = path.resolve(__dirname, "../handlers/workflowHandler.js");

// Mock local handlers
jest.unstable_mockModule(issueHandlerPath, () => ({
  handleLabeledIssue: mockHandleLabeledIssue
}));

jest.unstable_mockModule(prHandlerPath, () => ({
  handlePullRequest: mockHandlePullRequest
}));

jest.unstable_mockModule(workflowHandlerPath, () => ({
  handleWorkflowRun: mockHandleWorkflowRun
}));

// Import the module under test
const appModulePromise = import(appPath);

describe("App", () => {
  let createWebhookServer;
  
  // Test data
  const mockConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  
  // Mock objects
  const mockServer = {
    listen: jest.fn()
  };
  
  const mockMiddleware = "mock-middleware";

  beforeEach(async () => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    mockWebhooksConstructor.mockReturnValue(mockWebhooks);
    mockCreateNodeMiddleware.mockReturnValue(mockMiddleware);
    mockCreateServer.mockReturnValue(mockServer);
    
    // Import the module functions
    const appModule = await appModulePromise;
    createWebhookServer = appModule.createWebhookServer;
  });

  it("should create and configure a webhook server", async () => {
    // Call the function
    const result = createWebhookServer(mockConfig);

    // Verify Webhooks was created with correct secret
    expect(mockWebhooksConstructor).toHaveBeenCalledWith({
      secret: mockConfig.webhookSecret
    });

    // Verify event handlers were registered
    expect(mockWebhooks.on).toHaveBeenCalledTimes(3);
    
    // Check issues.labeled handler
    expect(mockWebhooks.on).toHaveBeenCalledWith(
      "issues.labeled",
      expect.any(Function)
    );
    
    // Check pull request events
    expect(mockWebhooks.on).toHaveBeenCalledWith(
      ["pull_request.opened", "pull_request.synchronize"],
      expect.any(Function)
    );
    
    // Check workflow events
    expect(mockWebhooks.on).toHaveBeenCalledWith(
      "workflow_run.completed",
      expect.any(Function)
    );

    // Verify middleware was created
    expect(mockCreateNodeMiddleware).toHaveBeenCalledWith(mockWebhooks);

    // Verify HTTP server was created with middleware
    expect(mockCreateServer).toHaveBeenCalledWith(mockMiddleware);

    // Verify correct result is returned
    expect(result).toEqual({
      server: mockServer,
      webhooks: mockWebhooks
    });
  });

  it("should call handleLabeledIssue when issues.labeled event is triggered", async () => {
    // Create the server
    createWebhookServer(mockConfig);

    // Extract the handler function for issues.labeled
    const issuesHandler = mockWebhooks.on.mock.calls.find(
      call => call[0] === "issues.labeled"
    )[1];

    // Mock event payload
    const mockPayload = { some: "data" };
    const mockEvent = { payload: mockPayload };

    // Call the handler
    await issuesHandler(mockEvent);

    // Verify handler was called with correct parameters
    expect(mockHandleLabeledIssue).toHaveBeenCalledWith(mockPayload, mockConfig);
  });

  it("should call handlePullRequest when pull_request events are triggered", async () => {
    // Create the server
    createWebhookServer(mockConfig);

    // Extract the handler function for pull_request events
    const pullRequestHandler = mockWebhooks.on.mock.calls.find(
      call => Array.isArray(call[0]) && call[0].includes("pull_request.opened")
    )[1];

    // Mock event payload
    const mockPayload = { some: "data" };
    const mockEvent = { payload: mockPayload };

    // Call the handler
    await pullRequestHandler(mockEvent);

    // Verify handler was called with correct parameters
    expect(mockHandlePullRequest).toHaveBeenCalledWith(mockPayload, mockConfig);
  });

  it("should call handleWorkflowRun when workflow_run.completed event is triggered", async () => {
    // Create the server
    createWebhookServer(mockConfig);

    // Extract the handler function for workflow_run events
    const workflowHandler = mockWebhooks.on.mock.calls.find(
      call => call[0] === "workflow_run.completed"
    )[1];

    // Mock event payload
    const mockPayload = { some: "data" };
    const mockEvent = { payload: mockPayload };

    // Call the handler
    await workflowHandler(mockEvent);

    // Verify handler was called with correct parameters
    expect(mockHandleWorkflowRun).toHaveBeenCalledWith(mockPayload, mockConfig);
  });
});