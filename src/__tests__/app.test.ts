import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import http from "http";
import { createWebhookServer } from "../app";
import { handleLabeledIssue } from "../handlers/issueHandler";
import { handlePullRequest } from "../handlers/pullRequestHandler";
import { handleWorkflowRun } from "../handlers/workflowHandler";
import { AppConfig } from "../types";

// Mock the required dependencies
jest.mock("@octokit/webhooks", () => ({
  Webhooks: jest.fn(),
  createNodeMiddleware: jest.fn()
}));

jest.mock("http", () => ({
  createServer: jest.fn()
}));

jest.mock("../handlers/issueHandler", () => ({
  handleLabeledIssue: jest.fn()
}));

jest.mock("../handlers/pullRequestHandler", () => ({
  handlePullRequest: jest.fn()
}));

jest.mock("../handlers/workflowHandler", () => ({
  handleWorkflowRun: jest.fn()
}));

describe("App", () => {
  // Test data
  const mockConfig: AppConfig = {
    appId: "test-app-id",
    privateKey: "test-private-key",
    webhookSecret: "test-webhook-secret",
    openaiApiKey: "test-api-key",
    port: 3000
  };
  
  // Mock objects
  const mockWebhooks = {
    on: jest.fn()
  };
  
  const mockServer = {
    listen: jest.fn()
  };
  
  const mockMiddleware = "mock-middleware";

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    (Webhooks as jest.Mock).mockReturnValue(mockWebhooks);
    (createNodeMiddleware as jest.Mock).mockReturnValue(mockMiddleware);
    (http.createServer as jest.Mock).mockReturnValue(mockServer);
  });

  it("should create and configure a webhook server", () => {
    // Call the function
    const result = createWebhookServer(mockConfig);

    // Verify Webhooks was created with correct secret
    expect(Webhooks).toHaveBeenCalledWith({
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
    expect(createNodeMiddleware).toHaveBeenCalledWith(mockWebhooks);

    // Verify HTTP server was created with middleware
    expect(http.createServer).toHaveBeenCalledWith(mockMiddleware);

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
    expect(handleLabeledIssue).toHaveBeenCalledWith(mockPayload, mockConfig);
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
    expect(handlePullRequest).toHaveBeenCalledWith(mockPayload, mockConfig);
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
    expect(handleWorkflowRun).toHaveBeenCalledWith(mockPayload, mockConfig);
  });
});