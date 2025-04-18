import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// Manual mock implementation for spawnSync
const mockSpawnSync = jest.fn();

// Mock implementation for child_process
jest.unstable_mockModule('node:child_process', () => ({
  spawnSync: mockSpawnSync,
}));

// Import the module that uses spawnSync
const gitServicePromise = import('../../services/git.js');

describe("Git Service", () => {
  let configureGit, createBranch, stageAllChanges, hasChanges, commitChanges, pushChanges;
  
  // Test data
  const mockRepoDir = "/test/repo/path";
  const mockBranchName = "test-branch";
  const mockRepoUrl = "https://test-url.git";
  const mockCommitMessage = "Test commit message";

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.resetAllMocks();
    
    // Import the module functions
    const gitService = await gitServicePromise;
    configureGit = gitService.configureGit;
    createBranch = gitService.createBranch;
    stageAllChanges = gitService.stageAllChanges;
    hasChanges = gitService.hasChanges;
    commitChanges = gitService.commitChanges;
    pushChanges = gitService.pushChanges;
  });

  describe("configureGit", () => {
    it("should configure git user email and name", async () => {
      // Call the function
      configureGit(mockRepoDir);

      // Verify the spawnSync calls
      expect(mockSpawnSync).toHaveBeenCalledTimes(2);
      expect(mockSpawnSync).toHaveBeenNthCalledWith(
        1, 
        "git", 
        ["config", "--global", "user.email", "codex@app"], 
        { cwd: mockRepoDir }
      );
      expect(mockSpawnSync).toHaveBeenNthCalledWith(
        2, 
        "git", 
        ["config", "--global", "user.name", "Codex Agent"], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("createBranch", () => {
    it("should create a new git branch", async () => {
      // Call the function
      createBranch(mockRepoDir, mockBranchName);

      // Verify the spawnSync call
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git", 
        ["checkout", "-b", mockBranchName], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("stageAllChanges", () => {
    it("should stage all changes in the repo", async () => {
      // Call the function
      stageAllChanges(mockRepoDir);

      // Verify the spawnSync call
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git", 
        ["add", "-A"], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("hasChanges", () => {
    it("should return true when there are staged changes", async () => {
      // Setup mock to return status 1 (changes exist)
      mockSpawnSync.mockReturnValue({ status: 1 });

      // Call the function
      const result = hasChanges(mockRepoDir);

      // Verify the result and spawnSync call
      expect(result).toBe(true);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git", 
        ["diff", "--cached", "--quiet"], 
        { cwd: mockRepoDir }
      );
    });

    it("should return false when there are no staged changes", async () => {
      // Setup mock to return status 0 (no changes)
      mockSpawnSync.mockReturnValue({ status: 0 });

      // Call the function
      const result = hasChanges(mockRepoDir);

      // Verify the result and spawnSync call
      expect(result).toBe(false);
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git", 
        ["diff", "--cached", "--quiet"], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("commitChanges", () => {
    it("should commit changes with the provided message", async () => {
      // Call the function
      commitChanges(mockRepoDir, mockCommitMessage);

      // Verify the spawnSync call
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git", 
        ["commit", "-m", mockCommitMessage], 
        { cwd: mockRepoDir }
      );
    });
  });

  describe("pushChanges", () => {
    it("should push changes to the remote repo", async () => {
      // Call the function
      pushChanges(mockRepoDir, mockRepoUrl, mockBranchName);

      // Verify the spawnSync call
      expect(mockSpawnSync).toHaveBeenCalledWith(
        "git", 
        ["push", "--force", mockRepoUrl, `HEAD:${mockBranchName}`], 
        { cwd: mockRepoDir }
      );
    });
  });
});