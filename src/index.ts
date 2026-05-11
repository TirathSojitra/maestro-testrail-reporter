/**
 * maestro-testrail-reporter
 *
 * Sync Maestro mobile test results to TestRail, including screenshots,
 * videos, and failure reasons.
 *
 * @example
 * ```ts
 * import { runReporter } from 'maestro-testrail-reporter';
 *
 * await runReporter({
 *   testrail: {
 *     host: 'https://yourorg.testrail.io',
 *     username: process.env.TESTRAIL_USER!,
 *     apiKey: process.env.TESTRAIL_API_KEY!,
 *     projectId: 42,
 *   },
 *   maestro: {
 *     resultsDir: './maestro-results',
 *   },
 * });
 * ```
 */

export { runReporter } from './reporter';
export type { ReporterSummary } from './reporter';
export type {
  ReporterConfig,
  TestrailConfig,
  MaestroConfig,
  MaestroTestResult,
  TestrailRun,
  TestrailResult,
  TestrailCase,
} from './types';
export { STATUS } from './types';
export { TestrailClient } from './testrail-client';
export { parseMaestroResults } from './maestro-parser';
