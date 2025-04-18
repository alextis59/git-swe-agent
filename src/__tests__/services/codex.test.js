import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Create mock functions
const mockSpawnSync = jest.fn();

// Use unstable_mockModule for ESM compatibility
jest.unstable_mockModule("node:child_process", () => {
  return {
    spawnSync: mockSpawnSync
  };
});

// Dynamic imports
const childProcessPromise = import("node:child_process");
const codexModulePromise = import("../../services/codex.js");

describe("Codex Service", () => {
  // Store imported modules and functions
  let spawnSync;
  let runCodex;

  beforeEach(async () => {
    // Extract functions from imported modules
    const childProcess = await childProcessPromise;
    const codexModule = await codexModulePromise;
    
    spawnSync = childProcess.spawnSync;
    runCodex = codexModule.runCodex;
    
    // Reset the mock before each test
    jest.resetAllMocks();
  });

  it("should call codex with the correct parameters", async () => {
    // Setup mock return value
    const mockOutput = "Mocked codex output";
    mockSpawnSync.mockReturnValue({
      stdout: mockOutput,
      stderr: ""
    });

    // Test data
    const cwd = "/test/path";
    const prompt = "test prompt";
    const apiKey = "test-api-key";

    // Call the function
    const result = runCodex(cwd, prompt, apiKey);

    // Assertions
    expect(spawnSync).toHaveBeenCalledWith(
      "codex",
      ["-q", "-a", "full-auto", prompt],
      expect.objectContaining({
        cwd,
        env: expect.objectContaining({ OPENAI_API_KEY: apiKey }),
        encoding: "utf8"
      })
    );
    expect(result).toBe(mockOutput);
  });
});