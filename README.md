# maestro-testrail-reporter

[![npm version](https://badge.fury.io/js/maestro-testrail-reporter.svg)](https://www.npmjs.com/package/maestro-testrail-reporter)
[![CI](https://github.com/yourusername/maestro-testrail-reporter/actions/workflows/ci.yml/badge.svg)](https://github.com/yourusername/maestro-testrail-reporter/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Sync [Maestro](https://maestro.mobile.dev/) mobile test results to [TestRail](https://www.testrail.com/) automatically — including screenshots, videos, and failure reasons.

## Features

- ✅ Parse Maestro JUnit XML output
- 📸 Upload screenshots per test case
- 🎥 Upload video recordings
- ❌ Attach failure reasons and stack traces
- 🆕 Optionally auto-create missing TestRail cases
- 🔁 Attach results to an existing run
- 🧪 Dry-run mode for CI debugging
- 🖥️ Works as a library **or** a CLI

---

## Installation

```bash
npm install -D maestro-testrail-reporter
# or
yarn add -D maestro-testrail-reporter
```

---

## Quick Start

### 1. Name your Maestro flows with a TestRail case ID

The reporter matches flows to TestRail cases by looking for `C<id>` in the flow filename:

```
flows/
  Login Flow C1001.yaml
  Checkout Flow C1002.yaml
  Onboarding C1003.yaml
```

### 2. Run Maestro and output JUnit XML

```bash
maestro test --format junit flows/ --output ./maestro-results
```

### 3. Post results to TestRail

**Option A — Config file:**

Create `maestro-testrail.json`:

```json
{
  "testrail": {
    "host": "https://yourorg.testrail.io",
    "username": "your@email.com",
    "apiKey": "your_api_key",
    "projectId": 1,
    "suiteId": 2
  },
  "maestro": {
    "resultsDir": "./maestro-results"
  },
  "uploadAttachments": true
}
```

Then run:

```bash
npx maestro-testrail report
```

**Option B — Environment variables:**

```bash
export TESTRAIL_HOST=https://yourorg.testrail.io
export TESTRAIL_USER=your@email.com
export TESTRAIL_API_KEY=your_api_key
export TESTRAIL_PROJECT_ID=1

npx maestro-testrail report --results-dir ./maestro-results
```

**Option C — Programmatic (TypeScript/JavaScript):**

```typescript
import { runReporter } from 'maestro-testrail-reporter';

const summary = await runReporter({
  testrail: {
    host: process.env.TESTRAIL_HOST!,
    username: process.env.TESTRAIL_USER!,
    apiKey: process.env.TESTRAIL_API_KEY!,
    projectId: 1,
  },
  maestro: {
    resultsDir: './maestro-results',
  },
  uploadAttachments: true,
});

console.log(`Passed: ${summary.passed}, Failed: ${summary.failed}`);
```

---

## Configuration Reference

### `ReporterConfig`

| Option | Type | Default | Description |
|---|---|---|---|
| `testrail` | `TestrailConfig` | required | TestRail connection settings |
| `maestro` | `MaestroConfig` | required | Maestro output settings |
| `uploadAttachments` | `boolean` | `true` | Upload screenshots and videos |
| `createMissingCases` | `boolean` | `false` | Auto-create cases with no matching ID |
| `defaultSectionId` | `number` | — | Section for auto-created cases |
| `caseIdPattern` | `RegExp` | `/C(\d+)/` | Regex to extract case ID from flow name |
| `dryRun` | `boolean` | `false` | Parse and log without posting |

### `TestrailConfig`

| Option | Type | Required | Description |
|---|---|---|---|
| `host` | `string` | ✅ | e.g. `https://yourorg.testrail.io` |
| `username` | `string` | ✅ | TestRail email |
| `apiKey` | `string` | ✅ | API key from Account Settings |
| `projectId` | `number` | ✅ | TestRail project ID |
| `suiteId` | `number` | — | Required for multi-suite projects |
| `runName` | `string` | — | Custom run name |
| `existingRunId` | `number` | — | Attach to an existing run |
| `milestoneId` | `number` | — | Associate with a milestone |
| `assignedToId` | `number` | — | Assign run to a user |

### `MaestroConfig`

| Option | Type | Description |
|---|---|---|
| `resultsDir` | `string` | Path to Maestro JUnit output directory |
| `appId` | `string` | App identifier (for logging) |

---

## CLI Reference

```
Usage: maestro-testrail report [options]

Options:
  -c, --config <path>       Path to JSON config file (default: maestro-testrail.json)
  --results-dir <path>      Override Maestro results directory
  --dry-run                 Parse and log results without posting
  --no-attachments          Skip uploading screenshots/videos
  -h, --help                Display help
```

Exit code is `0` when all tests pass, `1` if any fail (useful for CI).

---

## CI Integration (GitHub Actions)

```yaml
- name: Run Maestro tests
  run: maestro test --format junit flows/ --output ./maestro-results

- name: Post results to TestRail
  run: npx maestro-testrail report
  env:
    TESTRAIL_HOST: ${{ secrets.TESTRAIL_HOST }}
    TESTRAIL_USER: ${{ secrets.TESTRAIL_USER }}
    TESTRAIL_API_KEY: ${{ secrets.TESTRAIL_API_KEY }}
    TESTRAIL_PROJECT_ID: "1"
```

---

## Advanced: Using the Low-Level API

```typescript
import { TestrailClient, parseMaestroResults } from 'maestro-testrail-reporter';

// Parse flows manually
const results = await parseMaestroResults('./maestro-results', /TC-(\d+)/);

// Use the TestRail client directly
const client = new TestrailClient(host, username, apiKey);
const run = await client.createRun(projectId, 'My Run', { suiteId });
const result = await client.addResult(run.id, caseId, { statusId: 1 });
await client.uploadAttachment(result.id, '/path/to/screenshot.png');
```

---

## Contributing

1. Fork the repo
2. `npm install`
3. `npm run build:watch` to compile in watch mode
4. `npm test` to run tests
5. Open a PR 🎉

---

## License

MIT
