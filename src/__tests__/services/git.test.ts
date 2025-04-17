import { spawnSync } from "node:child_process";
import {
  configureGit,
  createBranch,
  stageAllChanges,
  hasChanges,
  commitChanges,
  pushChanges
} from "../../services/git";

// Mock the spawnSync function
jest.mock("node:child_process", () => ({
  spawnSync: jest.fn()
}));

describe("Git Service", () => {
  const mockRepoDir = "/test/repo/path";
  const mockBranchName = "test-branch";
  const mockRepoUrl = "https://test-url.git";
  const mockCommitMessage = "Test commit message";

  beforeEach(() => {
    // Reset all mocks before each test
    jest.resetAllMocks();
  });

  describe("configureGit", () => {
    it("should configure git user email and name", () => {
      // Call the function
      configureGit(mockRepoDir);

      // Verify the spawnSync calls
      expect(spawnSync).toHaveBeenCalledTimes(2);
      expect(spawnSync).toHaveBeenNthCalledWith(
        1, 
        "git", 
        ["config", "--global", "user.email", "codex@app"], 
        { cwd: mockRepoDir }
      );
      expect(spawnSync).toHaveBeenNthCalledWith(
        2, 
        "git", 
        ["config", "--global", "user.name", "Codex Agent"], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("createBranch", () => {
    it("should create a new git branch", () => {
      // Call the function
      createBranch(mockRepoDir, mockBranchName);

      // Verify the spawnSync call
      expect(spawnSync).toHaveBeenCalledWith(
        "git", 
        ["checkout", "-b", mockBranchName], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("stageAllChanges", () => {
    it("should stage all changes in the repo", () => {
      // Call the function
      stageAllChanges(mockRepoDir);

      // Verify the spawnSync call
      expect(spawnSync).toHaveBeenCalledWith(
        "git", 
        ["add", "-A"], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("hasChanges", () => {
    it("should return true when there are staged changes", () => {
      // Setup mock to return status 1 (changes exist)
      (spawnSync as jest.Mock).mockReturnValue({ status: 1 });

      // Call the function
      const result = hasChanges(mockRepoDir);

      // Verify the result and spawnSync call
      expect(result).toBe(true);
      expect(spawnSync).toHaveBeenCalledWith(
        "git", 
        ["diff", "--cached", "--quiet"], 
        { cwd: mockRepoDir }
      );
    });

    it("should return false when there are no staged changes", () => {
      // Setup mock to return status 0 (no changes)
      (spawnSync as jest.Mock).mockReturnValue({ status: 0 });

      // Call the function
      const result = hasChanges(mockRepoDir);

      // Verify the result and spawnSync call
      expect(result).toBe(false);
      expect(spawnSync).toHaveBeenCalledWith(
        "git", 
        ["diff", "--cached", "--quiet"], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("commitChanges", () => {
    it("should commit changes with the provided message", () => {
      // Call the function
      commitChanges(mockRepoDir, mockCommitMessage);

      // Verify the spawnSync call
      expect(spawnSync).toHaveBeenCalledWith(
        "git", 
        ["commit", "-m", mockCommitMessage], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("pushChanges", () => {
    it("should push changes to the remote repo", () => {
      // Call the function
      pushChanges(mockRepoDir, mockRepoUrl, mockBranchName);

      // Verify the spawnSync call
      expect(spawnSync).toHaveBeenCalledWith(
        "git", 
        ["push", "--force", mockRepoUrl, `HEAD:${mockBranchName}`], 
        { cwd: mockRepoDir }
      );
    });
  });
});