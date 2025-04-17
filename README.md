# git-swe-agent

git-swe-agent is a lightweight GitHub App that brings terminal‑driven AI automation to any repository. It leverages the open‑source Codex CLI to start work on new tasks, review pull requests, and diagnose pipeline failures—all without per‑repo boilerplate.

## Project Structure

```
.
├── src/                  # Source code
│   ├── __tests__/        # Test files
│   ├── handlers/         # Event handlers for GitHub webhooks
│   ├── services/         # Service modules
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── app.ts            # Webhook server setup
│   └── index.ts          # Application entry point
├── .eslintrc.js          # ESLint configuration
├── jest.config.js        # Jest configuration
├── package.json          # Project metadata and dependencies
└── tsconfig.json         # TypeScript configuration
```

## Features

The agent reacts to three GitHub events:

1. When an issue is labeled `codex`, it clones the repo, runs Codex CLI with the issue text, commits any changes, pushes a branch, and opens a PR.
2. For each pull request opened or updated, it fetches the diff, runs Codex in review mode, and posts inline comments or auto‑approves if there are no issues.
3. Upon any workflow run that fails, it downloads the logs, asks Codex for a root‑cause analysis, and opens a new issue summarizing the failure.

## Requirements

The service runs on Node.js 22 or newer and requires Docker (for sandboxing) and the Codex CLI. You must create a GitHub App with repository contents write, issues write, pull requests write, actions read, and metadata read permissions, plus webhook subscriptions for the `issues`, `pull_request`, and `workflow_run` events. Four environment variables must be set: `APP_ID`, `PRIVATE_KEY`, `WEBHOOK_SECRET`, and `OPENAI_API_KEY`.

## Quickstart

Clone this repository and build the Docker image:

```bash
git clone https://github.com/your-org/codex-github-agent.git
cd codex-github-agent
docker build -t codex-agent .
```

Alternatively, click the "Deploy to Render" or "Deploy to Railway" badge in the repo, which will build and launch the service automatically. In either case, configure the following environment variables in your host or platform:

- `APP_ID`: your GitHub App's numeric ID  
- `PRIVATE_KEY`: the PEM file contents you downloaded when creating the App  
- `WEBHOOK_SECRET`: the secret you defined for GitHub webhooks  
- `OPENAI_API_KEY`: your OpenAI API key  
- (optional) `PORT`: port on which the service listens (default 3000)

Once deployed, copy the public URL into your GitHub App's "Webhook URL" field and save. Finally, install the App on any organization or repository you wish to automate—no additional files or workflows needed in those repos.

## Development

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file with the required environment variables as listed in the Quickstart section.

### Running the App

```bash
# Build the TypeScript code
npm run build

# Start the server
npm start

# Development mode with auto-reloading
npm run dev
```

### Testing

```bash
# Run all tests
npm test

# Run linter
npm run lint
```

## Configuration

All behavior is controlled by environment variables. For advanced tuning you can fork the code and modify the Typescript source. The included `tsconfig.json` and `package.json` define a simple build pipeline with `npm run build`.

## Usage

After installation, label any issue with `codex` to have the AI start coding on it, push commits to a pull request to trigger an automated review, and watch for new issues labeled `pipeline-failure` when CI jobs fail. All actions occur in sandboxed environments and under version control.

## Contributing

Contributions are welcome. To propose a change, open an issue or pull request, sign the CLA in your PR description, and include tests written in Typescript. Run `npm run build` to compile, `npm test` to execute tests, and `npm run lint` to enforce style. Please follow semantic commit messages and the Contributor Covenant.

## License

This project is licensed under the Apache‑2.0 License. Feel free to use, modify, and distribute under the same terms.