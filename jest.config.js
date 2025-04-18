export default {
  testEnvironment: "node",
  transform: {},
  testMatch: [
    "**/__tests__/utils/config.test.js",
    "**/__tests__/services/git.test.js",
    "**/__tests__/services/codex.test.js",
    "**/__tests__/services/octokit.test.js",
    "**/__tests__/services/repo.test.js",
    "**/__tests__/app.test.js"
  ],
  setupFilesAfterEnv: ["./jest.setup.js"]
};