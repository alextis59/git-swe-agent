import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Creates a temporary working directory and clones the repository
 * @param {Object} api - Octokit API client
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Object>} Object containing workDir and repoDir paths
 */
export async function createTempRepo(api, owner, repo) {
  console.log(`Creating temporary repository for ${owner}/${repo}`);
  
  // Create temporary working directory
  const tempBase = join(tmpdir(), "codex-");
  console.log(`Using temp directory base: ${tempBase}`);
  
  const workDir = mkdtempSync(tempBase);
  console.log(`Created temp working directory: ${workDir}`);
  
  // Download repository contents
  console.log(`Downloading ${owner}/${repo} archive`);
  try {
    const startTime = Date.now();
    const response = await api("GET /repos/{owner}/{repo}/tarball", { 
      owner, 
      repo, 
      headers: { accept: "application/vnd.github+json" } 
    });
    
    const downloadDuration = (Date.now() - startTime) / 1000;
    console.log(`Downloaded repo archive (${response.data.length} bytes) in ${downloadDuration.toFixed(2)}s`);
    
    console.log(`Extracting archive to ${workDir}`);
    const extractStart = Date.now();
    const extractResult = spawnSync("tar", ["xz", "-C", workDir], { 
      input: Buffer.from(response.data) 
    });
    
    const extractDuration = (Date.now() - extractStart) / 1000;
    
    if (extractResult.error) {
      console.error(`Error extracting archive:`, extractResult.error);
      throw new Error(`Failed to extract repository archive: ${extractResult.error.message}`);
    }
    
    if (extractResult.status !== 0) {
      console.error(`tar command failed with status code ${extractResult.status}`);
      console.error(`stderr: ${extractResult.stderr?.toString()}`);
      throw new Error(`Failed to extract repository archive, tar exited with status ${extractResult.status}`);
    }
    
    console.log(`Repository extracted successfully in ${extractDuration.toFixed(2)}s`);
    
    // Check what we got and find the extracted directory name
    const lsResult = spawnSync("ls", ["-la", workDir]);
    let extractedDir = null;
    
    if (lsResult.stdout) {
      const output = lsResult.stdout.toString();
      console.log(`Files in temp directory:\n${output}`);
      
      // Find the directory that was extracted (usually in format owner-repo-hash)
      const dirRegex = new RegExp(`${owner}-${repo}-[a-f0-9]+`, 'i');
      const lines = output.split('\n');
      
      for (const line of lines) {
        const match = line.match(dirRegex);
        if (match) {
          extractedDir = match[0];
          console.log(`Found extracted directory: ${extractedDir}`);
          break;
        }
      }
    }
    
    // Use the extracted directory as our repo directory
    const repoDir = extractedDir ? join(workDir, extractedDir) : null;
    
    if (!repoDir || !existsSync(repoDir)) {
      console.error(`Could not find extracted repository directory`);
      throw new Error(`Repository extraction failed: could not find extracted directory`);
    }
    
    console.log(`Using repository directory: ${repoDir}`);
    return { workDir, repoDir };
    
  } catch (error) {
    console.error(`Error creating temporary repo:`, error);
    throw error;
  }
}

/**
 * Cleans up the temporary working directory
 * @param {string} workDir - Path to the temporary working directory
 */
export function cleanupTempRepo(workDir) {
  console.log(`Cleaning up temporary working directory: ${workDir}`);
  try {
    // Check what we'll be removing first (for debugging)
    const lsResult = spawnSync("ls", ["-la", workDir]);
    if (lsResult.stdout) {
      console.log(`Files to be removed:\n${lsResult.stdout.toString()}`);
    }
    
    rmSync(workDir, { recursive: true, force: true });
    console.log(`Successfully removed temporary directory ${workDir}`);
  } catch (error) {
    console.error(`Error cleaning up temporary directory ${workDir}:`, error);
    // Don't throw here, as this is cleanup code that shouldn't break anything else
  }
}