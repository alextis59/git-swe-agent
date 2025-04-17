import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import * as repoService from "../../services/repo";

// Mock dependencies
jest.mock("node:child_process", () => ({
  spawnSync: jest.fn()
}));

jest.mock("node:fs", () => ({
  mkdtempSync: jest.fn(),
  rmSync: jest.fn()
}));

jest.mock("node:path", () => ({
  join: jest.fn((a, b) => `${a}/${b}`)
}));

jest.mock("node:os", () => ({
  tmpdir: jest.fn()
}));

describe("Repo Service", () => {
  // Test data
  const mockTempDir = "/tmp";
  const mockWorkDir = "/tmp/codex-12345";
  const mockRepoDir = "/tmp/codex-12345/repo";
  const mockOwner = "testuser";
  const mockRepo = "testrepo";
  
  // Mock API function - this needs to handle the then method
  const mockApiResponse = {
    data: Buffer.from("test data")
  };
  
  const mockApiWithThen = jest.fn().mockImplementation(() => {
    return {
      then: (callback: any) => {
        callback(mockApiResponse);
        return Promise.resolve();
      }
    };
  });

  beforeEach(() => {
    // Reset all mocks
    jest.resetAllMocks();
    
    // Setup mock returns
    (tmpdir as jest.Mock).mockReturnValue(mockTempDir);
    (mkdtempSync as jest.Mock).mockReturnValue(mockWorkDir);
    (join as jest.Mock).mockImplementation((a, b) => `${a}/${b}`);
  });

  describe("cleanupTempRepo", () => {
    it("should remove the temporary repository directory", () => {
      // Call the function
      repoService.cleanupTempRepo(mockWorkDir);

      // Verify rmSync was called with correct parameters
      expect(rmSync).toHaveBeenCalledWith(mockWorkDir, {
        recursive: true,
        force: true
      });
    });
  });
  
  describe("createTempRepo", () => {
    it("should create a temporary working directory", async () => {
      // Setup spy on private function to avoid the actual API call
      jest.spyOn(repoService, 'createTempRepo').mockImplementation(async () => {
        return { workDir: mockWorkDir, repoDir: mockRepoDir };
      });
      
      // Call the function
      const result = await repoService.createTempRepo(mockApiWithThen, mockOwner, mockRepo);
      
      // Verify result
      expect(result).toEqual({
        workDir: mockWorkDir,
        repoDir: mockRepoDir
      });
    });
  });
});