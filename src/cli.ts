#!/usr/bin/env node
import { program } from 'commander';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { runReporter } from './reporter';
import { ReporterConfig } from './types';
import { log } from './logger';

dotenv.config();

program
  .name('maestro-testrail')
  .description('Sync Maestro test results to TestRail')
  .version('1.0.0');

program
  .command('report', { isDefault: true })
  .description('Parse Maestro results and post them to TestRail')
  .option('-c, --config <path>', 'Path to JSON config file', 'maestro-testrail.json')
  .option('--results-dir <path>', 'Override Maestro results directory')
  .option('--dry-run', 'Parse and log results without posting to TestRail')
  .option('--no-attachments', 'Skip uploading screenshots and videos')
  .action(async (opts) => {
    // ── Load config ─────────────────────────────────────────────────────
    let config: ReporterConfig;

    const configPath = path.resolve(opts.config);
    if (fs.existsSync(configPath)) {
      try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf-8')) as ReporterConfig;
        log.info(`Loaded config from ${configPath}`);
      } catch {
        log.error(`Failed to parse config file: ${configPath}`);
        process.exit(1);
      }
    } else {
      // Fall back to environment variables
      const host = process.env.TESTRAIL_HOST;
      const username = process.env.TESTRAIL_USER;
      const apiKey = process.env.TESTRAIL_API_KEY;
      const projectId = process.env.TESTRAIL_PROJECT_ID;

      if (!host || !username || !apiKey || !projectId) {
        log.error(
          'No config file found and required env vars are missing.\n' +
          '  Create maestro-testrail.json or set:\n' +
          '  TESTRAIL_HOST, TESTRAIL_USER, TESTRAIL_API_KEY, TESTRAIL_PROJECT_ID'
        );
        process.exit(1);
      }

      config = {
        testrail: {
          host,
          username,
          apiKey,
          projectId: parseInt(projectId, 10),
          suiteId: process.env.TESTRAIL_SUITE_ID
            ? parseInt(process.env.TESTRAIL_SUITE_ID, 10)
            : undefined,
          runName: process.env.TESTRAIL_RUN_NAME,
          existingRunId: process.env.TESTRAIL_RUN_ID
            ? parseInt(process.env.TESTRAIL_RUN_ID, 10)
            : undefined,
        },
        maestro: {
          resultsDir: process.env.MAESTRO_RESULTS_DIR ?? './maestro-results',
        },
      };
    }

    // ── Apply CLI overrides ──────────────────────────────────────────────
    if (opts.resultsDir) {
      config.maestro.resultsDir = opts.resultsDir;
    }
    if (opts.dryRun) {
      config.dryRun = true;
    }
    if (opts.attachments === false) {
      config.uploadAttachments = false;
    }

    // ── Run ──────────────────────────────────────────────────────────────
    try {
      const summary = await runReporter(config);
      process.exit(summary.failed > 0 ? 1 : 0);
    } catch (err) {
      log.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse(process.argv);
