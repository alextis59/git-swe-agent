import { Webhooks, createNodeMiddleware } from "@octokit/webhooks";
import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import http from "node:http";

const {
  APP_ID,
  PRIVATE_KEY,
  WEBHOOK_SECRET,
  OPENAI_API_KEY,
  PORT = "3000",
} = process.env;

if (!APP_ID || !PRIVATE_KEY || !WEBHOOK_SECRET || !OPENAI_API_KEY) {
  console.error("Missing environment variables");
  process.exit(1);
}

const webhooks = new Webhooks({ secret: WEBHOOK_SECRET });

function runCodex(cwd: string, prompt: string): string {
  const res = spawnSync("codex", ["-q", "-a", "full-auto", prompt], {
    cwd,
    env: { ...process.env, OPENAI_API_KEY },
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return res.stdout.trim();
}

async function octo(installationId: number) {
  return request.defaults({
    request: { 
      hook: createAppAuth({ 
        appId: APP_ID, 
        privateKey: PRIVATE_KEY, 
        installationId 
      }) 
    },
  });
}

// ------------------------------------------------------------------
// Handle issues labeled with "codex"
webhooks.on("issues.labeled", async ({ payload }) => {
  if (payload.label.name !== "codex") return;
  
  const { number, body, title } = payload.issue;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await octo(instId);

  // Create temporary working directory
  const work = mkdtempSync(join(tmpdir(), "codex-"));
  
  try {
    // Download repository contents
    await api("GET /repos/{owner}/{repo}/tarball", { 
      owner, 
      repo, 
      headers: { accept: "application/vnd.github+json" } 
    }).then(response => {
      spawnSync("tar", ["xz", "-C", work], { 
        input: Buffer.from(response.data as ArrayBuffer) 
      });
    });

    const repoDir = join(work, "repo");
    
    // Run Codex on the issue body
    runCodex(repoDir, body || "solve this issue");

    // Configure git
    spawnSync("git", ["config", "--global", "user.email", "codex@app"], { cwd: repoDir });
    spawnSync("git", ["config", "--global", "user.name", "Codex Agent"], { cwd: repoDir });
    
    // Create and checkout branch
    const branch = `codex/issue-${number}`;
    spawnSync("git", ["checkout", "-b", branch], { cwd: repoDir });
    spawnSync("git", ["add", "-A"], { cwd: repoDir });
    
    // Commit and push changes if there are any
    const hasChanges = spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repoDir }).status === 1;
    
    if (hasChanges) {
      // Commit changes
      spawnSync("git", ["commit", "-m", `Codex changes for #${number}`], { cwd: repoDir });
      
      // Get access token and push changes
      const accessTokenResponse = await api("POST /app/installations/{installation_id}/access_tokens", { 
        installation_id: instId 
      });
      
      const repoUrl = `https://x-access-token:${accessTokenResponse.data.token}@github.com/${owner}/${repo}.git`;
      spawnSync("git", ["push", "--force", repoUrl, `HEAD:${branch}`], { cwd: repoDir });
      
      // Create pull request
      await api("POST /repos/{owner}/{repo}/pulls", { 
        owner, 
        repo, 
        head: branch, 
        base: "main", 
        title: `Codex: ${title}`, 
        body: `Closes #${number}` 
      });
    }
  } finally {
    // Clean up temporary directory
    rmSync(work, { recursive: true, force: true });
  }
});

// ------------------------------------------------------------------
// Handle pull request opened or updated events
webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload }) => {
  const { number, diff_url } = payload.pull_request;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await octo(instId);

  // Fetch pull request diff
  const diff = await fetch(diff_url).then(r => r.text());
  
  // Run Codex review on the diff
  const review = runCodex(
    process.cwd(), 
    `Review this diff and reply "APPROVE" if perfect:\n${diff}`
  );

  // Post the appropriate review based on Codex results
  if (review.trim() === "APPROVE") {
    await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { 
      owner, 
      repo, 
      pull_number: number, 
      event: "APPROVE", 
      body: "✅ LGTM – approved by Codex." 
    });
  } else {
    await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { 
      owner, 
      repo, 
      pull_number: number, 
      body: review, 
      event: "COMMENT" 
    });
  }
});

// ------------------------------------------------------------------
// Handle CI workflow failure events
webhooks.on("workflow_run.completed", async ({ payload }) => {
  if (payload.workflow_run.conclusion !== "failure") return;
  
  const { id } = payload.workflow_run;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await octo(instId);

  // Fetch CI run logs
  const logs = await api("GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs", { 
    owner, 
    repo, 
    run_id: id, 
    request: { raw: true } 
  }).then(r => r.data as Buffer);
  
  // Use Codex to diagnose the failure
  const diagnosis = runCodex(
    process.cwd(), 
    "A CI run failed, diagnose briefly:\n" + logs.toString("utf8").slice(0, 50000)
  );

  // Create issue with the diagnosis
  await api("POST /repos/{owner}/{repo}/issues", { 
    owner, 
    repo, 
    title: `CI failed – run #${id}`, 
    body: diagnosis, 
    labels: ["pipeline-failure"] 
  });
});

// ------------------------------------------------------------------
// Start the server
const server = http.createServer(createNodeMiddleware(webhooks));
server.listen(+PORT, () => console.log(`Codex Agent listening on port ${PORT}`));