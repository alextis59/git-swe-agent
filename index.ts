import { Webhooks } from "@octokit/webhooks";
import { createNodeMiddleware } from "@octokit/webhooks";
import { request } from "@octokit/request";
import { createAppAuth } from "@octokit/auth-app";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
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
  console.error("Missing env vars"); process.exit(1);
}

const webhooks = new Webhooks({ secret: WEBHOOK_SECRET });

function runCodex(cwd: string, prompt: string) {
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
    request: { hook: createAppAuth({ appId: APP_ID, privateKey: PRIVATE_KEY, installationId }) },
  });
}

// ------------------------------------------------------------------
// ISSUE labelled “codex”
webhooks.on("issues.labeled", async ({ payload }) => {
  if (payload.label.name !== "codex") return;
  const { number, body, title } = payload.issue;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await octo(instId);

  const work = mkdtempSync(join(tmpdir(), "codex-"));
  await api("GET /repos/{owner}/{repo}/tarball", { owner, repo, headers: { accept: "application/vnd.github+json" } })
    .then(r => spawnSync("tar", ["xz", "-C", work], { input: Buffer.from(r.data as ArrayBuffer) }));

  const repoDir = join(work, "repo");
  runCodex(repoDir, body || "solve this issue");

  spawnSync("git", ["config", "--global", "user.email", "codex@app"], { cwd: repoDir });
  spawnSync("git", ["config", "--global", "user.name", "Codex Agent"], { cwd: repoDir });
  const branch = `codex/issue-${number}`;
  spawnSync("git", ["checkout", "-b", branch], { cwd: repoDir });
  spawnSync("git", ["add", "-A"], { cwd: repoDir });
  if (spawnSync("git", ["diff", "--cached", "--quiet"], { cwd: repoDir }).status === 1) {
    spawnSync("git", ["commit", "-m", `Codex changes for #${number}`], { cwd: repoDir });
    spawnSync("git", ["push", "--force", `https://x-access-token:${(await api("POST /app/installations/{installation_id}/access_tokens", { installation_id: instId })).data.token}@github.com/${owner}/${repo}.git`, `HEAD:${branch}`], { cwd: repoDir });
    await api("POST /repos/{owner}/{repo}/pulls", { owner, repo, head: branch, base: "main", title: `Codex: ${title}`, body: `Closes #${number}` });
  }
  rmSync(work, { recursive: true, force: true });
});

// ------------------------------------------------------------------
// PR opened or updated
webhooks.on(["pull_request.opened", "pull_request.synchronize"], async ({ payload }) => {
  const { number, diff_url } = payload.pull_request;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await octo(instId);

  const diff = await fetch(diff_url).then(r => r.text());
  const review = runCodex(process.cwd(), `Review this diff and reply "APPROVE" if perfect:\n${diff}`);

  if (review.trim() === "APPROVE") {
    await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { owner, repo, pull_number: number, event: "APPROVE", body: "✅ LGTM – approved by Codex." });
  } else {
    await api("POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews", { owner, repo, pull_number: number, body: review, event: "COMMENT" });
  }
});

// ------------------------------------------------------------------
// CI failed
webhooks.on("workflow_run.completed", async ({ payload }) => {
  if (payload.workflow_run.conclusion !== "failure") return;
  const { id } = payload.workflow_run;
  const { full_name } = payload.repository;
  const [owner, repo] = full_name.split("/");
  const instId = payload.installation!.id;
  const api = await octo(instId);

  const logs = await api("GET /repos/{owner}/{repo}/actions/runs/{run_id}/logs", { owner, repo, run_id: id, request: { raw: true } }).then(r => r.data as Buffer);
  const diagnosis = runCodex(process.cwd(), "A CI run failed, diagnose briefly:\n" + logs.toString("utf8").slice(0, 50000));

  await api("POST /repos/{owner}/{repo}/issues", { owner, repo, title: `CI failed – run #${id}`, body: diagnosis, labels: ["pipeline-failure"] });
});

// ------------------------------------------------------------------
const server = http.createServer(createNodeMiddleware(webhooks));
server.listen(+PORT, () => console.log("Codex Agent listening on", PORT));