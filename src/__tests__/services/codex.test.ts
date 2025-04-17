import { spawnSync } from "node:child_process";
import { runCodex } from "../../services/codex";

// Mock the spawnSync function
jest.mock("node:child_process", () => ({
  spawnSync: jest.fn()
}));

describe("Codex Service", () => {
  beforeEach(() => {
    // Reset the mock before each test
    jest.resetAllMocks();
  });

  it("should call codex with the correct parameters", () => {
    // Setup mock return value
    const mockOutput = "Mocked codex output";
    (spawnSync as jest.Mock).mockReturnValue({
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